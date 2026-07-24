import { EVENT_DECK, ZONE_BY_ID, BOSS_PATROL, phaseAt } from '@blame/shared';
import type { MatchReplay, ReplayFrame, SimulateInput, Severity } from '@blame/shared';
import { initState, type MatchState, type EngineWorker } from './state.js';
import { decide, advanceAction, spawnBug } from './actions.js';
import { bossLookingAt, computePublishReady } from './context.js';
import { nextStep, manhattan, bossSees } from './pathfind.js';
import { settle } from './audit.js';

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function log(state: MatchState, kind: string, extra: Record<string, unknown> = {}) {
  state.timeline.push({ tick: state.tick, kind, ...extra });
}

/** 主入口：运行一整局并返回结果+回放 (PRD 7.2) */
export function simulateMatch(input: SimulateInput): MatchReplay {
  const state = initState(input);
  const r = input.ruleset;

  for (state.tick = 0; state.tick < r.activeTicks; state.tick++) {
    refreshFlags(state);
    maybeDrawEvent(state);
    maybeSpawnIncident(state);
    updateBoss(state);
    // 员工按座位顺序决策/推进 (确定性)
    for (const w of state.workers) {
      if (state.tick < w.crashUntilTick) continue; // 精力崩溃
      if (w.currentAction) advanceAction(state, w);
      if (!w.currentAction) decide(state, w);
    }
    applyBugDynamics(state);
    applyPassiveResources(state);
    recordFrame(state);
  }

  // 审计阶段帧 (慢动作，仿真不变)
  const resultStatus = determineResult(state);
  const projectSuccess = resultStatus === 'success';
  // 记录若干审计帧供回放
  for (let i = 0; i < 6; i++) {
    state.tick = r.activeTicks + i;
    recordFrame(state, 'audit');
  }
  state.tick = r.activeTicks;

  const result = settle(state, projectSuccess, resultStatus);
  log(state, 'match_end', { resultStatus, scapegoat: result.scapegoatWorkerId });

  return { result, frames: state.frames, timeline: state.timeline, explanations: state.explanations };
}

function refreshFlags(state: MatchState) {
  const f = state.flags;
  f.wifiDown = false;
  f.dbReadonly = false;
  f.coffeeBroken = false;
  f.friday6pm = false;
  f.securityAudit = false;
  for (const e of state.activeEvents) {
    if (state.tick >= e.endsAtTick) continue;
    switch (e.effect) {
      case 'wifiDown': f.wifiDown = true; break;
      case 'dbReadonly': f.dbReadonly = true; break;
      case 'coffeeBroken': f.coffeeBroken = true; break;
      case 'friday6pm': f.friday6pm = true; break;
      case 'securityAudit': f.securityAudit = true; break;
      case 'standupMeeting': f.meetingLockUntil = e.endsAtTick; break;
      case 'bossGroup': f.bossRevealUntil = e.endsAtTick; break;
      case 'hrCheck': f.hrCheckUntil = e.endsAtTick; break;
    }
  }
  // 清理过期事件
  state.activeEvents = state.activeEvents.filter((e) => state.tick < e.endsAtTick);
  // 安全审计揭露隐藏 Bug
  if (f.securityAudit) state.bugs.forEach((b) => { if (b.hidden) b.hidden = false; });
}

function maybeDrawEvent(state: MatchState) {
  const phase = phaseAt(state.tick, state.input.ruleset);
  if (phase !== 'sprint' && phase !== 'incident') return;
  const interval = phase === 'incident' ? 14 : 16;
  if (state.tick - state.lastEventTick < interval) return;
  if (state.activeEvents.length >= 2) return;
  const candidates = EVENT_DECK.filter(
    (c) => c.windowPhases.includes(phase) && !state.usedEventIds.has(c.id + ':' + Math.floor(state.tick / 100))
  );
  if (!candidates.length) return;
    const bias = state.input.ruleset.scenario?.eventBias || [];
    const card = state.worldRng.weighted(candidates, (c) => c.weight * (bias.includes(c.id) ? 2.5 : 1));
  state.lastEventTick = state.tick;
  state.usedEventIds.add(card.id + ':' + Math.floor(state.tick / 100));
  const active = { cardId: card.id, nameKey: card.nameKey, startedAtTick: state.tick, endsAtTick: state.tick + card.durationTicks, effect: card.effect };
  state.activeEvents.push(active);
  log(state, 'event', { data: { card: card.id, effect: card.effect, intensity: card.intensity } });
  // 即时效果
  if (card.effect === 'prodAlert') {
    spawnBug(state, null, 3 as Severity, false);
  } else if (card.effect === 'clientDemo') {
    // 需求可见进度阈值：若不足则轻微降进度
    if (state.releaseProgress < 60) state.stability = clamp(state.stability - 5, 0, 100);
  } else if (card.effect === 'newJira') {
    // 新增低价值必做任务
    const t = state.tasks.find((x) => x.status === 'done');
    // 复用：将一个已完成的低价值任务变体加入 —— 简化为提升 techDebt
    state.techDebt += 3;
  } else if (card.effect === 'scopeChange') {
    const open = state.tasks.filter((x) => x.status === 'open' || x.status === 'working');
    if (open.length) { const victim = open[state.worldRng.int(0, open.length - 1)]; victim.workTicksDone = Math.floor((victim.workTicksDone || 0) * 0.7); log(state, 'scope_change', { targetId: victim.id }); }
  } else if (card.effect === 'autoscale') {
    state.stability = clamp(state.stability + 12, 0, 100); // 服务器自动扩容
  } else if (card.effect === 'mergeConflict') {
    const codeTasks = state.tasks.filter((x) => x.type === 'code' && (x.status === 'open' || x.status === 'working'));
    if (codeTasks.length) { const v = codeTasks[state.worldRng.int(0, codeTasks.length - 1)]; v.workTicksDone = Math.floor((v.workTicksDone || 0) * 0.6); }
  } else if (card.effect === 'revertDesign') {
    const design = state.tasks.filter((x) => x.type === 'design' && x.status === 'done');
    if (design.length) { const v = design[state.worldRng.int(0, design.length - 1)]; v.status = 'working'; v.workTicksDone = Math.floor((v.workTicksNeeded || 15) * 0.5); state.releaseProgress = clamp(state.releaseProgress - v.progressReward * 0.5, 0, 200); }
  }
}

