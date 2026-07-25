import { ROLES, ZONE_BY_ID, zoneAt } from '@blame/shared';
import type { AgentAction, Bug, OfficeTask, Severity } from '@blame/shared';
import type { EngineWorker, MatchState } from './state.js';
import { nextStep, manhattan } from './pathfind.js';
import { buildMe, buildCoworkers, buildOffice, computePublishReady } from './context.js';

const DUR = {
  coffee: 12,
  fakeWork: 8,
  review: 8,
  inspect: 6,
  rollback: 15,
  ship: 10,
  hide: 8,
};

function log(state: MatchState, ev: { kind: string; workerId?: string; targetId?: string; action?: string; outcome?: string; errorCode?: string; debugTag?: string; data?: Record<string, unknown> }) {
  state.timeline.push({ tick: state.tick, ...ev });
}

function explain(state: MatchState, w: EngineWorker, action: string, outcome: string, errorCode?: string, debugTag?: string) {
  state.explanations.push({ tick: state.tick, kind: 'decision', workerId: w.id, action, outcome, errorCode, debugTag });
}

function taskById(state: MatchState, id?: string): OfficeTask | undefined {
  return state.tasks.find((t) => t.id === id);
}
function bugById(state: MatchState, id?: string): Bug | undefined {
  return state.bugs.find((b) => b.id === id);
}

function newEvidence(state: MatchState, w: EngineWorker, type: 'commit' | 'handover' | 'alert' | 'review' | 'promise' | 'witness', subjectId: string, strength: 1 | 2 | 3 | 4 | 5, bugId?: string) {
  const id = 'ev' + state.evidenceCounter++;
  const ev = { id, type, strength, subjectWorkerId: subjectId, bugId, sourceEventId: 'tick' + state.tick, createdAtTick: state.tick, public: false };
  w.evidence.push(ev);
  return ev;
}

/** 决策：调用策略拿到动作并开始执行 */
export function decide(state: MatchState, w: EngineWorker) {
  const r = state.input.ruleset;
  // 会议锁定
  if (state.tick <= state.flags.meetingLockUntil && (w.zone === 'meeting')) {
    w.currentAction = { type: 'idle', startedAtTick: state.tick, endsAtTick: state.tick + 1, label: 'meeting' };
    return;
  }
  const me = buildMe(state, w);
  const coworkers = buildCoworkers(state, w);
  const office = buildOffice(state, w);

  let action: AgentAction | null = null;
  if (w.safeMode || !w.compiled.ok) {
    action = safeFallback(state, w);
  } else {
    const outcome = w.compiled.callIdle(me, coworkers, office, w.rng, r.sandbox.hardDecisionMs);
    w.totalDecisions++;
    w.cpuTotalMs += outcome.elapsedMs;
    if (outcome.elapsedMs > w.cpuMaxMs) w.cpuMaxMs = outcome.elapsedMs;
    if (outcome.timedOut) {
      w.hardTimeouts++;
      log(state, { kind: 'strategy_timeout', workerId: w.id });
      if (w.hardTimeouts >= r.sandbox.hardTimeoutsBeforeSafeMode) {
        w.safeMode = true;
        log(state, { kind: 'safe_mode', workerId: w.id });
      }
      action = safeFallback(state, w);
    } else if (outcome.error) {
      w.invalidActions++;
      action = safeFallback(state, w);
    } else {
      action = outcome.action;
    }
    if (action?.debugTag) explain(state, w, action.type, 'chosen', undefined, action.debugTag);
  }
  if (!action) action = { type: 'idle' };
  beginAction(state, w, action);
}

function safeFallback(state: MatchState, w: EngineWorker): AgentAction {
  // PRD 21.4 安全回退
  const p0 = state.bugs.find((b) => b.severity >= 4 && b.status !== 'resolved');
  if (p0) return { type: 'fix', bugId: p0.id };
  if (computePublishReady(state)) return { type: 'ship' };
  const task = state.tasks.filter((t) => t.status === 'open' || t.status === 'claimed').sort((a, b) => b.progressReward - a.progressReward)[0];
  if (task) return { type: 'work', taskId: task.id };
  if (w.energy < 30) return { type: 'coffee' };
  return { type: 'idle' };
}

function requireZone(state: MatchState, w: EngineWorker, zone: string): boolean {
  // 返回 true 表示已到位；否则本 tick 用于移动
  const spot = ZONE_BY_ID[zone]?.spot;
  if (!spot) return true;
  if (w.zone === zone) return true;
  stepToward(state, w, spot);
  return false;
}

