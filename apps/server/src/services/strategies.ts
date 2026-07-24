import { db, now, REPLAY_DIR } from '../db.js';
import fs from 'node:fs';
import path from 'node:path';
import { id, sha256 } from '../util.js';
import { simulateMatch, staticCheck } from '@blame/engine';
import {
  DEFAULT_RULESET,
  STRATEGY_LIBRARY,
  MVP_ROLES,
  RUNTIME_API_VERSION,
  sha256Prefixed,
} from '@blame/shared';
import type { RoleId, SimulateInput, MatchReplay } from '@blame/shared';
import { getWorker } from './workers.js';

const BOT_CODES = [STRATEGY_LIBRARY.firefighter.code, STRATEGY_LIBRARY.grinder.code, STRATEGY_LIBRARY.politician.code, STRATEGY_LIBRARY.balanced.code];

export function getVersion(vid: string): any {
  return db.prepare('SELECT * FROM strategy_versions WHERE id = ?').get(vid);
}

export function listVersions(workerId: string): any[] {
  return db
    .prepare('SELECT id, worker_id, semver, parent_id, submitted_by, model_provider, model_name, change_notes, risk_notes, status, source_hash, chain_tx_hash, created_at, published_at FROM strategy_versions WHERE worker_id = ? ORDER BY created_at')
    .all(workerId) as any[];
}

function nextSemver(workerId: string): string {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM strategy_versions WHERE worker_id = ?').get(workerId) as any).c;
  return `1.${count}.0`;
}

/** 创建候选版本 (draft)，先跑静态检查 (PRD 22.6) */
export function createVersion(
  workerId: string,
  sourceCode: string,
  opts: { parentVersionId?: string; submittedBy?: string; modelProvider?: string; modelName?: string; changeNotes?: string; riskNotes?: string } = {}
) {
  const check = staticCheck(sourceCode, DEFAULT_RULESET.sandbox.sourceBytesMax);
  const vid = id('ver');
  const status = check.ok ? 'tested' : 'rejected';
  const srcHash = sha256(sourceCode);
  db.prepare(
    'INSERT INTO strategy_versions (id, worker_id, semver, parent_id, source_code, source_hash, artifact_hash, compiler_version, runtime_api_version, submitted_by, model_provider, model_name, change_notes, risk_notes, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(
    vid,
    workerId,
    nextSemver(workerId),
    opts.parentVersionId || null,
    sourceCode,
    srcHash,
    sha256('artifact:' + sourceCode),
    'quickjs-1.0',
    RUNTIME_API_VERSION,
    opts.submittedBy || 'agent',
    opts.modelProvider || null,
    opts.modelName || null,
    opts.changeNotes || '',
    opts.riskNotes || '',
    status,
    now()
  );
  return { version: getVersion(vid), staticCheck: check };
}

/** 发布到分支 (PRD 22.7) */
export function publishVersion(vid: string, branch: 'ranked' | 'friday-raid' = 'ranked') {
  const v = getVersion(vid);
  if (!v) throw new Error('VERSION_NOT_FOUND');
  if (v.status === 'rejected') throw new Error('STATIC_CHECK_FAILED');
  db.prepare('UPDATE strategy_versions SET status=?, published_at=? WHERE id=?').run('published', now(), vid);
  const col = branch === 'ranked' ? 'current_ranked_version_id' : 'current_pve_version_id';
  db.prepare(`UPDATE workers SET ${col}=? WHERE id=?`).run(vid, v.worker_id);
  return getVersion(vid);
}

function buildInput(candidateCode: string, role: RoleId, seed: string, matchId: string): SimulateInput {
  const roles: RoleId[] = [role, ...MVP_ROLES.filter((r) => r !== role)].slice(0, 4);
  while (roles.length < 4) roles.push(MVP_ROLES[roles.length % MVP_ROLES.length]);
  return {
    matchId,
    mode: 'training',
    ruleset: DEFAULT_RULESET,
    finalSeed: seed,
    seedCommitment: sha256Prefixed('sim-commit:' + matchId),
    participants: roles.map((r, i) => ({
      workerId: i === 0 ? 'candidate' : 'bot_' + i,
      seat: i,
      name: i === 0 ? 'Candidate' : 'Bot ' + i,
      role: r,
      strategyVersionId: i === 0 ? 'candidate' : 'bot',
      strategyHash: sha256Prefixed('h' + i),
      sourceCode: i === 0 ? candidateCode : BOT_CODES[i % BOT_CODES.length],
    })),
  };
}

function aggregate(replays: MatchReplay[]) {
  const n = replays.length || 1;
  const seat0 = replays.map((r) => r.result.participants.find((p) => p.seat === 0)!);
  return {
    seeds: replays.length,
    projectSuccessRate: round3(replays.filter((r) => r.result.projectSuccess).length / n),
    avgPlacement: round3(seat0.reduce((s, p) => s + p.placement, 0) / n),
    avgFinalScore: round3(seat0.reduce((s, p) => s + p.finalScore, 0) / n),
    avgBlame: round3(seat0.reduce((s, p) => s + p.finalBlame, 0) / n),
    avgContribution: round3(seat0.reduce((s, p) => s + p.verifiedContribution, 0) / n),
    scapegoatRate: round3(seat0.filter((p) => p.scapegoat).length / n),
    p0FixRate: round3(replays.reduce((s, r) => s + (r.result.metrics.p0FixRate || 0), 0) / n),
    invalidActionRate: round3(replays.reduce((s, r) => s + (r.result.metrics.invalidActionRate || 0), 0) / n),
    strategyCpuP95Ms: round3(Math.max(0, ...replays.map((r) => r.result.metrics.strategyCpuP95Ms || 0))),
  };
}

