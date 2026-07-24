import { ENGINE_VERSION, sha256Prefixed, phaseAt } from '@blame/shared';
import type { MatchResult, MatchParticipantResult, ResponsibilityGraphEntry, Evidence, RulesetScenario } from '@blame/shared';
import type { EngineWorker, MatchState } from './state.js';
import { buildMe, buildCoworkers, buildOffice } from './context.js';

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface RespAcc {
  origin: number;
  custody: number;
  ignoredAlerts: number;
  unauthorizedTransfer: number;
  falseStatement: number;
  mitigation: number;
  raw: number;
}

/** 计算责任模型 (PRD 11.4) */
function computeResponsibility(state: MatchState): Map<string, RespAcc> {
  const acc = new Map<string, RespAcc>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) { a = { origin: 0, custody: 0, ignoredAlerts: 0, unauthorizedTransfer: 0, falseStatement: 0, mitigation: 0, raw: 0 }; acc.set(id, a); }
    return a;
  };
  for (const w of state.workers) get(w.id);

  for (const bug of state.bugs) {
    const sevW = bug.severity || 1;
    const unresolved = bug.status !== 'resolved';
    const exploded = bug.status === 'exploded';
    const weight = sevW * (exploded ? 2 : unresolved ? 1.3 : 0.4);
    if (bug.originWorkerId && acc.has(bug.originWorkerId)) get(bug.originWorkerId).origin += 0.45 * weight;
    if (unresolved && bug.currentOwnerId && acc.has(bug.currentOwnerId)) get(bug.currentOwnerId).custody += 0.2 * weight;
    for (const ia of bug.ignoredAlerts) if (acc.has(ia.workerId)) get(ia.workerId).ignoredAlerts += 0.15 * weight;
    for (const c of bug.custodyChain) if (c.reason === 'forced' && c.from && acc.has(c.from)) get(c.from).unauthorizedTransfer += 0.1 * weight;
    // 隐藏且爆炸的 Bug，隐藏者额外强责任 (PRD 11.5)
    if (bug.hidden && exploded && bug.currentOwnerId && acc.has(bug.currentOwnerId)) get(bug.currentOwnerId).custody += 0.3 * weight;
  }

  for (const w of state.workers) {
    const a = get(w.id);
    a.falseStatement += 0.1 * w.falseStatements * 3;
    a.mitigation = w.mitigationCredit;
    a.raw = a.origin + a.custody + a.ignoredAlerts + a.unauthorizedTransfer + a.falseStatement;
  }
  return acc;
}

/** onAudit + 自动证据结算：让证据影响审计 */
function runAuditActions(state: MatchState) {
  const r = state.input.ruleset;
  const resp = computeResponsibility(state);
  for (const w of state.workers) {
    let auditType = 'staySilent';
    if (w.compiled.ok && w.compiled.hasOnAudit && !w.safeMode) {
      const out = w.compiled.callAudit(buildMe(state, w), buildCoworkers(state, w), buildOffice(state, w), w.rng, r.sandbox.hardDecisionMs);
      if (out.action?.type) auditType = out.action.type;
      if (out.action?.type === 'accuse') settleAccusation(state, w, out.action.workerId, resp);
      if (out.action?.type === 'confess') { w.confessed = true; w.mitigationCredit += 8; w.reputation = clamp(w.reputation + 5, 0, 100); }
    }
    // 自动：用已收集的强证据指向真正责任人 (PRD 12.4)
    for (const ev of w.evidence) {
      if (ev.subjectWorkerId === w.id) continue;
      w.totalEvidenceUsed++;
      const subjResp = resp.get(ev.subjectWorkerId);
      const isValid = subjResp && subjResp.raw > 1.0;
      if (isValid) { w.validEvidenceUsed++; const s = resp.get(ev.subjectWorkerId)!; s.raw += 0.3 * ev.strength; }
      else { w.falseStatements++; }
    }
    w.auditActionType = auditType;
    state.timeline.push({ tick: state.tick, kind: 'audit_action', workerId: w.id, action: auditType });
  }
}

