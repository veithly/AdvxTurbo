import { EVENT_DECK, ZONE_BY_ID, BOSS_PATROL, phaseAt, zoneAt, MAP_WIDTH, MAP_HEIGHT } from '@blame/shared';
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

// —— 抓热点：只有在「工位区」开热点才能推进项目进度 ——
const WORKSTATION_ZONES = new Set(['devDesk', 'designDesk', 'qa', 'serverRoom']);
// —— 服务区（由旧的 主舞台/签到台/提交台 改造）——
const REST_ZONE = 'meeting';       // 蓝盒子休息区：回部分精力，最多 3 个位置
const CANTEEN_ZONE = 'hr';         // 食堂：等 5s 加灵感+精力
const HOTEL_ZONE = 'release';      // 酒店排队区：一个一个排，补满精力，30s 冷却
const REST_SLOTS = 3;
const CANTEEN_WAIT_TICKS = 25;     // 5s @5Hz
const HOTEL_SERVE_TICKS = 15;      // 3s @5Hz
const HOTEL_COOLDOWN_TICKS = 150;  // 30s @5Hz
const DQ_EXIT_TICKS = 12; // escort-out frames after DQ, then removed from the floor
const MAX_DQ = 6; // 一局最多取消资格人数（戴戯剧但不全灭）

// 帧标签（驱动前端渲染/解说/气泡）
function hotspotLabel(state: MatchState, w: EngineWorker): string {
  if (w.disqualified) return 'dq';
  if (state.tick < w.bustedUntilTick) return 'busted';
  if (w.hotspotOn) return WORKSTATION_ZONES.has(w.zone) ? 'building' : 'hotspot';
  if (w.zone === HOTEL_ZONE) return 'queuing';
  if (w.zone === CANTEEN_ZONE) return 'eating';
  if (w.zone === REST_ZONE) return 'resting';
  const l = w.currentAction?.label;
  if (l === 'moving') return 'moving';
  if (l === 'coffee') return 'resting';
  return 'lurking';
}

function occupiedByBuilder(state: MatchState, x: number, y: number, exceptId: string): boolean {
  return state.workers.some((w) => !w.disqualified && w.id !== exceptId && w.position[0] === x && w.position[1] === y);
}

// 逃离：向远离最近工作人员的方向走一格（不踩墙/不与其他选手重叠）
function fleeStep(state: MatchState, w: EngineWorker, sp: [number, number]) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let best = w.position; let bestD = manhattan(w.position, sp);
  for (const [dx, dy] of dirs) {
    const nx = w.position[0] + dx, ny = w.position[1] + dy;
    if (nx < 1 || ny < 1 || nx >= MAP_WIDTH - 1 || ny >= MAP_HEIGHT - 1) continue;
    if (!state.walkable[ny] || !state.walkable[ny][nx]) continue;
    if (occupiedByBuilder(state, nx, ny, w.id)) continue;
    const d = manhattan([nx, ny], sp);
    if (d > bestD) { bestD = d; best = [nx, ny]; }
  }
  w.position = [best[0], best[1]]; w.zone = zoneAt(best[0], best[1]);
}

// 选手之间不能重叠：同格的高座位选手移到相邻空格
function resolveOverlaps(state: MatchState) {
  const seen = new Set<string>();
  for (const w of state.workers) {
    if (w.disqualified) continue;
    const key = w.position[0] + ',' + w.position[1];
    if (!seen.has(key)) { seen.add(key); continue; }
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (const [dx, dy] of dirs) {
      const nx = w.position[0] + dx, ny = w.position[1] + dy;
      if (nx < 1 || ny < 1 || nx >= MAP_WIDTH - 1 || ny >= MAP_HEIGHT - 1) continue;
      if (!state.walkable[ny] || !state.walkable[ny][nx]) continue;
      if (seen.has(nx + ',' + ny) || occupiedByBuilder(state, nx, ny, w.id)) continue;
      w.position = [nx, ny]; w.zone = zoneAt(nx, ny); seen.add(nx + ',' + ny); break;
    }
  }
}