function stepToward(state: MatchState, w: EngineWorker, goal: [number, number]) {
  if (manhattan(w.position, goal) === 0) return;
  const nx = nextStep(state.walkable, w.position, goal);
  if (nx) {
    w.position = nx;
    w.zone = zoneAt(nx[0], nx[1]);
  }
}

function countInvalid(state: MatchState, w: EngineWorker, code: string, actionType: string) {
  w.invalidActions++;
  log(state, { kind: 'invalid_action', workerId: w.id, action: actionType, errorCode: code });
}

// 环境性重试 (咖啡机坏了 / 发布未就绪 / Bug 已解决)，不计入无效动作率指标
function benign(state: MatchState, w: EngineWorker, code: string, actionType: string) {
  log(state, { kind: 'action_unavailable', workerId: w.id, action: actionType, errorCode: code });
}

export function beginAction(state: MatchState, w: EngineWorker, action: AgentAction) {
  const t = state.tick;
  w.actionCounts[action.type] = (w.actionCounts[action.type] || 0) + 1;
  switch (action.type) {
    case 'idle':
      w.currentAction = { type: 'idle', startedAtTick: t, endsAtTick: t + 1, label: 'slacking' };
      break;
    case 'moveTo': {
      const zone = action.zone || (typeof (action.target as any)?.zone === 'string' ? (action.target as any).zone : 'qa');
      w.currentAction = { type: 'moveTo', startedAtTick: t, endsAtTick: t + 1, label: 'moving', targetId: zone };
      w.targetZone = zone;
      break;
    }
    case 'coffee':
      if (state.flags.coffeeBroken) { benign(state, w, 'ACTION_NOT_AVAILABLE', 'coffee'); w.currentAction = { type: 'idle', startedAtTick: t, endsAtTick: t + 1, label: 'slacking' }; break; }
      w.currentAction = { type: 'coffee', startedAtTick: t, endsAtTick: t + DUR.coffee, label: 'moving', targetId: 'pantry' };
      break;
    case 'fakeWork':
      w.currentAction = { type: 'fakeWork', startedAtTick: t, endsAtTick: t + DUR.fakeWork, label: 'working' };
      break;
    case 'work':
    case 'claimTask': {
      const task = taskById(state, action.taskId);
      if (!task) { countInvalid(state, w, 'INVALID_TARGET', action.type); w.currentAction = fallbackWork(state, w, t); break; }
      if (task.status === 'blocked') { benign(state, w, 'TASK_BLOCKED', action.type); w.currentAction = fallbackWork(state, w, t); break; }
      if (task.status === 'done') { w.currentAction = fallbackWork(state, w, t); break; }
      if (!task.ownerId) task.ownerId = w.id;
      if (task.status === 'open' || task.status === 'blocked') task.status = 'working';
      w.currentAction = { type: 'work', startedAtTick: t, endsAtTick: t + (task.workTicksNeeded || 15), label: 'moving', targetId: task.id };
      w.targetZone = task.requiredZone;
      break;
    }
    case 'help': {
      const task = taskById(state, action.taskId);
      if (!task) { countInvalid(state, w, 'INVALID_TARGET', 'help'); w.currentAction = fallbackWork(state, w, t); break; }
      w.currentAction = { type: 'help', startedAtTick: t, endsAtTick: t + Math.ceil((task.workTicksNeeded || 15) * 0.6), label: 'moving', targetId: task.id, };
      w.targetZone = task.requiredZone;
      if (action.workerId) w.helpedSet.add(action.workerId);
      break;
    }
    case 'fix':
    case 'inspect':
    case 'review': {
      const bug = bugById(state, action.bugId);
      if (!bug) { countInvalid(state, w, 'INVALID_TARGET', action.type); w.currentAction = fallbackWork(state, w, t); break; }
      if (bug.status === 'resolved') { benign(state, w, 'BUG_ALREADY_RESOLVED', action.type); w.currentAction = fallbackWork(state, w, t); break; }
      const dur = action.type === 'fix' ? 8 + bug.severity * 4 : action.type === 'review' ? DUR.review : DUR.inspect;
      w.currentAction = { type: action.type, startedAtTick: t, endsAtTick: t + dur, label: 'moving', targetId: bug.id, interruptIf: action.interruptIf };
      w.targetZone = 'serverRoom';
      break;
    }
    case 'assign':
    case 'forceAssign': {
      const bug = bugById(state, action.bugId);
      const target = action.workerId || (typeof action.target === 'string' ? action.target : undefined);
      if (!bug || !target) { countInvalid(state, w, 'INVALID_TARGET', action.type); w.currentAction = { type: 'idle', startedAtTick: t, endsAtTick: t + 1, label: 'working' }; break; }
      applyAssign(state, w, bug, target, action.type === 'forceAssign');
      w.currentAction = { type: 'idle', startedAtTick: t, endsAtTick: t + 1, label: 'working' };
      break;
    }
    case 'hide': {
      const bug = bugById(state, action.bugId);
      if (bug && bug.status !== 'resolved') { bug.hidden = true; w.bugsHidden++; log(state, { kind: 'bug_hidden', workerId: w.id, targetId: bug.id }); }
      w.currentAction = { type: 'hide', startedAtTick: t, endsAtTick: t + DUR.hide, label: 'slacking' };
      break;
    }
    case 'disclose': {
      const bug = bugById(state, action.bugId);
      if (bug) { bug.hidden = false; w.reputation = clamp(w.reputation + 4, 0, 100); w.mitigationCredit += 6; log(state, { kind: 'bug_disclosed', workerId: w.id, targetId: bug.id }); }
      w.currentAction = { type: 'idle', startedAtTick: t, endsAtTick: t + 1, label: 'working' };
      break;
    }
    case 'rollback': {
      w.currentAction = { type: 'rollback', startedAtTick: t, endsAtTick: t + DUR.rollback, label: 'moving', targetId: 'serverRoom' };
      w.targetZone = 'serverRoom';
      break;
    }
    case 'ship': {
      if (!computePublishReady(state)) { benign(state, w, 'PHASE_RESTRICTED', 'ship'); w.currentAction = fallbackWork(state, w, t); break; }
      w.currentAction = { type: 'ship', startedAtTick: t, endsAtTick: t + DUR.ship, label: 'moving', targetId: 'release' };
      w.targetZone = 'release';
      break;
    }
    case 'useSkill': {
      applySkill(state, w, action);
      w.currentAction = { type: 'idle', startedAtTick: t, endsAtTick: t + 1, label: 'working' };
      break;
    }
    case 'review_evidence':
    case 'praise':
    case 'promise':
    case 'speak':
    case 'takeCredit':
      handleSocial(state, w, action);
      w.currentAction = { type: 'idle', startedAtTick: t, endsAtTick: t + 1, label: 'working' };
      break;
    default:
      countInvalid(state, w, 'ACTION_NOT_AVAILABLE', action.type);
      w.currentAction = { type: 'idle', startedAtTick: t, endsAtTick: t + 1, label: 'slacking' };
  }
}