function settleAccusation(state: MatchState, accuser: EngineWorker, targetId: string | undefined, resp: Map<string, RespAcc>) {
  if (!targetId) return;
  accuser.totalEvidenceUsed++;
  const targetResp = resp.get(targetId);
  const hasEvidence = accuser.evidence.some((e) => e.subjectWorkerId === targetId);
  if (targetResp && targetResp.raw > 1.0 && hasEvidence) {
    accuser.validEvidenceUsed++;
    targetResp.raw += 0.5;
    accuser.reputation = clamp(accuser.reputation + 3, 0, 100);
  } else {
    accuser.falseStatements++;
    accuser.reputation = clamp(accuser.reputation - 6, 0, 100);
  }
}

function round2(v: number) { return Math.round(v * 100) / 100; }

/** 最终结算：责任 -> finalBlame -> scapegoat -> 分数 -> 名次 (PRD 18.1) */
export function settle(state: MatchState, projectSuccess: boolean, resultStatus: string): MatchResult {
  runAuditActions(state);
  const resp = computeResponsibility(state);
  const real = state.workers.filter((w) => !w.isFiller); // 只对真实参赛者评分/排名（群演不计）

  // finalBlame
  for (const w of state.workers) {
    const a = resp.get(w.id)!;
    w.originResponsibility = a.origin;
    w.custodyResponsibility = a.custody;
    const blame = state.input.ruleset.resources.initialBlame + a.raw * 7 - a.mitigation * 1.5 + w.suspicion * 0.15;
    w.finalBlame = Math.round(clamp(blame, 0, 100));
  }

  // 秘密目标结算
  for (const w of state.workers) evaluateObjective(state, w, projectSuccess);

  // scapegoat: 最高 finalBlame，tie-break (PRD 12.5)
  const scapegoat = [...real].sort((a, b) => {
    if (b.finalBlame !== a.finalBlame) return b.finalBlame - a.finalBlame;
    if (b.originResponsibility !== a.originResponsibility) return b.originResponsibility - a.originResponsibility;
    if (a.validEvidenceUsed !== b.validEvidenceUsed) return a.validEvidenceUsed - b.validEvidenceUsed;
    if (a.reputation !== b.reputation) return a.reputation - b.reputation;
    return a.rng.next() - b.rng.next();
  })[0];
  scapegoat.scapegoat = true;

  const scenario = state.input.ruleset.scenario;
  const winCond = scenario?.winCondition || 'score';
  const noScape = !!scenario?.noScapegoatPenalty;

  const maxVerified = Math.max(1, ...real.map((w) => w.verifiedContribution));

  for (const w of state.workers) {
    const contributionScore = 25 * (w.verifiedContribution / maxVerified);
    const reputationScore = clamp((w.reputation - 30) * 0.214, 0, 15);
    const evidenceAccuracy = 10 * (w.validEvidenceUsed / Math.max(1, w.totalEvidenceUsed));
    const secretScore = w.secretObjective.achieved ? w.secretObjective.value : 0;
    const qualityBonus = state.techDebt < 15 ? 5 : state.techDebt < 30 ? 2 : 0;
    const blamePenalty = clamp((w.finalBlame - 25) * 0.4, 0, 30);
    const ruleViolation = w.safeMode && w.hardTimeouts >= 3 ? 0 : 0;
    let score: number;
    if (projectSuccess) {
      score = 40 + contributionScore + reputationScore + evidenceAccuracy + secretScore + qualityBonus - blamePenalty - ruleViolation;
      if (w.scapegoat && !noScape) {
        score -= 15; // ScapegoatPenalty
        if (w.heroicFix && w.confessed) score += 8; // 英雄式背锅
      }
    } else {
      const failMitigation = w.mitigationCredit;
      score = 10 * Math.min(1, failMitigation / 20) * 1 + evidenceAccuracy + secretScore * 0.5 - w.originResponsibility * 3 - ruleViolation;
    }
    w.finalScore = Math.round(score * 100) / 100;
  }

  // 关卡胜负条件：不同模式用不同 modeScore 决定名次与冠军（多元玩法）
  const caughtCount = (id: string) => state.timeline.filter((e) => (e.kind === 'boss_caught' || e.kind === 'disqualified') && e.workerId === id).length;
  const modeScore = new Map<string, number>();
  for (const w of real) modeScore.set(w.id, modeScoreFor(w, winCond, projectSuccess, caughtCount(w.id)));

  const ranked = [...real].sort((a, b) => {
    const ma = modeScore.get(a.id)!, mb = modeScore.get(b.id)!;
    if (mb !== ma) return mb - ma;
    if (b.finalScore! !== a.finalScore!) return b.finalScore! - a.finalScore!;
    if (b.verifiedContribution !== a.verifiedContribution) return b.verifiedContribution - a.verifiedContribution;
    if (a.finalBlame !== b.finalBlame) return a.finalBlame - b.finalBlame;
    return a.rng.next() - b.rng.next();
  });
  ranked.forEach((w, i) => (w.placement = i + 1));
  const winner = ranked[0];

  const memeHeat = computeMemeHeat(state, projectSuccess, scapegoat);
  const titleKey = pickTitle(state, projectSuccess, scapegoat, winner, scenario);

  const participants: MatchParticipantResult[] = real
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((w) => ({
      workerId: w.id,
      seat: w.seat,
      role: w.role,
      strategyVersionId: w.strategyVersionId,
      strategyHash: w.strategyHash,
      finalScore: w.finalScore!,
      placement: w.placement!,
      projectSuccess,
      finalBlame: w.finalBlame,
      verifiedContribution: Math.round(w.verifiedContribution),
      reputation: Math.round(w.reputation),
      scapegoat: !!w.scapegoat,
      secretObjectiveAchieved: !!w.secretObjective.achieved,
    }));

  const responsibilityGraph: ResponsibilityGraphEntry[] = real.map((w) => {
    const a = resp.get(w.id)!;
    return { workerId: w.id, finalBlame: w.finalBlame, origin: round2(a.origin), custody: round2(a.custody), ignoredAlerts: round2(a.ignoredAlerts), unauthorizedTransfer: round2(a.unauthorizedTransfer), falseStatement: round2(a.falseStatement), mitigation: round2(a.mitigation) };
  });

  const metrics: Record<string, number> = {
    projectSuccess: projectSuccess ? 1 : 0,
    finalStability: Math.round(state.stability),
    finalProgress: Math.round(state.releaseProgress),
    techDebt: Math.round(state.techDebt),
    bugsTotal: state.bugs.length,
    bugsResolved: state.bugs.filter((b) => b.status === 'resolved').length,
    bugsExploded: state.bugs.filter((b) => b.status === 'exploded').length,
    p0FixRate: p0FixRate(state),
    invalidActionRate: invalidRate(state),
    strategyCpuP95Ms: cpuP95(state),
    memeHeat,
  };

  const input = state.input;
  const resultCore = JSON.stringify({ participants, projectSuccess, scapegoat: scapegoat.id, stability: Math.round(state.stability), progress: Math.round(state.releaseProgress), resultStatus });
  const resultHash = sha256Prefixed(resultCore);
  const replayHash = sha256Prefixed(JSON.stringify(state.frames) + '|' + JSON.stringify(state.timeline));

  return {
    matchId: input.matchId,
    mode: input.mode,
    engineVersion: ENGINE_VERSION,
    rulesetHash: input.ruleset.mapHash || sha256Prefixed(JSON.stringify(input.ruleset)),
    mapHash: sha256Prefixed('open-office-hell'),
    eventDeckHash: sha256Prefixed('event-deck-1'),
    seedCommitment: input.seedCommitment,
    finalSeed: input.finalSeed,
    startedAt: new Date(0).toISOString(),
    finishedAt: new Date(state.tick * input.ruleset.tickMs).toISOString(),
    resultStatus,
    projectSuccess,
    scapegoatWorkerId: scapegoat.id,
    winnerWorkerId: winner.id,
    modeId: scenario?.id || 'ranked',
    winConditionKey: winCond,
    titleKey,
    memeHeat,
    participants,
    responsibilityGraph,
    metrics,
    resultHash,
    replayHash,
  };
}