function maybeSpawnIncident(state: MatchState) {
  // 事故阶段起点强制生成一个严重 Bug (PRD 7.2 阶段3)
  if (state.tick === 276) {
    spawnBug(state, null, 4 as Severity, false);
    log(state, 'incident_phase');
  }
}

function updateBoss(state: MatchState) {
  const b = state.boss;
  const r = state.input.ruleset;
  const phase = phaseAt(state.tick, r);

  // 分心事件 (boss_phone / boss 去接电话)
  const distract = state.activeEvents.find((e) => e.effect === 'bossPhone' || e.effect === 'boss_phone');
  if (distract && state.tick < distract.endsAtTick) {
    b.state = 'Distracted';
    b.distractedUntilTick = distract.endsAtTick;
    return;
  }
  if (state.tick < b.distractedUntilTick) { b.state = 'Distracted'; return; }

  // P0 未解决 -> IncidentRush 直奔机房
  const p0 = state.bugs.some((bug) => bug.severity >= 4 && bug.status !== 'resolved');
  let goalZone: string;
  if (phase === 'incident' && p0) { b.state = 'IncidentRush'; goalZone = 'serverRoom'; }
  else if (state.tick <= state.flags.meetingLockUntil) { b.state = 'GroupMeeting'; goalZone = 'meeting'; }
  else { b.state = 'Patrol'; goalZone = BOSS_PATROL[state.bossPatrolIndex % BOSS_PATROL.length]; }

  const spot = ZONE_BY_ID[goalZone]?.spot;
  if (spot) {
    if (manhattan(b.position, spot) === 0) {
      if (b.state === 'Patrol') state.bossPatrolIndex++;
    } else {
      // 事故冲刺移动更快 (2 格/tick)
      const steps = b.state === 'IncidentRush' ? 2 : 1;
      for (let i = 0; i < steps; i++) {
        const nx = nextStep(state.walkable, b.position, spot);
        if (nx) { b.facing = [nx[0] - b.position[0], nx[1] - b.position[1]] as [number, number]; if (b.facing[0] === 0 && b.facing[1] === 0) b.facing = [-1, 0]; b.position = nx; }
      }
    }
  }

  // 怀疑累积 (PRD 12.3)
  let slackersSeen = 0;
  for (const w of state.workers) {
    if (!bossSees(b.position, b.facing, w.position)) continue;
    const label = w.currentAction?.label;
    let delta = 0;
    if (label === 'slacking') { delta = 8; slackersSeen++; }
    else if (label === 'coffee') delta = 2;
    else if (w.currentAction?.type === 'hide') delta = 12;
    else if (w.currentAction?.type === 'fixing') delta = -3;
    if (state.flags.hrCheckUntil >= state.tick && w.reputation < 40) delta += 2;
    if (delta !== 0) {
      const roleMul = w.role === 'intern' ? 0.75 : 1;
      w.suspicion = clamp(w.suspicion + delta * roleMul, 0, 100);
      if (delta > 0 && w.suspicion >= 45 && state.worldRng.chance(1500)) {
        w.visibleBlame = clamp(w.visibleBlame + 4, 0, 100);
        b.targetWorkerId = w.id;
        log(state, 'boss_caught', { workerId: w.id, data: { label } });
      }
    }
  }
  if (slackersSeen >= 2) log(state, 'boss_group_slacking', { data: { count: slackersSeen } });
}

