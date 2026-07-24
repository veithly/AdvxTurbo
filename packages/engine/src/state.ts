import {
  DEFAULT_RULESET,
  ROLES,
  ALL_ROLES,
  DEFAULT_STRATEGY,
  SECRET_OBJECTIVES,
  SPAWN_POINTS,
  BOSS_SPAWN,
  TASK_TEMPLATES,
  TASK_DEPENDENCIES,
  buildWalkable,
  zoneAt,
  Rng,
  subStreamSeed,
} from '@blame/shared';
import type {
  Bug,
  BossState,
  OfficeTask,
  ReplayEvent,
  ReplayFrame,
  SimulateInput,
  WorkerState,
  Evidence,
  ActiveEvent,
} from '@blame/shared';
import { compileStrategy, type CompiledStrategy } from './sandbox.js';
import type { Grid } from './pathfind.js';

export interface EngineWorker extends WorkerState {
  compiled: CompiledStrategy;
  rng: Rng;
  target?: [number, number];
  targetZone?: string;
  hardTimeouts: number;
  invalidActions: number;
  totalDecisions: number;
  cpuTotalMs: number;
  cpuMaxMs: number;
  actionCounts: Record<string, number>;
  helpedSet: Set<string>;
  completedTaskTypes: Set<string>;
  fixedOthersBug: boolean;
  usedForceAssign: boolean;
  lastPraiseTick: Record<string, number>;
  minStabilityWitnessed: number;
  restoredStability: boolean;
  bugsCreated: number;
  bugsFixed: number;
  bugsHidden: number;
  ignoredAlerts: number;
  falseStatements: number;
  validEvidenceUsed: number;
  totalEvidenceUsed: number;
  mitigationCredit: number;
  originResponsibility: number;
  custodyResponsibility: number;
  heroicFix: boolean;
  confessed: boolean;
  auditActionType?: string;
  // —— 抓热点机制 ——
  hotspotOn: boolean;      // 是否正在开热点
  signal: number;          // 热点信号强度(=heat)，被网管探测
  violations: number;      // 被抓/违规次数
  bustedUntilTick: number; // 被抓后冷却结束 tick
  buildTicks: number;      // 有效 build tick 数
  qoderUntilTick: number;  // Qoder 冲刺结束 tick
  isFiller: boolean;       // AI 群演选手（不计入真实排名）
  disqualified: boolean;   // 被拓→取消参赛资格
}

// 工作人员（AI，逐个排查，重合才捕捉）
export interface StaffAgent {
  id: string;
  position: [number, number];
  facing: [number, number];
  zone: string;
  targetId?: string;
  routeIdx: number;
  rng: Rng;
}

export interface MatchFlags {
  wifiDown: boolean;
  dbReadonly: boolean;
  coffeeBroken: boolean;
  friday6pm: boolean;
  securityAudit: boolean;
  meetingLockUntil: number;
  bossRevealUntil: number;
  hrCheckUntil: number;
}

export interface MatchState {
  input: SimulateInput;
  tick: number;
  releaseProgress: number;
  stability: number;
  techDebt: number;
  shipCompleted: boolean;
  workers: EngineWorker[];
  boss: BossState;
  staff: StaffAgent[];
  bossPatrolIndex: number;
  bossRng: Rng;
  worldRng: Rng;
  tasks: OfficeTask[];
  bugs: Bug[];
  bugCounter: number;
  evidenceCounter: number;
  activeEvents: ActiveEvent[];
  usedEventIds: Set<string>;
  lastEventTick: number;
  walkable: Grid;
  frames: ReplayFrame[];
  timeline: ReplayEvent[];
  explanations: ReplayEvent[];
  flags: MatchFlags;
}

export const TARGET_BUILDERS = 20;
export const STAFF_COUNT = 5;

// 选手初始散布位置（确定性）
function builderSpawn(i: number): [number, number] {
  const cols = 9;
  const x = 2 + (i % cols) * 2;
  const y = 2 + Math.floor(i / cols) * 3;
  return [Math.min(x, 18), Math.min(y, 12)];
}

// 单个员工工厂（真实选手与 AI 群演共用）
function makeWorker(input: SimulateInput, seat: number, id: string, name: string, role: any, sourceCode: string, versionId: string, hash: string, isFiller: boolean, pos: [number, number]): EngineWorker {
  const r = input.ruleset;
  const objRng = new Rng(subStreamSeed(input.finalSeed, 'obj:' + seat));
  const objDef = SECRET_OBJECTIVES[objRng.int(0, SECRET_OBJECTIVES.length - 1)];
  return {
    id, seat, name, role,
    position: [pos[0], pos[1]],
    zone: zoneAt(pos[0], pos[1]),
    energy: r.resources.initialEnergy,
    stress: r.resources.initialStress,
    reputation: r.resources.initialReputation,
    visibleBlame: r.resources.initialBlame,
    finalBlame: r.resources.initialBlame,
    suspicion: 0,
    visibleContribution: 0,
    verifiedContribution: 0,
    skillReadyAtTick: 0,
    crashUntilTick: -1,
    safeMode: false,
    secretObjective: { type: objDef.type, progress: 0, target: objDef.target, value: objDef.value, achieved: false },
    evidence: [] as Evidence[],
    promises: [],
    strategyVersionId: versionId,
    strategyHash: hash,
    compiled: compileStrategy(sourceCode || ''),
    rng: new Rng(subStreamSeed(input.finalSeed, 'worker:' + seat)),
    hardTimeouts: 0, invalidActions: 0, totalDecisions: 0, cpuTotalMs: 0, cpuMaxMs: 0,
    actionCounts: {}, helpedSet: new Set(), completedTaskTypes: new Set(),
    fixedOthersBug: false, usedForceAssign: false, lastPraiseTick: {},
    minStabilityWitnessed: r.resources.initialStability, restoredStability: false,
    bugsCreated: 0, bugsFixed: 0, bugsHidden: 0, ignoredAlerts: 0, falseStatements: 0,
    validEvidenceUsed: 0, totalEvidenceUsed: 0, mitigationCredit: 0,
    originResponsibility: 0, custodyResponsibility: 0, heroicFix: false, confessed: false,
    hotspotOn: false, signal: 0, violations: 0, bustedUntilTick: -1, buildTicks: 0, qoderUntilTick: -1,
    isFiller, disqualified: false,
  };
}

