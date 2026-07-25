// ============================================================================
// 《谁来背锅？ / BLAME GAME》 — 共享类型定义
// 依据 PRD V1.0 第 9/10/11/20/22/23/33/48 节
// ============================================================================

export type RoleId = 'engineer' | 'pm' | 'qa' | 'sre' | 'designer' | 'intern';
export type MatchPhase = 'standup' | 'sprint' | 'incident' | 'freeze' | 'audit';
export type TaskType = 'code' | 'design' | 'qa' | 'ops' | 'product' | 'docs';
export type TaskStatus =
  | 'blocked'
  | 'open'
  | 'claimed'
  | 'working'
  | 'review'
  | 'done'
  | 'failed';
export type BugStatus =
  | 'hidden'
  | 'reported'
  | 'assigned'
  | 'fixing'
  | 'resolved'
  | 'exploded';
export type Severity = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------
// 证据 Evidence (PRD 9.2)
// ---------------------------------------------------------------------------
export interface Evidence {
  id: string;
  type: 'commit' | 'handover' | 'alert' | 'review' | 'promise' | 'witness';
  strength: 1 | 2 | 3 | 4 | 5;
  subjectWorkerId: string;
  bugId?: string;
  sourceEventId: string;
  createdAtTick: number;
  expiresAtTick?: number;
  public: boolean;
}

// ---------------------------------------------------------------------------
// 任务 Task (PRD 10.1)
// ---------------------------------------------------------------------------
export interface OfficeTask {
  id: string;
  type: TaskType;
  titleKey: string;
  complexity: Severity;
  risk: 0 | 1 | 2 | 3 | 4 | 5;
  progressReward: number;
  stabilityImpact: number;
  contributionReward: number;
  energyCost: number;
  requiredZone: string;
  dependencies: string[];
  ownerId?: string;
  status: TaskStatus;
  dueTick?: number;
  hiddenBugChanceBps: number;
  workTicksDone?: number;
  workTicksNeeded?: number;
}

// ---------------------------------------------------------------------------
// Bug (PRD 11.1)
// ---------------------------------------------------------------------------
export interface CustodyEntry {
  from?: string;
  to: string;
  tick: number;
  reason: 'created' | 'assigned' | 'forced' | 'accepted' | 'discovered';
}

export interface Bug {
  id: string;
  severity: Severity;
  status: BugStatus;
  originWorkerId?: string;
  currentOwnerId?: string;
  createdAtTick: number;
  deadlineTick: number;
  progressDrainPerTick: number;
  stabilityDrainPerTick: number;
  evidenceIds: string[];
  custodyChain: CustodyEntry[];
  ignoredAlerts: Array<{ workerId: string; tick: number }>;
  hidden?: boolean;
  fixTicksDone?: number;
}

// ---------------------------------------------------------------------------
// 秘密目标 Secret Objective (PRD 17)
// ---------------------------------------------------------------------------
export interface SecretObjective {
  type: string;
  progress: number;
  target: number;
  value: number; // 0-15
  achieved?: boolean;
}

export interface PromiseState {
  id: string;
  fromWorkerId: string;
  toWorkerId: string;
  taskId: string;
  createdAtTick: number;
  fulfilled: boolean;
}

// ---------------------------------------------------------------------------
// 员工运行时状态 (引擎内部)
// ---------------------------------------------------------------------------
export interface WorkerState {
  id: string;
  seat: number;
  name: string;
  role: RoleId;
  position: [number, number];
  zone: string;
  energy: number;
  stress: number;
  inspiration: number;
  reputation: number;
  visibleBlame: number;
  finalBlame: number;
  suspicion: number;
  visibleContribution: number;
  verifiedContribution: number;
  skillReadyAtTick: number;
  crashUntilTick: number;
  safeMode: boolean;
  currentAction?: ActionState;
  secretObjective: SecretObjective;
  evidence: Evidence[];
  promises: PromiseState[];
  strategyVersionId: string;
  strategyHash: string;
  scapegoat?: boolean;
  finalScore?: number;
  placement?: number;
}

export interface ActionState {
  type: string;
  targetId?: string;
  startedAtTick: number;
  endsAtTick: number;
  label: string; // 可见动作标签: working|slacking|coffee|fixing|moving|meeting|shipping
  interruptIf?: string[];
}

// ---------------------------------------------------------------------------
// 老板 Boss (PRD 12)
// ---------------------------------------------------------------------------
export interface BossState {
  position: [number, number];
  zone: string;
  state: string; // Patrol|Investigate|IncidentRush|GroupMeeting|AuditMode|Distracted
  facing: [number, number];
  targetWorkerId?: string;
  distractedUntilTick: number;
}

