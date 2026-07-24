import {
  DEFAULT_RULESET,
  ROLES,
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

export function initState(input: SimulateInput): MatchState {
  const r = input.ruleset;
  const walkable = buildWalkable();

  const workers: EngineWorker[] = input.participants.map((p, i) => {
    const spawn = SPAWN_POINTS[i % SPAWN_POINTS.length];
    const objRng = new Rng(subStreamSeed(input.finalSeed, 'obj:' + p.seat));
    const objDef = SECRET_OBJECTIVES[objRng.int(0, SECRET_OBJECTIVES.length - 1)];
    return {
      id: p.workerId,
      seat: p.seat,
      name: p.name,
      role: p.role,
      position: [spawn[0], spawn[1]],
      zone: zoneAt(spawn[0], spawn[1]),
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
      strategyVersionId: p.strategyVersionId,
      strategyHash: p.strategyHash,
      compiled: compileStrategy(p.sourceCode),
      rng: new Rng(subStreamSeed(input.finalSeed, 'worker:' + p.seat)),
      hardTimeouts: 0,
      invalidActions: 0,
      totalDecisions: 0,
      cpuTotalMs: 0,
      cpuMaxMs: 0,
      actionCounts: {},
      helpedSet: new Set(),
      completedTaskTypes: new Set(),
      fixedOthersBug: false,
      usedForceAssign: false,
      lastPraiseTick: {},
      minStabilityWitnessed: r.resources.initialStability,
      restoredStability: false,
      bugsCreated: 0,
      bugsFixed: 0,
      bugsHidden: 0,
      ignoredAlerts: 0,
      falseStatements: 0,
      validEvidenceUsed: 0,
      totalEvidenceUsed: 0,
      mitigationCredit: 0,
      originResponsibility: 0,
      custodyResponsibility: 0,
      heroicFix: false,
      confessed: false,
    };
  });

  const tasks = generateTasks();

  const boss: BossState = {
    position: [BOSS_SPAWN[0], BOSS_SPAWN[1]],
    zone: zoneAt(BOSS_SPAWN[0], BOSS_SPAWN[1]),
    state: 'Patrol',
    facing: [-1, 0],
    distractedUntilTick: -1,
  };

  return {
    input,
    tick: 0,
    releaseProgress: 0,
    stability: r.resources.initialStability,
    techDebt: 0,
    shipCompleted: false,
    workers,
    boss,
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