/**
 * 抓热点核心循环（确定性）：
 * - 不开热点也极慢地涨；开热点/领 Qoder 额度则大幅增长。
 * - 工作人员靠近(≤2)时选手大概率逃离+关热点；少数“贪婪”者不逃→可能被重合捕捉。
 */
function applyHotspotDynamics(state: MatchState) {
  for (const w of state.workers) {
    if (w.disqualified || state.tick < w.bustedUntilTick) { w.hotspotOn = false; w.signal = clamp(w.signal - 4, 0, 100); w.suspicion = w.signal; continue; }
    let nd = 99; let ns: [number, number] | null = null;
    for (const s of state.staff) { const d = manhattan(s.position, w.position); if (d < nd) { nd = d; ns = s.position; } }
    const threat = nd <= 2;
    const willFlee = threat && w.rng.chance(8000); // 80% 逃离；20% 贪婪继续 build → 风险
    if (threat && willFlee && ns) {
      fleeStep(state, w, ns);
      w.hotspotOn = false; w.signal = clamp(w.signal - 2, 0, 100); w.energy = clamp(w.energy + 0.1, 0, 100);
      w.suspicion = w.signal; continue;
    }
    const atWs = WORKSTATION_ZONES.has(w.zone);
    const qoder = state.tick < w.qoderUntilTick;
    w.hotspotOn = atWs && w.energy > 8;
    let rate = 0.05;
    if (w.hotspotOn) rate = (qoder ? 3 : 1) * (0.35 + 0.65 * w.energy / 100); // 精力越高 build 效率越高
    else if (qoder) rate = 0.6;
    w.visibleContribution += rate;
    w.verifiedContribution += rate;
    state.releaseProgress = clamp(state.releaseProgress + rate * 0.5, 0, 200);
    if (w.hotspotOn) { w.buildTicks++; w.signal = clamp(w.signal + 3, 0, 100); w.energy = clamp(w.energy - 0.6, 0, 100); } // build 明显消耗精力
    else { w.signal = clamp(w.signal - 2, 0, 100); w.energy = clamp(w.energy + 0.15, 0, 100); }
    w.suspicion = w.signal;
  }
  resolveOverlaps(state);
}

// AI 群演选手的便宜移动（不跑沙盒）：走向分配的工位区，到了就停下由 applyHotspotDynamics 自动开热点 build
const FILLER_HOMES = ['devDesk', 'designDesk', 'qa', 'serverRoom'];
function moveFiller(state: MatchState, w: EngineWorker) {
  // 根据精力/灵感自然地去使用各服务区（让新区域有人气），否则回端点 build
  let home: string;
  if (w.energy < 16 && state.tick >= w.hotelCooldownUntil) home = HOTEL_ZONE;   // 太累→酒店补满
  else if (w.energy < 38) home = REST_ZONE;                                     // 累→蓝盒子休息
  else if (w.seat % 6 === 0 && w.inspiration < 45) home = CANTEEN_ZONE;          // 偶尔→食堂加灵感
  else home = FILLER_HOMES[w.seat % FILLER_HOMES.length];
  const spot = ZONE_BY_ID[home]?.spot;
  if (!spot) return;
  if (w.zone === home) { w.currentAction = undefined; return; }
  const nx = nextStep(state.walkable, w.position, spot);
  if (nx) { w.position = nx; w.zone = zoneAt(nx[0], nx[1]); w.currentAction = { type: 'moving', label: 'moving', startedAtTick: state.tick, endsAtTick: state.tick + 1 }; }
}