export function initState(input: SimulateInput): MatchState {
  const r = input.ruleset;
  const walkable = buildWalkable();

  const workers: EngineWorker[] = input.participants.map((p) =>
    makeWorker(input, p.seat, p.workerId, p.name, p.role, p.sourceCode, p.strategyVersionId, p.strategyHash, false, builderSpawn(p.seat))
  );
  // 填充到 ~20 名选手（AI 群演，空策略=走内置便宜路径，不跑沙盒；不进入真实排名/评分）
  for (let i = workers.length; i < TARGET_BUILDERS; i++) {
    const role = ALL_ROLES[i % ALL_ROLES.length];
    workers.push(makeWorker(input, i, 'fb_' + i, '选手' + (i + 1), role, '', 'filler', 'filler', true, builderSpawn(i)));
  }

  const tasks = generateTasks();

  const boss: BossState = {
    position: [BOSS_SPAWN[0], BOSS_SPAWN[1]],
    zone: zoneAt(BOSS_SPAWN[0], BOSS_SPAWN[1]),
    state: 'Patrol',
    facing: [-1, 0],
    distractedUntilTick: -1,
  };

  // 5 名工作人员（AI 逐个排查）
  const staffSpots: Array<[number, number]> = [[16, 10], [10, 2], [16, 2], [3, 6], [13, 6]];
  const staff: StaffAgent[] = [];
  for (let i = 0; i < STAFF_COUNT; i++) {
    const sp = staffSpots[i % staffSpots.length];
    staff.push({ id: 'staff' + i, position: [sp[0], sp[1]], facing: [-1, 0], zone: zoneAt(sp[0], sp[1]), routeIdx: i * 2, rng: new Rng(subStreamSeed(input.finalSeed, 'staff:' + i)) });
  }

  return {
    input,
    tick: 0,
    releaseProgress: 0,
    stability: r.resources.initialStability,
    techDebt: 0,
    shipCompleted: false,
    workers,
    boss,
    staff,
    bossPatrolIndex: 0,
    bossRng: new Rng(subStreamSeed(input.finalSeed, 'boss')),
    worldRng: new Rng(subStreamSeed(input.finalSeed, 'world')),
    tasks,
    bugs: [],
    bugCounter: 0,
    evidenceCounter: 0,
    activeEvents: [],
    usedEventIds: new Set(),
    lastEventTick: -100,
    walkable,
    frames: [],
    timeline: [],
    explanations: [],
    flags: {
      wifiDown: false,
      dbReadonly: false,
      coffeeBroken: false,
      friday6pm: false,
      securityAudit: false,
      meetingLockUntil: -1,
      bossRevealUntil: -1,
      hrCheckUntil: -1,
    },
  };
}

function generateTasks(): OfficeTask[] {
  const tasks: OfficeTask[] = [];
  const idByTitle: Record<string, string> = {};
  TASK_TEMPLATES.forEach((tpl, i) => {
    const id = 't' + i;
    idByTitle[tpl.titleKey] = id;
  });
  TASK_TEMPLATES.forEach((tpl, i) => {
    const id = 't' + i;
    const depTitles = TASK_DEPENDENCIES[tpl.titleKey] || [];
    const dependencies = depTitles.map((t) => idByTitle[t]).filter(Boolean);
    const workNeeded = 6 + tpl.complexity * 4; // PRD 15.3 复杂度1≈10, 复杂度5≈35 (含 base)
    tasks.push({
      id,
      type: tpl.type,
      titleKey: tpl.titleKey,
      complexity: tpl.complexity,
      risk: tpl.risk,
      progressReward: tpl.progressReward,
      stabilityImpact: tpl.stabilityImpact,
      contributionReward: tpl.contributionReward,
      energyCost: tpl.energyCost,
      requiredZone: tpl.requiredZone,
      dependencies,
      status: dependencies.length ? 'blocked' : 'open',
      hiddenBugChanceBps: tpl.hiddenBugChanceBps,
      workTicksDone: 0,
      workTicksNeeded: workNeeded,
    });
  });
  return tasks;
}

export { DEFAULT_RULESET, ROLES };