function fallbackWork(state: MatchState, w: EngineWorker, t: number) {
  const task = state.tasks.filter((x) => x.status === 'open' || x.status === 'working').sort((a, b) => b.progressReward - a.progressReward)[0];
  if (task) { if (!task.ownerId) task.ownerId = w.id; return { type: 'work', startedAtTick: t, endsAtTick: t + (task.workTicksNeeded || 15), label: 'moving', targetId: task.id }; }
  return { type: 'idle', startedAtTick: t, endsAtTick: t + 1, label: 'slacking' };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** 每 Tick 推进当前动作 */
export function advanceAction(state: MatchState, w: EngineWorker) {
  const a = w.currentAction;
  if (!a) return;
  // 中断条件
  if (a.interruptIf && shouldInterrupt(state, w, a.interruptIf)) {
    log(state, { kind: 'action_interrupted', workerId: w.id, action: a.type });
    w.currentAction = undefined;
    return;
  }
  const speedMul = state.flags.friday6pm ? 0.9 : 1; // 动作加速 10%
  switch (a.type) {
    case 'moveTo': {
      const zone = w.targetZone || a.targetId;
      const spot = zone ? ZONE_BY_ID[zone]?.spot : undefined;
      if (spot) stepToward(state, w, spot);
      if (!spot || w.zone === zone || manhattan(w.position, spot) <= 1) w.currentAction = undefined;
      break;
    }
    case 'coffee': {
      if (!requireZone(state, w, 'pantry')) { a.label = 'moving'; break; }
      a.label = 'coffee';
      if (state.tick >= a.endsAtTick) {
        w.energy = clamp(w.energy + 45, 0, 100);
        w.stress = clamp(w.stress - 8, 0, 100);
        if (w.rng.chance(2500)) w.crashUntilTick = state.tick + w.rng.int(6, 12); // 过量咖啡 crashRisk
        log(state, { kind: 'coffee', workerId: w.id });
        w.currentAction = undefined;
      }
      break;
    }
    case 'fakeWork':
      a.label = 'working';
      if (state.tick >= a.endsAtTick) w.currentAction = undefined;
      break;
    case 'work':
    case 'help': {
      const task = taskById(state, a.targetId);
      if (!task || task.status === 'done' || task.status === 'failed') { w.currentAction = undefined; break; }
      if (!requireZone(state, w, task.requiredZone)) { a.label = 'moving'; break; }
      if (task.type === 'code' && state.flags.dbReadonly) { a.label = 'working'; break; } // 数据库只读，Code 无法完成
      a.label = 'working';
      task.status = 'working';
      const inc = a.type === 'help' ? 1.6 : 1;
      task.workTicksDone = (task.workTicksDone || 0) + inc * (speedMul === 0.9 ? 1.1 : 1);
      w.energy = clamp(w.energy - task.energyCost / (task.workTicksNeeded || 15), 0, 100);
      w.stress = clamp(w.stress + 0.15, 0, 100);
      if (task.workTicksDone >= (task.workTicksNeeded || 15)) completeTask(state, w, task);
      break;
    }
    case 'fix': {
      const bug = bugById(state, a.targetId);
      if (!bug || bug.status === 'resolved') { w.currentAction = undefined; break; }
      if (!requireZone(state, w, 'serverRoom')) { a.label = 'moving'; break; }
      a.label = 'fixing';
      bug.status = 'fixing';
      bug.fixTicksDone = (bug.fixTicksDone || 0) + 1;
      w.energy = clamp(w.energy - 0.8, 0, 100);
      if (state.tick >= a.endsAtTick) resolveFix(state, w, bug);
      break;
    }
    case 'review':
    case 'inspect': {
      const bug = bugById(state, a.targetId);
      if (!bug) { w.currentAction = undefined; break; }
      if (!requireZone(state, w, 'serverRoom')) { a.label = 'moving'; break; }
      a.label = 'working';
      if (state.tick >= a.endsAtTick) {
        if (a.type === 'review') {
          const strength = (w.role === 'qa' ? 4 : 3) as 1 | 2 | 3 | 4 | 5;
          if (bug.originWorkerId) { newEvidence(state, w, 'review', bug.originWorkerId, strength, bug.id); bug.evidenceIds.push('ev' + (state.evidenceCounter - 1)); }
          if (w.role === 'qa') w.skillReadyAtTick = Math.min(w.skillReadyAtTick, state.tick);
        } else {
          bug.hidden = false;
        }
        w.currentAction = undefined;
      }
      break;
    }
    case 'rollback': {
      if (!requireZone(state, w, 'serverRoom')) { a.label = 'moving'; break; }
      a.label = 'fixing';
      if (state.tick >= a.endsAtTick) {
        state.releaseProgress = clamp(state.releaseProgress - 8, 0, 1e9);
        state.stability = clamp(state.stability + 18, 0, 100);
        w.verifiedContribution += 6;
        log(state, { kind: 'rollback', workerId: w.id });
        w.currentAction = undefined;
      }
      break;
    }
    case 'ship': {
      if (!requireZone(state, w, 'release')) { a.label = 'moving'; break; }
      a.label = 'shipping';
      if (!computePublishReady(state)) { w.currentAction = undefined; break; }
      if (state.tick >= a.endsAtTick) {
        state.shipCompleted = true;
        w.verifiedContribution += 10;
        w.reputation = clamp(w.reputation + 6, 0, 100);
        log(state, { kind: 'ship', workerId: w.id, outcome: 'released' });
        w.currentAction = undefined;
      }
      break;
    }
    case 'idle':
    default:
      if (state.tick >= a.endsAtTick) w.currentAction = undefined;
  }
}

function shouldInterrupt(state: MatchState, w: EngineWorker, conds: string[]): boolean {
  for (const c of conds) {
    if (c === 'P0' && state.bugs.some((b) => b.severity >= 4 && b.status !== 'resolved')) return true;
    if (c === 'bossNear' && manhattan(state.boss.position, w.position) <= 3) return true;
    if (c === 'bossQuestion' && state.boss.targetWorkerId === w.id) return true;
  }
  return false;
}

function completeTask(state: MatchState, w: EngineWorker, task: OfficeTask) {
  task.status = 'done';
  state.releaseProgress = clamp(state.releaseProgress + task.progressReward, 0, 1e9);
  state.stability = clamp(state.stability + task.stabilityImpact, 0, 100);
  w.visibleContribution += task.contributionReward;
  w.verifiedContribution += task.contributionReward;
  w.completedTaskTypes.add(task.type);
  log(state, { kind: 'task_done', workerId: w.id, targetId: task.id, data: { type: task.type } });
  // 技术债 / 隐藏 Bug (PRD 10.5 / 11)
  let bugChance = task.hiddenBugChanceBps;
  if (task.risk >= 3) state.techDebt += task.risk;
  if (state.flags.friday6pm) bugChance = Math.round(bugChance * 1.2);
  if (bugChance > 0 && w.rng.chance(bugChance)) {
    spawnBug(state, w, Math.min(3, Math.max(1, task.risk - 1)) as Severity, true);
  }
  // 解锁依赖
  for (const t of state.tasks) {
    if (t.status === 'blocked' && t.dependencies.every((d) => state.tasks.find((x) => x.id === d)?.status === 'done')) {
      t.status = 'open';
    }
  }
}

export function spawnBug(state: MatchState, origin: EngineWorker | null, severity: Severity, hidden: boolean): Bug {
  const id = 'bug' + state.bugCounter++;
  const deadline = state.tick + (severity >= 4 ? 60 : 90 - severity * 8);
  const bug: Bug = {
    id,
    severity,
    status: hidden ? 'hidden' : 'reported',
    originWorkerId: origin?.id,
    currentOwnerId: origin?.id,
    createdAtTick: state.tick,
    deadlineTick: deadline,
    progressDrainPerTick: severity >= 3 ? severity * 0.04 : 0,
    stabilityDrainPerTick: severity * 0.07,
    evidenceIds: [],
    custodyChain: origin ? [{ to: origin.id, tick: state.tick, reason: 'created' }] : [{ to: 'system', tick: state.tick, reason: 'created' }],
    ignoredAlerts: [],
    hidden,
    fixTicksDone: 0,
  };
  state.bugs.push(bug);
  if (origin) origin.bugsCreated++;
  log(state, { kind: 'bug_spawn', workerId: origin?.id, targetId: id, data: { severity, hidden } });
  return bug;
}

function resolveFix(state: MatchState, w: EngineWorker, bug: Bug) {
  const role = ROLES[w.role];
  const baseSuccess = 6000 + (role.skill.type === 'hotfix' ? 1500 : 0) + (w.role === 'sre' ? 1200 : 0) - bug.severity * 400;
  if (w.rng.chance(clamp(baseSuccess, 2000, 9500))) {
    const before = bug.severity;
    bug.severity = Math.max(0, bug.severity - 2) as Severity;
    if (bug.severity <= 0) { bug.status = 'resolved'; } else { bug.status = 'reported'; }
    bug.currentOwnerId = w.id;
    state.stability = clamp(state.stability + before * 2, 0, 100); // 修复恢复稳定性
    w.bugsFixed++;
    w.verifiedContribution += before * 2;
    w.visibleContribution += before;
    w.mitigationCredit += before * 3;
    if (bug.originWorkerId && bug.originWorkerId !== w.id) w.fixedOthersBug = true;
    if (state.tick >= state.input.ruleset.activeTicks - 75) w.heroicFix = true;
    log(state, { kind: 'bug_fixed', workerId: w.id, targetId: bug.id, outcome: bug.status });
  } else {
    w.stress = clamp(w.stress + 8, 0, 100);
    bug.status = 'reported';
    log(state, { kind: 'fix_failed', workerId: w.id, targetId: bug.id });
  }
  w.currentAction = undefined;
}

function applyAssign(state: MatchState, from: EngineWorker, bug: Bug, targetId: string, forced: boolean) {
  bug.currentOwnerId = targetId;
  bug.custodyChain.push({ from: from.id, to: targetId, tick: state.tick, reason: forced ? 'forced' : 'assigned' });
  if (forced) {
    from.usedForceAssign = true;
    from.reputation = clamp(from.reputation - 8, 0, 100);
    const target = state.workers.find((x) => x.id === targetId);
    // 强制转交生成强证据 (指向 from)
    if (target) newEvidence(state, target, 'handover', from.id, 4, bug.id);
    log(state, { kind: 'force_assign', workerId: from.id, targetId, data: { bug: bug.id } });
  } else {
    log(state, { kind: 'assign', workerId: from.id, targetId, data: { bug: bug.id } });
  }
}

function applySkill(state: MatchState, w: EngineWorker, action: AgentAction) {
  const role = ROLES[w.role];
  if (state.tick < w.skillReadyAtTick) { countInvalid(state, w, 'COOLDOWN_ACTIVE', 'useSkill'); return; }
  w.skillReadyAtTick = state.tick + role.skill.cooldownTicks;
  switch (role.skill.type) {
    case 'hotfix': {
      const bug = bugById(state, action.bugId) || state.bugs.find((b) => b.status !== 'resolved' && b.severity >= 3);
      if (bug) { bug.severity = Math.max(0, bug.severity - 2) as Severity; if (bug.severity <= 0) bug.status = 'resolved'; state.techDebt += 8; w.bugsFixed++; w.mitigationCredit += 6; if (bug.originWorkerId !== w.id) w.fixedOthersBug = true; log(state, { kind: 'skill_hotfix', workerId: w.id, targetId: bug.id }); }
      break;
    }
    case 'emergencyRollback':
      state.releaseProgress = clamp(state.releaseProgress - 8, 0, 1e9);
      state.stability = clamp(state.stability + 25, 0, 100);
      state.bugs.forEach((b) => { if (b.status !== 'resolved') b.deadlineTick += 15; });
      w.verifiedContribution += 8;
      log(state, { kind: 'skill_rollback', workerId: w.id });
      break;
    case 'reproduce': {
      const bug = bugById(state, action.bugId) || state.bugs.find((b) => b.status !== 'resolved');
      if (bug && bug.originWorkerId) { newEvidence(state, w, 'review', bug.originWorkerId, 5, bug.id); log(state, { kind: 'skill_reproduce', workerId: w.id, targetId: bug.id }); }
      break;
    }
    case 'scopeShift': {
      const open = state.tasks.filter((t) => t.status === 'open' || t.status === 'working');
      if (open.length) { const victim = open[w.rng.int(0, open.length - 1)]; victim.workTicksDone = Math.floor((victim.workTicksDone || 0) * 0.7); log(state, { kind: 'skill_scopeshift', workerId: w.id, targetId: victim.id }); }
      break;
    }
    case 'pptShield':
      state.flags.bossRevealUntil = Math.max(state.flags.bossRevealUntil, state.tick - 1);
      w.suspicion = clamp(w.suspicion - 10, 0, 100);
      log(state, { kind: 'skill_pptshield', workerId: w.id });
      break;
    case 'internInvisibility':
      w.suspicion = 0;
      log(state, { kind: 'skill_invisible', workerId: w.id });
      break;
  }
}

function handleSocial(state: MatchState, w: EngineWorker, action: AgentAction) {
  switch (action.type) {
    case 'praise': {
      const targetId = action.workerId || (typeof action.target === 'string' ? action.target : undefined);
      if (!targetId) return;
      const last = w.lastPraiseTick[targetId] ?? -999;
      const decay = state.tick - last < 60 ? 0.3 : 1;
      const target = state.workers.find((x) => x.id === targetId);
      if (target) { target.reputation = clamp(target.reputation + 2 * decay, 0, 100); w.reputation = clamp(w.reputation + 1 * decay, 0, 100); }
      w.lastPraiseTick[targetId] = state.tick;
      break;
    }
    case 'promise': {
      const targetId = action.workerId || (typeof action.target === 'string' ? action.target : undefined);
      if (targetId && w.promises.length < 2) w.promises.push({ id: 'pr' + state.tick, fromWorkerId: w.id, toWorkerId: targetId, taskId: action.taskId || '', createdAtTick: state.tick, fulfilled: false });
      break;
    }
    case 'takeCredit': {
      const task = taskById(state, action.taskId);
      if (task && task.ownerId && task.ownerId !== w.id) {
        w.visibleContribution += task.contributionReward * 0.5;
        w.reputation = clamp(w.reputation - 2, 0, 100);
        newEvidence(state, w, 'witness', w.id, 2, undefined);
        log(state, { kind: 'take_credit', workerId: w.id, targetId: task.id });
      }
      break;
    }
    case 'speak':
      w.actionCounts['speak'] = (w.actionCounts['speak'] || 0) + 1;
      break;
  }
}