// 服务区结算（确定性）：休息区回精力(限 3 位) / 食堂等 5s 给灵感+精力 / 灵感来自社交(靠近)与溜达 / 酒店排队补满
function applyZoneServices(state: MatchState) {
  let restUsed = 0;
  for (const w of state.workers) {
    if (w.disqualified || state.tick < w.bustedUntilTick) { w.canteenWait = 0; continue; }
    if (w.zone === REST_ZONE) {
      if (restUsed < REST_SLOTS) { w.energy = clamp(w.energy + 1.4, 0, 100); restUsed++; }
      w.canteenWait = 0;
    } else if (w.zone === CANTEEN_ZONE) {
      w.canteenWait++;
      if (w.canteenWait >= CANTEEN_WAIT_TICKS) { w.inspiration = clamp(w.inspiration + 10, 0, 100); w.energy = clamp(w.energy + 15, 0, 100); w.canteenWait = 0; }
    } else {
      w.canteenWait = 0;
    }
    // 灵感：跟其他选手 social（靠近 ≤2）或多溜达
    let near = 0;
    for (const o of state.workers) { if (o.id !== w.id && !o.disqualified && manhattan(o.position, w.position) <= 2) { if (++near >= 3) break; } }
    if (near > 0) w.inspiration = clamp(w.inspiration + 0.12 * near, 0, 100);
    if (w.currentAction?.label === 'moving') w.inspiration = clamp(w.inspiration + 0.08, 0, 100);
  }
  applyHotel(state);
}

// 酒店排队区：一次只服务一人（3s 补满精力），排到后 30s 冷却
function applyHotel(state: MatchState) {
  if (state.hotelServingId) {
    const w = state.workers.find((x) => x.id === state.hotelServingId);
    if (!w || w.disqualified || w.zone !== HOTEL_ZONE) { state.hotelServingId = undefined; }
    else if (state.tick >= state.hotelServeUntil) { w.energy = 100; w.hotelCooldownUntil = state.tick + HOTEL_COOLDOWN_TICKS; state.hotelServingId = undefined; }
  }
  if (!state.hotelServingId) {
    for (const w of state.workers) {
      if (w.disqualified || w.zone !== HOTEL_ZONE || state.tick < w.hotelCooldownUntil) continue;
      state.hotelServingId = w.id; state.hotelServeUntil = state.tick + HOTEL_SERVE_TICKS; break;
    }
  }
}

// After disqualification: each tick walk toward the nearest exit until off-map (no longer occupies a tile / participates)
function escortOut(state: MatchState, w: EngineWorker) {
  const targetX = w.position[0] < MAP_WIDTH / 2 ? 0 : MAP_WIDTH - 1;
  const dx = Math.sign(targetX - w.position[0]);
  if (dx !== 0) { w.position = [w.position[0] + dx, w.position[1]]; w.zone = zoneAt(w.position[0], w.position[1]); }
  w.currentAction = { type: 'moving', label: 'moving', startedAtTick: state.tick, endsAtTick: state.tick + 1 };
}

function disqualify(state: MatchState, w: EngineWorker) {  w.disqualified = true; w.hotspotOn = false; w.signal = 0; w.suspicion = 0;
  w.visibleBlame = 100; w.bustedUntilTick = 1e9; w.violations++; w.dqAtTick = state.tick;
  log(state, 'disqualified', { workerId: w.id });
}