function evaluateObjective(state: MatchState, w: EngineWorker, projectSuccess: boolean) {
  const o = w.secretObjective;
  switch (o.type) {
    case 'complete_2_types': o.progress = w.completedTaskTypes.size; break;
    case 'fix_others_bug': o.progress = w.fixedOthersBug ? 1 : 0; break;
    case 'energy_60_end': o.progress = Math.round(w.energy); break;
    case 'help_two': o.progress = w.helpedSet.size; break;
    case 'no_forceassign_top3': o.progress = !w.usedForceAssign && (w.placement ?? 99) <= 3 ? 3 : 0; break;
    case 'lowest_blame_success': o.progress = projectSuccess && isLowestBlame(state, w) ? 1 : 0; break;
    case 'last15_firefight': o.progress = w.heroicFix ? 1 : 0; break;
    case 'strong_evidence_correct': o.progress = w.validEvidenceUsed > 0 ? 1 : 0; break;
    case 'three_types': o.progress = w.completedTaskTypes.size; break;
    case 'top_contributor': { const maxC = Math.max(...state.workers.map((x) => x.verifiedContribution)); o.progress = maxC > 0 && w.verifiedContribution >= maxC ? 1 : 0; break; }
    case 'pacifist': o.progress = !w.usedForceAssign && w.falseStatements === 0 && projectSuccess ? 1 : 0; break;
    case 'never_caught': o.progress = state.timeline.some((e) => e.kind === 'boss_caught' && e.workerId === w.id) ? 0 : 1; break;
    case 'be_the_shipper': o.progress = state.timeline.some((e) => e.kind === 'ship' && e.workerId === w.id) ? 1 : 0; break;
  }
  o.achieved = o.progress >= o.target;
}