/** Quick Sim: 单种子 (PRD 22.1) */
export function quickSim(workerId: string, candidateCode: string) {
  const w = getWorker(workerId);
  const seed = sha256Prefixed('quick:' + workerId + ':' + Date.now());
  const replay = simulateMatch(buildInput(candidateCode, w.role, seed, 'sim_' + id('q')));
  const runId = id('sim');
  const metrics = aggregate([replay]);
  db.prepare('INSERT INTO simulation_runs (id, worker_id, candidate_hash, suite_type, status, seeds, metrics_json, created_at) VALUES (?,?,?,?,?,?,?,?)').run(
    runId, workerId, sha256(candidateCode), 'quick', 'done', 1, JSON.stringify(metrics), now()
  );
  return { simulationId: runId, status: 'done', metrics, replay: { result: replay.result, timeline: replay.timeline.slice(0, 60) } };
}

/** Regression Suite + A/B (PRD 22.1/22.2) */
export function regression(workerId: string, candidateCode: string, baselineVersionId?: string, seedCount = 12) {
  const w = getWorker(workerId);
  const seeds = Array.from({ length: seedCount }, (_, i) => sha256Prefixed('reg:' + workerId + ':' + i));
  const candReplays = seeds.map((s, i) => simulateMatch(buildInput(candidateCode, w.role, s, 'sim_c' + i)));
  const candMetrics = aggregate(candReplays);

  const baseId = baselineVersionId || w.current_ranked_version_id;
  const baseline = baseId ? getVersion(baseId) : null;
  let baseMetrics: any = null;
  if (baseline) {
    const baseReplays = seeds.map((s, i) => simulateMatch(buildInput(baseline.source_code, w.role, s, 'sim_b' + i)));
    baseMetrics = aggregate(baseReplays);
  }

  const behaviorDiff = baseline ? diffBehavior(baseline.source_code, candidateCode, baseMetrics, candMetrics) : [];
  const runId = id('sim');
  const passesGate = candMetrics.invalidActionRate < 0.03 && candMetrics.strategyCpuP95Ms < DEFAULT_RULESET.sandbox.hardDecisionMs && (!baseMetrics || candMetrics.projectSuccessRate >= baseMetrics.projectSuccessRate - 0.05);
  db.prepare('INSERT INTO simulation_runs (id, worker_id, candidate_hash, baseline_version_id, suite_type, status, seeds, metrics_json, ab_json, behavior_diff_json, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
    runId, workerId, sha256(candidateCode), baseId || null, 'regression', 'done', seedCount, JSON.stringify(candMetrics), JSON.stringify({ candidate: candMetrics, baseline: baseMetrics }), JSON.stringify(behaviorDiff), now()
  );
  return { simulationId: runId, status: 'done', candidate: candMetrics, baseline: baseMetrics, behaviorDiff, passesPublishGate: passesGate };
}

// PRD 22.4 行为差异摘要 (标记 代码推断 / 实测数据)
function diffBehavior(baseCode: string, candCode: string, base: any, cand: any) {
  const out: Array<{ kind: 'code' | 'measured'; textKey: string; delta?: number; text?: string }> = [];
  if (base) {
    push(out, 'measured', 'diff.successRate', cand.projectSuccessRate - base.projectSuccessRate);
    push(out, 'measured', 'diff.avgBlame', cand.avgBlame - base.avgBlame);
    push(out, 'measured', 'diff.p0FixRate', cand.p0FixRate - base.p0FixRate);
    push(out, 'measured', 'diff.contribution', cand.avgContribution - base.avgContribution);
  }
  const sevBase = /severity\s*>=\s*(\d)/.exec(baseCode)?.[1];
  const sevCand = /severity\s*>=\s*(\d)/.exec(candCode)?.[1];
  if (sevBase && sevCand && sevBase !== sevCand) out.push({ kind: 'code', textKey: 'diff.severityThreshold', text: `severity >= ${sevBase} → >= ${sevCand}` });
  if (/fakeWork/.test(candCode) && !/fakeWork/.test(baseCode)) out.push({ kind: 'code', textKey: 'diff.addedFakeWork' });
  if (/rollback|emergencyRollback/.test(candCode) && !/rollback/.test(baseCode)) out.push({ kind: 'code', textKey: 'diff.addedRollback' });
  return out;
}

function push(out: any[], kind: string, textKey: string, delta: number) {
  if (Math.abs(delta) < 0.005) return;
  out.push({ kind, textKey, delta: round3(delta) });
}

export function saveReplay(matchId: string, replay: MatchReplay) {
  const dir = path.join(REPLAY_DIR, matchId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'replay.json'), JSON.stringify(replay));
}

export function loadReplay(matchId: string): MatchReplay | null {
  const p = path.join(REPLAY_DIR, matchId, 'replay.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function round3(v: number) { return Math.round(v * 1000) / 1000; }