/** 5 名工作人员在场内巡逻排查（各走不同路线）：只有走到与选手同一格(重合)且对方正开热点才捕捉→取消参赛资格 */
function updateStaff(state: MatchState) {
  for (const s of state.staff) {
    const goalZone = BOSS_PATROL[s.routeIdx % BOSS_PATROL.length];
    const spot = ZONE_BY_ID[goalZone]?.spot;
    if (spot) {
      if (manhattan(s.position, spot) === 0) {
        s.routeIdx++;
      } else {
        const nx = nextStep(state.walkable, s.position, spot);
        if (nx) { s.facing = [nx[0] - s.position[0], nx[1] - s.position[1]] as [number, number]; if (s.facing[0] === 0 && s.facing[1] === 0) s.facing = [-1, 0]; s.position = nx; s.zone = zoneAt(nx[0], nx[1]); }
      }
    }
    // 重合排查：站到正在开热点的选手头上 → 当场取消资格（一局最多拓 MAX_DQ 人，避免全灭）
    for (const w of state.workers) {
      if (w.disqualified) continue;
      if (w.position[0] === s.position[0] && w.position[1] === s.position[1] && w.hotspotOn) {
        const dqCount = state.workers.reduce((n, x) => n + (x.disqualified ? 1 : 0), 0);
        if (dqCount < MAX_DQ) disqualify(state, w);
        break;
      }
    }
    s.targetId = undefined;
  }
  // 让 context/sandbox 的 boss 视图跟随 staff[0]
  if (state.staff[0]) { state.boss.position = [state.staff[0].position[0], state.staff[0].position[1]]; state.boss.facing = state.staff[0].facing; }
}

/** 主入口：运行一整局并返回结果+回放 (PRD 7.2) */
export function simulateMatch(input: SimulateInput): MatchReplay {
  const state = initState(input);
  const r = input.ruleset;

  for (state.tick = 0; state.tick < r.activeTicks; state.tick++) {
    refreshFlags(state);
    maybeDrawEvent(state);
    maybeSpawnIncident(state);
    updateStaff(state);
    // 员工按座位顺序决策/推进 (确定性)
    for (const w of state.workers) {
      if (state.tick < w.crashUntilTick) continue; // 精力崩溃
      if (w.disqualified) { escortOut(state, w); continue; }
      if (w.isFiller) { moveFiller(state, w); continue; } // 群演走便宜路径，不跑沙盒
      if (w.currentAction) advanceAction(state, w);
      if (!w.currentAction) decide(state, w);
    }
    applyBugDynamics(state);
    applyPassiveResources(state);
    applyHotspotDynamics(state);
    applyZoneServices(state);
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

  // 网管拓展：看到正在开热点的选手→当场逐个正着（没收热点/记违规/进度回退）
  let caught = 0;
  for (const w of state.workers) {
    if (state.tick < w.bustedUntilTick) continue;
    if (!w.hotspotOn) continue;
    if (!bossSees(b.position, b.facing, w.position) && manhattan(b.position, w.position) > 1) continue;
    w.visibleContribution = Math.max(0, w.visibleContribution - 15);
    w.violations++;
    w.signal = 0; w.suspicion = 0; w.hotspotOn = false;
    w.visibleBlame = clamp(w.visibleBlame + 12, 0, 100);
    w.bustedUntilTick = state.tick + 20;
    b.targetWorkerId = w.id;
    log(state, 'boss_caught', { workerId: w.id, data: { label: 'hotspot' } });
    caught++;
  }
  if (caught >= 2) log(state, 'boss_group_slacking', { data: { count: caught } });
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
    boss: { pos: [state.staff[0] ? state.staff[0].position[0] : state.boss.position[0], state.staff[0] ? state.staff[0].position[1] : state.boss.position[1]], state: 'Patrol' },
    workers: [
      ...state.workers.filter((w) => !(w.disqualified && state.tick - (w.dqAtTick ?? state.tick) > DQ_EXIT_TICKS)).map((w) => ({
        id: w.id,
        pos: [w.position[0], w.position[1]] as [number, number],
        label: hotspotLabel(state, w),
        energy: Math.round(w.energy),
        stress: Math.round(w.stress),
        inspiration: Math.round(w.inspiration),
        blame: Math.round(w.visibleBlame),
        contribution: Math.round(w.visibleContribution),
        suspicion: Math.round(w.suspicion),
      })),
      ...state.staff.map((s) => ({
        id: s.id,
        pos: [s.position[0], s.position[1]] as [number, number],
        label: 'staff',
        energy: 100, stress: 0, inspiration: 0, blame: 0, contribution: 0, suspicion: 0,
      })),
    ],
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
