import { Router, type Request, type Response, type NextFunction } from 'express';
import { db } from './db.js';
import * as workers from './services/workers.js';
import * as strategies from './services/strategies.js';
import * as matches from './services/matches.js';
import * as tournaments from './services/tournaments.js';
import * as chain from './chain/gateway.js';

// PRD 23 Agent REST API —— Authorization: Bearer <worker_key>
export const agentApi = Router();

interface AgentReq extends Request {
  worker?: any;
  scopes?: string[];
}

function agentAuth(scope?: string) {
  return (req: AgentReq, res: Response, next: NextFunction) => {
    const h = req.header('authorization') || '';
    const key = h.startsWith('Bearer ') ? h.slice(7) : undefined;
    const found = workers.workerFromKey(key);
    if (!found) return res.status(401).json({ code: 'INVALID_WORKER_KEY', message: 'Worker Key 无效或已吊销' });
    if (scope && !found.scopes.includes(scope)) return res.status(403).json({ code: 'SCOPE_REQUIRED', message: `需要 scope: ${scope}` });
    req.worker = found.worker;
    req.scopes = found.scopes;
    res.setHeader('X-Ruleset-Version', '2026.07.1');
    next();
  };
}

// GET /agent/worker — 员工上下文 (PRD 23.3)
agentApi.get('/agent/worker', agentAuth('worker:read'), (req: AgentReq, res) => {
  res.json(workers.workerContext(req.worker.id));
});

// GET /agent/worker/strategy — 当前分支与版本
agentApi.get('/agent/worker/strategy', agentAuth('strategy:read'), (req: AgentReq, res) => {
  const w = req.worker;
  const v = strategies.getVersion(w.current_ranked_version_id);
  res.json({
    currentBranches: { ranked: w.current_ranked_version_id, 'friday-raid': w.current_pve_version_id },
    version: v ? { id: v.id, semver: v.semver, changeNotes: v.change_notes, sourceHash: v.source_hash, status: v.status, sourceCode: v.source_code } : null,
    versions: strategies.listVersions(w.id),
  });
});

// POST /agent/worker/simulations — 创建模拟 (PRD 23.4)
agentApi.post('/agent/worker/simulations', agentAuth('strategy:simulate'), (req: AgentReq, res) => {
  const code = req.body?.candidate?.sourceCode;
  if (!code) return res.status(400).json({ code: 'MISSING_SOURCE' });
  const suite = req.body?.suite?.type || 'quick';
  const out = suite === 'regression'
    ? strategies.regression(req.worker.id, code, req.body?.suite?.baselineVersionId)
    : strategies.quickSim(req.worker.id, code);
  res.json({ simulationId: out.simulationId, status: 'done', result: out });
});

agentApi.get('/agent/worker/simulations/:id', agentAuth('strategy:simulate'), (req, res) => {
  const row = db.prepare('SELECT * FROM simulation_runs WHERE id = ?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ code: 'NOT_FOUND' });
  res.json({ ...row, metrics: JSON.parse(row.metrics_json || '{}'), ab: JSON.parse(row.ab_json || 'null'), behaviorDiff: JSON.parse(row.behavior_diff_json || '[]') });
});

// POST /agent/worker/compare — 新旧 A/B
agentApi.post('/agent/worker/compare', agentAuth('strategy:simulate'), (req: AgentReq, res) => {
  const code = req.body?.candidate?.sourceCode;
  if (!code) return res.status(400).json({ code: 'MISSING_SOURCE' });
  res.json(strategies.regression(req.worker.id, code, req.body?.baselineVersionId, req.body?.seedCount || 12));
});

// POST /agent/worker/versions — 创建版本 (PRD 23.5)
agentApi.post('/agent/worker/versions', agentAuth('strategy:publish'), (req: AgentReq, res) => {
  const { sourceCode, parentVersionId, submittedBy, model, changeNotes, riskNotes } = req.body || {};
  if (!sourceCode) return res.status(400).json({ code: 'MISSING_SOURCE' });
  const out = strategies.createVersion(req.worker.id, sourceCode, { parentVersionId, submittedBy: submittedBy || 'agent', modelProvider: model?.provider, modelName: model?.name, changeNotes, riskNotes });
  if (!out.staticCheck.ok) return res.status(422).json({ code: 'STATIC_CHECK_FAILED', errors: out.staticCheck.errors, version: out.version });
  res.json(out);
});

// POST /agent/worker/versions/:id/publish
agentApi.post('/agent/worker/versions/:id/publish', agentAuth('strategy:publish'), (req: AgentReq, res) => {
  const v = strategies.getVersion(req.params.id);
  if (!v || v.worker_id !== req.worker.id) return res.status(404).json({ code: 'NOT_FOUND' });
  try {
    res.json(strategies.publishVersion(req.params.id, req.body?.branch || 'ranked'));
  } catch (e) {
    res.status(400).json({ code: (e as Error).message });
  }
});

// GET /agent/worker/matches
agentApi.get('/agent/worker/matches', agentAuth('match:read'), (req: AgentReq, res) => {
  res.json(matches.recentMatches(20, req.worker.id));
});

// POST /agent/worker/challenges — 发起正式挑战
agentApi.post('/agent/worker/challenges', agentAuth('challenge:create'), (req: AgentReq, res) => {
  const opp = matches.findOpponents(req.worker, 3);
  if (!opp.length) return res.status(409).json({ code: 'NO_OPPONENTS' });
  const { matchId } = matches.runRankedMatch([req.worker.id, ...opp.map((o: any) => o.id)], 'ranked');
  res.json({ matchId, agentReplayUrl: `/api/matches/${matchId}/agent.json` });
});

// GET /opponents
agentApi.get('/opponents', agentAuth('worker:read'), (req: AgentReq, res) => {
  res.json(matches.findOpponents(req.worker, 10).map((o: any) => ({ id: o.id, name: o.name, role: o.role, rating: Math.round(o.rating) })));
});

// GET /leaderboards
agentApi.get('/leaderboards', agentAuth('worker:read'), (req, res) => res.json(matches.leaderboard('rating', 50)));

// GET /tournaments & enter
agentApi.get('/tournaments', agentAuth('tournament:read'), (_req, res) => res.json(tournaments.listTournaments()));
agentApi.post('/tournaments/:id/entries', agentAuth('tournament:enter_free'), (req: AgentReq, res) => {
  try {
    res.json(tournaments.enterTournament(req.params.id, req.worker.id, req.worker.user_id));
  } catch (e) {
    res.status(400).json({ code: (e as Error).message });
  }
});

// GET /chain/worker-status
agentApi.get('/chain/worker-status', agentAuth('worker:read'), (req: AgentReq, res) => {
  const passport = chain.getPassport(req.worker.id);
  res.json({ network: chain.chainInfo().network, passportMinted: !!passport, passportTokenId: passport ? String(passport.token_id) : null });
});
