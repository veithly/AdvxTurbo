import { ROLES, ZONE_BY_ID, phaseAt } from '@blame/shared';
import type { MeContext, CoworkerView, OfficeContext, OfficeTaskView, BugView } from '@blame/shared';
import type { EngineWorker, MatchState } from './state.js';
import { bossSees, manhattan } from './pathfind.js';

function band(v: number): 'low' | 'medium' | 'high' {
  if (v < 34) return 'low';
  if (v < 67) return 'medium';
  return 'high';
}

export function bossLookingAt(state: MatchState, w: EngineWorker): boolean {
  if (state.boss.state === 'Distracted') return false;
  return bossSees(state.boss.position, state.boss.facing, w.position);
}

export function availableActions(state: MatchState, w: EngineWorker): string[] {
  const phase = phaseAt(state.tick, state.input.ruleset);
  const base = ['moveTo', 'coffee', 'fakeWork', 'useSkill', 'speak', 'idle'];
  if (phase === 'audit') return ['submitEvidence', 'accuse', 'defend', 'confess', 'staySilent'];
  const acts = [...base, 'claimTask', 'work', 'help', 'inspect', 'review', 'fix', 'assign', 'ship', 'rollback', 'hide', 'disclose', 'takeCredit', 'promise', 'praise'];
  return acts;
}

export function buildMe(state: MatchState, w: EngineWorker): MeContext {
  const role = ROLES[w.role];
  const skillReady = state.tick >= w.skillReadyAtTick;
  return {
    worker: {
      id: w.id,
      role: w.role,
      position: [w.position[0], w.position[1]],
      zone: w.zone,
      energy: Math.round(w.energy),
      stress: Math.round(w.stress),
      reputation: Math.round(w.reputation),
      visibleBlame: Math.round(w.visibleBlame),
      contribution: Math.round(w.visibleContribution),
      suspicion: Math.round(w.suspicion),
      currentAction: w.currentAction
        ? { type: w.currentAction.type, label: w.currentAction.label, endsInTicks: Math.max(0, w.currentAction.endsAtTick - state.tick) }
        : undefined,
    },
    skill: {
      type: role.skill.type,
      ready: skillReady,
      remainingCooldownTicks: Math.max(0, w.skillReadyAtTick - state.tick),
    },
    secretObjective: { type: w.secretObjective.type, progress: w.secretObjective.progress, target: w.secretObjective.target },
    evidence: w.evidence.map((e) => ({ ...e })),
    promises: w.promises.map((p) => ({ ...p })),
    availableActions: availableActions(state, w),
  };
}

export function buildCoworkers(state: MatchState, self: EngineWorker): CoworkerView[] {
  const revealed = state.tick <= state.flags.bossRevealUntil;
  return state.workers
    .filter((w) => w.id !== self.id)
    .map((w) => {
      const carrying = state.bugs.some((b) => b.currentOwnerId === w.id && b.status !== 'resolved' && !b.hidden);
      const rel: CoworkerView['relationship'] =
        w.reputation < 35 ? 'suspicious' : w.reputation > 70 ? 'trusted' : 'neutral';
      return {
        id: w.id,
        role: w.role,
        position: [w.position[0], w.position[1]],
        zone: w.zone,
        visibleAction: revealed ? w.currentAction?.label : w.currentAction?.label === 'slacking' ? undefined : w.currentAction?.label,
        publicReputationBand: band(w.reputation),
        visibleBlameBand: band(w.visibleBlame),
        relationship: rel,
        carryingVisibleBug: carrying,
      };
    });
}

function impactScore(t: { progressReward: number; complexity: number; risk: number }): number {
  return t.progressReward * 2 - t.complexity - t.risk;
}

export function buildOffice(state: MatchState, self: EngineWorker): OfficeContext {
  const r = state.input.ruleset;
  const phase = phaseAt(state.tick, r);
  const bossVisible = state.boss.state !== 'Distracted';
  const dist = manhattan(state.boss.position, self.position);
  const tasks: OfficeTaskView[] = state.tasks.map((t) => ({
    id: t.id,
    type: t.type,
    complexity: t.complexity,
    risk: t.risk,
    status: t.status,
    blocked: t.status === 'blocked',
    requiredZone: t.requiredZone,
    ownerId: t.ownerId,
    impactScore: impactScore(t),
  }));
  const bugs: BugView[] = state.bugs.map((b) => ({
    id: b.id,
    severity: b.severity,
    status: b.status,
    visible: !b.hidden && b.status !== 'resolved',
    currentOwnerId: b.currentOwnerId,
    deadlineInTicks: Math.max(0, b.deadlineTick - state.tick),
    zone: 'serverRoom',
  }));
  return {
    tick: state.tick,
    phase,
    timeLeftTicks: Math.max(0, r.activeTicks - state.tick),
    releaseProgress: Math.round(state.releaseProgress),
    stability: Math.round(state.stability),
    techDebt: Math.round(state.techDebt),
    boss: {
      visible: bossVisible,
      position: bossVisible ? [state.boss.position[0], state.boss.position[1]] : undefined,
      state: state.boss.state,
      distanceToMe: dist,
      lookingAtMe: bossLookingAt(state, self),
    },
    tasks,
    bugs,
    activeEvents: state.activeEvents.map((e) => ({ cardId: e.cardId, effect: e.effect, endsInTicks: Math.max(0, e.endsAtTick - state.tick) })),
    map: { width: 20, height: 14, zones: Object.keys(ZONE_BY_ID) },
    publishReady: computePublishReady(state),
    deterministicRandomHint: undefined,
  };
}

export function computePublishReady(state: MatchState): boolean {
  const r = state.input.ruleset;
  const unresolvedP0 = state.bugs.some((b) => b.severity >= 4 && b.status !== 'resolved');
  return (
    state.releaseProgress >= r.success.requiredProgress &&
    state.stability >= r.success.minimumStability &&
    !(unresolvedP0 && !r.success.allowUnresolvedP0)
  );
}