function applyBugDynamics(state: MatchState) {
  for (const bug of state.bugs) {
    if (bug.status === 'resolved' || bug.status === 'exploded') continue;
    state.stability = clamp(state.stability - bug.stabilityDrainPerTick, 0, 100);
    if (bug.progressDrainPerTick) state.releaseProgress = clamp(state.releaseProgress - bug.progressDrainPerTick, 0, 200);
    // 忽略告警：Bug 可见且严重但无人处理，向当前 owner 记一次忽略
    if (!bug.hidden && bug.severity >= 3 && state.tick % 20 === 0 && bug.currentOwnerId) {
      const owner = state.workers.find((w) => w.id === bug.currentOwnerId);
      if (owner && owner.currentAction?.type !== 'fix') { bug.ignoredAlerts.push({ workerId: owner.id, tick: state.tick }); owner.ignoredAlerts++; }
    }
    // 截止爆炸 (PRD 11.5)
    if (state.tick >= bug.deadlineTick) explodeBug(state, bug);
  }
  // 无严重未解决 Bug 时，稳定性缓慢自愈 (避免死亡螺旋)
  const anySevere = state.bugs.some((b) => b.severity >= 3 && b.status !== 'resolved' && b.status !== 'exploded');
  if (!anySevere && state.stability < 100) state.stability = clamp(state.stability + 0.15, 0, 100);
}

function explodeBug(state: MatchState, bug: { id: string; severity: Severity; status: string; hidden?: boolean }) {
  const b = bug as any;
  if (b.severity <= 2) { state.stability = clamp(state.stability - 4, 0, 100); b.status = 'resolved'; }
  else if (b.severity === 3) { state.stability = clamp(state.stability - 8, 0, 100); b.deadlineTick = state.tick + 30; b.severity = 3; }
  else { state.stability = clamp(state.stability - 18, 0, 100); b.status = 'exploded'; log(state, 'bug_exploded', { targetId: b.id, data: { severity: b.severity } }); }
}

function applyPassiveResources(state: MatchState) {
  for (const w of state.workers) {
    // 低精力恢复被动 + 压力自然衰减
    if (!w.currentAction || w.currentAction.type === 'idle') w.energy = clamp(w.energy + 0.3, 0, 100);
    w.stress = clamp(w.stress - 0.1, 0, 100);
    if (w.zone === 'restroom') w.stress = clamp(w.stress - 0.6, 0, 100);
    if (w.energy <= 0 && w.crashUntilTick < state.tick) w.crashUntilTick = state.tick + 15;
    if (state.stability < w.minStabilityWitnessed) w.minStabilityWitnessed = state.stability;
    if (w.minStabilityWitnessed < 30 && state.stability > 50) w.restoredStability = true;
  }
}

function recordFrame(state: MatchState, forcePhase?: string) {
  const phase = (forcePhase as any) || phaseAt(state.tick, state.input.ruleset);
  const frame: ReplayFrame = {
    tick: state.tick,
    phase,
    releaseProgress: Math.round(state.releaseProgress),
    stability: Math.round(state.stability),
    techDebt: Math.round(state.techDebt),
    boss: { pos: [state.boss.position[0], state.boss.position[1]], state: state.boss.state },
    workers: state.workers.map((w) => ({
      id: w.id,
      pos: [w.position[0], w.position[1]],
      label: w.currentAction?.label || 'idle',
      energy: Math.round(w.energy),
      stress: Math.round(w.stress),
      blame: Math.round(w.visibleBlame),
      contribution: Math.round(w.visibleContribution),
      suspicion: Math.round(w.suspicion),
    })),
    bugs: state.bugs.map((b) => ({ id: b.id, severity: b.severity, status: b.status, owner: b.currentOwnerId })),
    activeEvents: state.activeEvents.filter((e) => state.tick < e.endsAtTick).map((e) => e.cardId),
  };
  state.frames.push(frame);
}

function determineResult(state: MatchState): string {
  const r = state.input.ruleset;
  const sc = r.scenario?.successOverride;
  const minStab = sc?.minimumStability ?? r.success.minimumStability;
  const requireShip = sc?.requireShipAction ?? r.success.requireShipAction;
  const forbidExplosion = sc?.forbidExplosion ?? false;
  const unresolvedP0 = state.bugs.some((b) => b.severity >= 4 && b.status !== 'resolved');
  const exploded = state.bugs.some((b) => b.status === 'exploded');
  if (state.releaseProgress < r.success.requiredProgress) return 'fail_incomplete';
  if (state.stability < minStab) return 'fail_crash';
  if (exploded && (forbidExplosion || !r.success.allowUnresolvedP0)) return 'fail_p0';
  if (unresolvedP0 && !r.success.allowUnresolvedP0) return 'fail_p0';
  if (requireShip && !state.shipCompleted) return 'fail_noship';
  return 'success';
}