// ---------------------------------------------------------------------------
// 事件 Event (PRD 16)
// ---------------------------------------------------------------------------
export interface EventCard {
  id: string;
  nameKey: string;
  intensity: 'low' | 'medium' | 'high';
  weight: number;
  windowPhases: MatchPhase[];
  exclusiveTags: string[];
  durationTicks: number;
  effect: string; // effect key handled by engine
}

export interface ActiveEvent {
  cardId: string;
  nameKey: string;
  startedAtTick: number;
  endsAtTick: number;
  effect: string;
}

// ---------------------------------------------------------------------------
// Ruleset (PRD 65)
// ---------------------------------------------------------------------------
export interface Ruleset {
  schemaVersion: string;
  rulesetId: string;
  mode: string;
  players: number;
  tickMs: number;
  activeTicks: number;
  auditTicks: number;
  success: {
    requiredProgress: number;
    minimumStability: number;
    requireShipAction: boolean;
    allowUnresolvedP0: boolean;
  };
  resources: {
    initialStability: number;
    initialEnergy: number;
    initialStress: number;
    initialReputation: number;
    initialBlame: number;
  };
  sandbox: {
    sourceBytesMax: number;
    heapBytesMax: number;
    softDecisionMs: number;
    hardDecisionMs: number;
    hardTimeoutsBeforeSafeMode: number;
  };
  eventDeckHash: string;
  mapHash: string;
  scoreFormulaVersion: string;
  responsibilityFormulaVersion: string;
  ratingFormulaVersion: string;
  scenario?: RulesetScenario;
}

// 关卡/模式运行时配置（由引擎读取以决定胜负条件）
export interface RulesetScenario {
  id: string;
  winCondition: 'score' | 'contribution' | 'guardian' | 'stealth' | 'intern' | 'coop';
  winnerTitleKey: string;
  successOverride?: { minimumStability?: number; forbidExplosion?: boolean; requireShipAction?: boolean };
  noScapegoatPenalty?: boolean;
  eventBias?: string[];
}

// ---------------------------------------------------------------------------
// 沙盒运行时视图 (PRD 20.6) — 传给策略脚本
// ---------------------------------------------------------------------------
export interface MeContext {
  worker: {
    id: string;
    role: RoleId;
    position: [number, number];
    zone: string;
    energy: number;
    stress: number;
    inspiration: number;
    hotspotOn: boolean;
    signal: number;
    qoderTicksLeft: number;
    hotelCooldownTicks: number;
    sponsorCooldownTicks: number;
    reputation: number;
    visibleBlame: number;
    contribution: number;
    suspicion: number;
    currentAction?: { type: string; label: string; endsInTicks: number };
  };
  skill?: { type: string; ready: boolean; remainingCooldownTicks: number };
  secretObjective: { type: string; progress: number; target: number };
  evidence: Evidence[];
  promises: PromiseState[];
  availableActions: string[];
}

export interface CoworkerView {
  id: string;
  role: RoleId;
  position?: [number, number];
  zone?: string;
  visibleAction?: string;
  publicReputationBand: 'low' | 'medium' | 'high';
  visibleBlameBand: 'low' | 'medium' | 'high';
  relationship?: 'hostile' | 'suspicious' | 'neutral' | 'trusted';
  carryingVisibleBug?: boolean;
}

export interface OfficeTaskView {
  id: string;
  type: TaskType;
  complexity: number;
  risk: number;
  status: TaskStatus;
  blocked: boolean;
  requiredZone: string;
  ownerId?: string;
  impactScore: number;
}

export interface BugView {
  id: string;
  severity: Severity;
  status: BugStatus;
  visible: boolean;
  currentOwnerId?: string;
  deadlineInTicks: number;
  zone?: string;
}

export interface OfficeContext {
  tick: number;
  phase: MatchPhase;
  timeLeftTicks: number;
  releaseProgress: number;
  stability: number;
  techDebt: number;
  boss: {
    visible: boolean;
    position?: [number, number];
    state?: string;
    distanceToMe?: number;
    lookingAtMe?: boolean;
  };
  tasks: OfficeTaskView[];
  bugs: BugView[];
  activeEvents: Array<{ cardId: string; effect: string; endsInTicks: number }>;
  map: { width: number; height: number; zones: string[] };
  // —— 《Advx 极速版》会场视图 ——
  staff: Array<{ id: string; position: [number, number]; distanceToMe: number }>;
  venue: {
    endpoints: string[];
    rest: string;
    canteen: string;
    hotel: string;
    workshop: string;
    sponsor: string;
    restroom: string;
  };
  endpointHeat: Record<string, number>;
  publishReady: boolean;
  deterministicRandomHint?: number;
}