function isLowestBlame(state: MatchState, w: EngineWorker): boolean {
  return state.workers.every((x) => x.finalBlame >= w.finalBlame);
}

function computeMemeHeat(state: MatchState, projectSuccess: boolean, scapegoat: EngineWorker): number {
  let heat = 0;
  const ship = state.timeline.find((e) => e.kind === 'ship');
  if (ship && ship.tick >= state.input.ruleset.activeTicks - 20) heat += 25; // LastSecondShip
  const maxCustody = Math.max(0, ...state.bugs.map((b) => b.custodyChain.length));
  heat += maxCustody * 4;
  heat += state.workers.reduce((s, w) => s + w.falseStatements, 0) * 18;
  if (state.workers.some((w) => w.heroicFix)) heat += 15;
  if (projectSuccess && scapegoat.finalBlame > 40) heat += 12;
  const bossCatch = state.timeline.filter((e) => e.kind === 'boss_caught').length;
  heat += bossCatch * 20;
  return Math.round(heat);
}

function pickTitle(state: MatchState, projectSuccess: boolean, scapegoat: EngineWorker, winner: EngineWorker, scenario?: RulesetScenario): string {
  const lastShip = state.timeline.find((e) => e.kind === 'ship');
  if (state.bugs.some((b) => b.status === 'exploded')) return 'title.p0Explosion';
  if (!projectSuccess) return 'title.projectFailed';
  if (lastShip && lastShip.tick >= state.input.ruleset.activeTicks - 15) return 'title.lastSecondShip';
  if (scenario && scenario.winCondition !== 'score') return scenario.winnerTitleKey;
  if (winner.role === 'intern' && winner.placement === 1) return 'title.internSaves';
  if (scapegoat.usedForceAssign) return 'title.scopeYoursBlameYours';
  return 'title.shippedButScapegoat';
}

// 各关卡胜者评分（多元输赢条件）
function modeScoreFor(w: EngineWorker, winCond: string, success: boolean, caught: number): number {
  const fs = w.finalScore || 0;
  switch (winCond) {
    case 'contribution': return w.visibleContribution * 1.5 + fs * 0.3; // 抢功之王
    case 'guardian': return fs * 0.3 + (w.role === 'sre' || w.role === 'qa' ? 20 : 0) + w.verifiedContribution * 0.4 - w.ignoredAlerts * 8 + (success ? 20 : 0); // 零事故守护
    case 'stealth': return (100 - w.suspicion) + (success ? 30 : 0) - caught * 40; // 摸鱼之神
    case 'intern': return fs + (w.role === 'intern' ? 45 : 0) - w.finalBlame * 0.5; // 实习生逆袭
    case 'coop': return (success ? 50 : 0) + w.verifiedContribution * 0.5 + w.mitigationCredit; // PvE 共存
    default: return fs;
  }
}

function p0FixRate(state: MatchState): number {
  const p0 = state.bugs.filter((b) => b.severity >= 4);
  if (!p0.length) return 1;
  return Math.round((p0.filter((b) => b.status === 'resolved').length / p0.length) * 100) / 100;
}
function invalidRate(state: MatchState): number {
  const total = state.workers.reduce((s, w) => s + w.totalDecisions, 0) || 1;
  const invalid = state.workers.reduce((s, w) => s + w.invalidActions, 0);
  return Math.round((invalid / total) * 1000) / 1000;
}
function cpuP95(state: MatchState): number {
  const maxes = state.workers.map((w) => w.cpuMaxMs);
  return Math.round(Math.max(0, ...maxes) * 100) / 100;
}