// ---------------------------------------------------------------------------
// 动作返回 (PRD 20.8)
// ---------------------------------------------------------------------------
export type ActionErrorCode =
  | 'ACTION_NOT_AVAILABLE'
  | 'TARGET_NOT_VISIBLE'
  | 'INVALID_TARGET'
  | 'INSUFFICIENT_ENERGY'
  | 'COOLDOWN_ACTIVE'
  | 'PATH_NOT_FOUND'
  | 'TASK_BLOCKED'
  | 'BUG_ALREADY_RESOLVED'
  | 'PHASE_RESTRICTED'
  | 'RATE_LIMITED';

export interface AgentAction {
  type: string;
  taskId?: string;
  bugId?: string;
  workerId?: string;
  zone?: string;
  target?: unknown;
  key?: string;
  debugTag?: string;
  interruptIf?: string[];
}

export interface ActionResult {
  accepted: boolean;
  actionId?: string;
  errorCode?: ActionErrorCode;
  messageKey?: string;
}

// ---------------------------------------------------------------------------
// 回放事件 (PRD 23.6 / 25)
// ---------------------------------------------------------------------------
export interface ReplayEvent {
  tick: number;
  kind: string;
  workerId?: string;
  targetId?: string;
  action?: string;
  outcome?: string;
  errorCode?: string;
  debugTag?: string;
  data?: Record<string, unknown>;
}

export interface WorkerFrame {
  id: string;
  pos: [number, number];
  label: string;
  energy: number;
  stress: number;
  inspiration: number;
  blame: number;
  contribution: number;
  suspicion: number;
}

export interface ReplayFrame {
  tick: number;
  phase: MatchPhase;
  releaseProgress: number;
  stability: number;
  techDebt: number;
  boss: { pos: [number, number]; state: string };
  workers: WorkerFrame[];
  bugs: Array<{ id: string; severity: Severity; status: BugStatus; owner?: string }>;
  activeEvents: string[];
}

export interface ResponsibilityGraphEntry {
  workerId: string;
  finalBlame: number;
  origin: number;
  custody: number;
  ignoredAlerts: number;
  unauthorizedTransfer: number;
  falseStatement: number;
  mitigation: number;
}

export interface MatchParticipantResult {
  workerId: string;
  seat: number;
  role: RoleId;
  strategyVersionId: string;
  strategyHash: string;
  finalScore: number;
  placement: number;
  projectSuccess: boolean;
  finalBlame: number;
  verifiedContribution: number;
  reputation: number;
  scapegoat: boolean;
  secretObjectiveAchieved: boolean;
  ratingBefore?: number;
  ratingAfter?: number;
}

export interface MatchResult {
  matchId: string;
  mode: string;
  engineVersion: string;
  rulesetHash: string;
  mapHash: string;
  eventDeckHash: string;
  seedCommitment: string;
  finalSeed: string;
  startedAt: string;
  finishedAt: string;
  resultStatus: string; // success | fail_incomplete | fail_crash | fail_p0 | fail_noship
  projectSuccess: boolean;
  scapegoatWorkerId?: string;
  winnerWorkerId?: string;
  modeId?: string;
  winConditionKey?: string;
  titleKey: string;
  memeHeat: number;
  participants: MatchParticipantResult[];
  responsibilityGraph: ResponsibilityGraphEntry[];
  metrics: Record<string, number>;
  resultHash: string;
  replayHash: string;
}

export interface MatchReplay {
  result: MatchResult;
  frames: ReplayFrame[];
  timeline: ReplayEvent[];
  explanations: ReplayEvent[];
}

// ---------------------------------------------------------------------------
// 引擎输入
// ---------------------------------------------------------------------------
export interface EngineParticipant {
  workerId: string;
  seat: number;
  name: string;
  role: RoleId;
  strategyVersionId: string;
  strategyHash: string;
  sourceCode: string;
}

export interface SimulateInput {
  matchId: string;
  mode: string;
  ruleset: Ruleset;
  finalSeed: string;
  seedCommitment: string;
  participants: EngineParticipant[];
}

// ---------------------------------------------------------------------------
// 策略版本 (PRD 22.5)
// ---------------------------------------------------------------------------
export interface StrategyVersion {
  id: string;
  workerId: string;
  semanticVersion: string;
  parentVersionId?: string;
  sourceHash: string;
  compiledArtifactHash: string;
  submittedBy: 'human' | 'agent' | 'import';
  modelProvider?: string;
  modelName?: string;
  changeNotes: string;
  riskNotes?: string;
  createdAt: string;
  publishedAt?: string;
  status: 'draft' | 'tested' | 'published' | 'frozen' | 'rejected';
  chainRegistrationTx?: string;
}

export interface Role {
  id: RoleId;
  nameKey: string;
  emoji: string;
  asset: string;
  skill: { type: string; nameKey: string; cooldownTicks: number };
  passiveKey: string;
  personalityKeys: string[];
  mvp: boolean;
}
