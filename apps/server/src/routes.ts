import { Router, type Request, type Response, type NextFunction } from 'express';
import { ROLES, ALL_ROLES, MVP_ROLES, DEFAULT_RULESET, STRATEGY_LIBRARY, RULESET_VERSION, GAME_MODES, APPEARANCE_TEMPLATES, AGENT_PROVIDERS } from '@blame/shared';
import * as accounts from './services/accounts.js';
import * as workers from './services/workers.js';
import * as strategies from './services/strategies.js';
import * as matches from './services/matches.js';
import * as tournaments from './services/tournaments.js';
import * as chain from './chain/gateway.js';
import { generateAppearance } from './services/appearance.js';
import { buildPetPackage } from './services/codexPet.js';
import * as economy from './services/economy.js';
import { db } from './db.js';

export const api = Router();

// ---------- 鉴权中间件 ----------
interface AuthedReq extends Request {
  user?: accounts.User;
  agentWorker?: any;
  agentScopes?: string[];
}

function bearer(req: Request): string | undefined {
  const h = req.header('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : undefined;
}

function requireUser(req: AuthedReq, res: Response, next: NextFunction) {
  const u = accounts.userFromToken(bearer(req));
  if (!u) return res.status(401).json({ code: 'UNAUTHENTICATED' });
  req.user = u;
  next();
}

function optionalUser(req: AuthedReq, _res: Response, next: NextFunction) {
  req.user = accounts.userFromToken(bearer(req)) || undefined;
  next();
}

function ownsWorker(req: AuthedReq, workerId: string): boolean {
  if (!workerId || typeof workerId !== 'string') return false;
  const w = workers.getWorker(workerId);
  return !!w && w.user_id === req.user?.id;
}

// ---------- 公共 ----------
api.get('/health', (_req, res) => res.json({ ok: true, engine: 'engine-0.9.3', ruleset: RULESET_VERSION, time: new Date().toISOString() }));

api.get('/config', (_req, res) => {
  res.json({
    roles: ALL_ROLES.map((r) => ({ ...ROLES[r] })),
    mvpRoles: MVP_ROLES,
    ruleset: DEFAULT_RULESET,
    strategyLibrary: Object.entries(STRATEGY_LIBRARY).map(([k, v]) => ({ id: k, nameKey: v.nameKey, code: v.code })),
    gameModes: GAME_MODES,
    appearanceTemplates: APPEARANCE_TEMPLATES,
    agentProviders: AGENT_PROVIDERS,
    chain: chain.chainInfo(),
  });
});

// 自定义形象生成 (prompt -> 代码渲染 spec，前端用 8-bit 生成器绘制)
api.post('/appearance/generate', requireUser, async (req: AuthedReq, res) => {
  const { role, prompt } = req.body || {};
  res.json(await generateAppearance(req.user!.id + ':' + Date.now(), role || 'engineer', prompt));
});

api.get('/roles', (_req, res) => res.json(ALL_ROLES.map((r) => ROLES[r])));

// ---------- 认证 ----------
api.post('/auth/register', (req, res) => {
  const { email, password, displayName, locale } = req.body || {};
  if (!email || !password) return res.status(400).json({ code: 'MISSING_FIELDS' });
  try {
    res.json(accounts.register(email, password, displayName || email.split('@')[0], locale || 'zh'));
  } catch (e) {
    res.status(409).json({ code: (e as Error).message });
  }
});

api.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  try {
    res.json(accounts.login(email, password));
  } catch (e) {
    res.status(401).json({ code: (e as Error).message });
  }
});

api.post('/auth/guest', (req, res) => res.json(accounts.guest(req.body?.locale || 'zh')));

// RainbowKit 钱包签名登录（前端唯一登录方式）
api.post('/auth/wallet', (req, res) => {
  const { address, message, signature } = req.body || {};
  try {
    res.json(accounts.walletLogin(address, message, signature));
  } catch (e: any) {
    res.status(401).json({ code: e.message || 'BAD_SIGNATURE' });
  }
});

api.get('/auth/me', requireUser, (req: AuthedReq, res) => {
  const wallet = accounts.walletFor(req.user!.id);
  res.json({ user: req.user, wallet });
});

api.post('/auth/locale', requireUser, (req: AuthedReq, res) => {
  accounts.setLocale(req.user!.id, req.body?.locale || 'zh');
  res.json({ ok: true });
});

api.post('/auth/wallet/link', requireUser, (req: AuthedReq, res) => {
  const { address, chainId } = req.body || {};
  if (!address) return res.status(400).json({ code: 'MISSING_ADDRESS' });
  const wid = accounts.linkWallet(req.user!.id, address, chainId || chain.chainInfo().chainId);
  res.json({ ok: true, walletLinkId: wid, wallet: accounts.walletFor(req.user!.id) });
});

// ---------- Workers ----------
api.post('/workers', requireUser, (req: AuthedReq, res) => {
  const { name, role, appearance, personality, agentTool } = req.body || {};
  if (!name || !role) return res.status(400).json({ code: 'MISSING_FIELDS' });
  const w = workers.createWorker(req.user!.id, name, role, appearance || {}, personality || '', agentTool || 'custom');
  res.json(w);
});

api.get('/workers', requireUser, (req: AuthedReq, res) => res.json(workers.listWorkersByUser(req.user!.id)));

api.get('/workers/:id', optionalUser, (req, res) => {
  const w = workers.getWorker(req.params.id);
  if (!w) return res.status(404).json({ code: 'NOT_FOUND' });
  res.json(w);
});

api.patch('/workers/:id', requireUser, (req: AuthedReq, res) => {
  if (!ownsWorker(req, req.params.id)) return res.status(403).json({ code: 'FORBIDDEN' });
  workers.updateWorker(req.params.id, req.body || {});
  res.json(workers.getWorker(req.params.id));
});

api.get('/workers/:id/context', optionalUser, (req, res) => {
  const ctx = workers.workerContext(req.params.id);
  if (!ctx) return res.status(404).json({ code: 'NOT_FOUND' });
  res.json(ctx);
});

// Codex 桌宠包下载 (自包含 zip：桌宠 HTML + 精灵 + AGENTS.md + config)
api.get('/workers/:id/codex-pet.zip', (req: AuthedReq, res) => {
  const token = (req.query.token as string) || bearer(req);
  const user = accounts.userFromToken(token);
  const w = workers.getWorker(req.params.id);
  if (!w) return res.status(404).json({ code: 'NOT_FOUND' });
  if (!w.public_challenge_enabled && (!user || user.id !== w.user_id)) return res.status(403).json({ code: 'FORBIDDEN' });
  const apiBase = process.env.PUBLIC_API_BASE || `${req.protocol}://${req.get('host')}`;
  const zip = buildPetPackage(w, apiBase);
  res.setHeader('content-type', 'application/zip');
  res.setHeader('content-disposition', `attachment; filename="codex-pet-${w.id}.zip"`);
  res.send(zip);
});

// Worker Keys
api.post('/workers/:id/keys', requireUser, (req: AuthedReq, res) => {
  if (!ownsWorker(req, req.params.id)) return res.status(403).json({ code: 'FORBIDDEN' });
  res.json(workers.createKey(req.params.id, req.user!.id, req.body?.name || 'default'));
});
api.get('/workers/:id/keys', requireUser, (req: AuthedReq, res) => {
  if (!ownsWorker(req, req.params.id)) return res.status(403).json({ code: 'FORBIDDEN' });
  res.json(workers.listKeys(req.params.id));
});
api.post('/keys/:keyId/revoke', requireUser, (req, res) => {
  workers.revokeKey(req.params.keyId);
  res.json({ ok: true });
});
api.post('/keys/:keyId/rotate', requireUser, (req, res) => res.json(workers.rotateKey(req.params.keyId)));

// ---------- Strategies / Agent Lab ----------
api.get('/workers/:id/versions', optionalUser, (req, res) => res.json(strategies.listVersions(req.params.id)));
api.get('/versions/:vid', optionalUser, (req, res) => {
  const v = strategies.getVersion(req.params.vid);
  if (!v) return res.status(404).json({ code: 'NOT_FOUND' });
  // 源码仅所有者可见 (PRD 22.5 私有默认)
  const u = accounts.userFromToken(bearer(req));
  const w = workers.getWorker(v.worker_id);
  if (!u || w.user_id !== u.id) delete v.source_code;
  res.json(v);
});

api.post('/workers/:id/simulate', requireUser, (req: AuthedReq, res) => {
  if (!ownsWorker(req, req.params.id)) return res.status(403).json({ code: 'FORBIDDEN' });
  const { sourceCode, suite, baselineVersionId } = req.body || {};
  const code = sourceCode || strategies.getVersion(workers.getWorker(req.params.id).current_ranked_version_id)?.source_code;
  if (suite === 'regression') return res.json(strategies.regression(req.params.id, code, baselineVersionId));
  res.json(strategies.quickSim(req.params.id, code));
});

api.post('/workers/:id/versions', requireUser, (req: AuthedReq, res) => {
  if (!ownsWorker(req, req.params.id)) return res.status(403).json({ code: 'FORBIDDEN' });
  const { sourceCode, changeNotes, riskNotes, submittedBy, model, parentVersionId } = req.body || {};
  if (!sourceCode) return res.status(400).json({ code: 'MISSING_SOURCE' });
  const r = strategies.createVersion(req.params.id, sourceCode, { changeNotes, riskNotes, submittedBy, modelProvider: model?.provider, modelName: model?.name, parentVersionId });
  res.json(r);
});

api.post('/versions/:vid/publish', requireUser, (req: AuthedReq, res) => {
  const v = strategies.getVersion(req.params.vid);
  if (!v || !ownsWorker(req, v.worker_id)) return res.status(403).json({ code: 'FORBIDDEN' });
  try {
    res.json(strategies.publishVersion(req.params.vid, req.body?.branch || 'ranked'));
  } catch (e) {
    res.status(400).json({ code: (e as Error).message });
  }
});

// ---------- Matches / Arena ----------
api.post('/matches/queue', requireUser, (req: AuthedReq, res) => {
  const { workerId, workerIds, players, mode } = req.body || {};
  // 支持多队友：workerIds 为玩家自己的一组员工（均需拥有），均为真实参赛者
  const team: string[] = (Array.isArray(workerIds) && workerIds.length ? workerIds : [workerId]).filter(Boolean).slice(0, 8);
  if (team.length === 0 || !team.every((wid) => ownsWorker(req, wid))) return res.status(403).json({ code: 'FORBIDDEN' });
  const total = Math.max(players || 4, team.length);
  const need = total - team.length;
  const w = workers.getWorker(team[0]);
  const opp = need > 0 ? matches.findOpponents(w, need) : [];
  if (team.length < 2 && opp.length < 1) return res.status(409).json({ code: 'NO_OPPONENTS', message: '暂无可匹配对手，请先创建更多员工或运行 seed' });
  const ids = [...team, ...opp.map((o) => o.id)];
  const { matchId } = matches.runRankedMatch(ids, mode || 'ranked', undefined, mode || 'ranked');
  res.json({ matchId, mode: mode || 'ranked', team, opponents: opp.map((o) => ({ id: o.id, name: o.name, role: o.role, rating: Math.round(o.rating) })) });
});

api.post('/matches/challenge', requireUser, (req: AuthedReq, res) => {
  const { workerId, opponentIds } = req.body || {};
  if (!ownsWorker(req, workerId)) return res.status(403).json({ code: 'FORBIDDEN' });
  const ids = [workerId, ...(opponentIds || [])].slice(0, 4);
  const { matchId } = matches.runRankedMatch(ids, 'challenge');
  res.json({ matchId });
});

api.get('/matches', optionalUser, (req, res) => res.json(matches.recentMatches(Number(req.query.limit) || 30, req.query.workerId as string)));
api.get('/matches/hot', (_req, res) => res.json(matches.hotMatches(8)));
api.get('/matches/:id', (req, res) => {
  const m = matches.getMatch(req.params.id);
  if (!m) return res.status(404).json({ code: 'NOT_FOUND' });
  res.json({ ...m, participants: matches.matchParticipants(req.params.id) });
});
api.get('/matches/:id/replay', (req, res) => {
  const replay = strategies.loadReplay(req.params.id);
  if (!replay) return res.status(404).json({ code: 'NOT_FOUND' });
  res.json(replay);
});
// PRD 23.6 Agent JSON 回放 (不含对手源码)
api.get('/matches/:id/agent.json', (req, res) => {
  const replay = strategies.loadReplay(req.params.id);
  if (!replay) return res.status(404).json({ code: 'NOT_FOUND' });
  const m = matches.getMatch(req.params.id);
  res.json({
    match: { id: m.id, mode: m.mode, engineVersion: m.engine_version, rulesetHash: m.ruleset_hash, mapHash: m.map_hash, eventDeckHash: m.event_deck_hash, seedCommitment: m.server_seed_commit, finalSeed: m.final_seed, startedAt: m.started_at, resultStatus: m.result_status },
    participants: replay.result.participants,
    timeline: replay.timeline,
    responsibilityGraph: replay.result.responsibilityGraph,
    metrics: replay.result.metrics,
    explanations: replay.explanations,
    verification: { replayHash: m.replay_hash, batchRoot: null, chainTxHash: null },
  });
});

api.get('/leaderboards', (req, res) => res.json(matches.leaderboard((req.query.kind as string) || 'rating', 50)));

// ---------- Tournaments ----------
api.get('/tournaments', (_req, res) => res.json(tournaments.listTournaments()));
api.get('/tournaments/:id', (req, res) => {
  const t = tournaments.getTournament(req.params.id);
  if (!t) return res.status(404).json({ code: 'NOT_FOUND' });
  res.json(t);
});
api.post('/tournaments', requireUser, (req: AuthedReq, res) => res.json(tournaments.createTournament({ ...req.body, organizerUserId: req.user!.id })));
api.post('/tournaments/:id/entries', requireUser, (req: AuthedReq, res) => {
  const { workerId } = req.body || {};
  if (!ownsWorker(req, workerId)) return res.status(403).json({ code: 'FORBIDDEN' });
  try {
    res.json(tournaments.enterTournament(req.params.id, workerId, req.user!.id));
  } catch (e) {
    res.status(400).json({ code: (e as Error).message });
  }
});
api.post('/tournaments/:id/run', requireUser, (req, res) => {
  try {
    res.json(tournaments.runTournament(req.params.id));
  } catch (e) {
    res.status(400).json({ code: (e as Error).message });
  }
});
api.post('/tournaments/:id/claim', requireUser, (req: AuthedReq, res) => {
  const { workerId } = req.body || {};
  try {
    res.json(tournaments.claimReward(req.params.id, workerId, req.user!.id));
  } catch (e) {
    res.status(400).json({ code: (e as Error).message });
  }
});

// ---------- Chain ----------
api.get('/chain/info', (_req, res) => res.json({ ...chain.chainInfo(), registry: chain.loadRegistry() ? { contract: 'AdvxRegistry', address: chain.loadRegistry().address, deployTx: chain.loadRegistry().deployTx } : null }));
// NFT 护照卡片预览（与链上 tokenURI 内嵌图同源）
api.get('/chain/passports/:workerId/card.svg', (req, res) => {
  const svg = chain.passportCardSvgFor(req.params.workerId);
  if (!svg) return res.status(404).json({ code: 'NOT_FOUND' });
  res.type('image/svg+xml').send(svg);
});

// ---------- 真实链上：ERC-8004 身份注册 / 商店装饰 NFT / INJ 奖励 ----------
api.post('/chain/erc8004/register', requireUser, async (req: AuthedReq, res) => {
  const { workerId, address } = req.body || {};
  if (!ownsWorker(req, workerId)) return res.status(403).json({ code: 'FORBIDDEN' });
  const to = (address || accounts.walletFor(req.user!.id)?.address_normalized || '').toLowerCase();
  if (!to.startsWith('0x')) return res.status(400).json({ code: 'NO_WALLET', message: '请先连接钱包，NFT 会 mint 到你自己的钱包' });
  const w = workers.getWorker(workerId);
  const uri = `advx://agent/${workerId}?name=${encodeURIComponent(w?.name || '')}`;
  const r = await chain.registerAgentOnChain(to, workerId, uri);
  res.json(r);
});

api.post('/chain/store/mint', requireUser, async (req: AuthedReq, res) => {
  const { item, name, address } = req.body || {};
  const to = (address || accounts.walletFor(req.user!.id)?.address_normalized || '').toLowerCase();
  if (!to.startsWith('0x')) return res.status(400).json({ code: 'NO_WALLET', message: '请先连接钱包，装饰品 NFT 会 mint 到你自己的钱包' });
  const uri = `advx://item/${item || 'cosmetic'}?name=${encodeURIComponent(name || '')}`;
  const r = await chain.mintItemOnChain(to, uri);
  res.json(r);
});

const rewardClaimed = new Map<string, string>(); // userId -> day（小额 INJ，每日限领 1 次）
api.post('/chain/reward/claim', requireUser, async (req: AuthedReq, res) => {
  const wallet = accounts.walletFor(req.user!.id);
  if (!wallet?.address_normalized) return res.status(400).json({ code: 'NO_WALLET', message: '请先连接钱包' });
  const day = new Date().toISOString().slice(0, 10);
  if (rewardClaimed.get(req.user!.id) === day) return res.status(429).json({ code: 'ALREADY_CLAIMED', message: '今日奖励已领取' });
  const r = await chain.sendInjReward(wallet.address_normalized, '0.0002');
  if (!('error' in r)) rewardClaimed.set(req.user!.id, day);
  res.json(r);
});
api.get('/chain/events', (_req, res) => res.json(chain.recentChainEvents(50)));
api.post('/chain/faucet', requireUser, (req: AuthedReq, res) => {
  const wallet = accounts.walletFor(req.user!.id);
  const addr = req.body?.address || wallet?.address_normalized;
  if (!addr) return res.status(400).json({ code: 'NO_WALLET', message: '请先绑定钱包' });
  res.json(chain.faucet(addr));
});
api.get('/chain/balance/:address', (req, res) => res.json({ address: req.params.address, inj: chain.balanceOf(req.params.address, 'INJ') }));
// live 模式：把已有 passport 真实铸到链上（可指定 owner 为用户真实钱包）
api.post('/chain/passport/anchor', requireUser, async (req: AuthedReq, res) => {
  const { workerId, owner } = req.body || {};
  const w = workers.getWorker(workerId);
  if (!w || w.user_id !== req.user!.id) return res.status(404).json({ code: 'WORKER_NOT_FOUND' });
  try {
    res.json(await chain.anchorPassportOnChain(workerId, owner));
  } catch (e: any) {
    res.status(500).json({ code: 'CHAIN_TX_FAILED', message: e?.message || String(e) });
  }
});
api.post('/chain/passport/mint', requireUser, async (req: AuthedReq, res) => {
  const { workerId, address } = req.body || {};
  if (!ownsWorker(req, workerId)) return res.status(403).json({ code: 'FORBIDDEN' });
  // 只认前端连接的钱包地址（单一地址来源），无地址不铸造，避免发到旧/演示地址
  const to = (address || accounts.walletFor(req.user!.id)?.address_normalized || '').toLowerCase();
  if (!to.startsWith('0x')) return res.status(400).json({ code: 'NO_WALLET', message: '请先连接钱包，NFT 会 mint 到你自己的钱包' });
  const w = workers.getWorker(workerId);
  // 真实链上：relayer(合约 owner)把 ERC-8004 身份 NFT mint 到玩家连接的钱包
  const uri = `advx://agent/${workerId}?name=${encodeURIComponent(w?.name || '')}`;
  const onchain = await chain.registerAgentOnChain(to, workerId, uri);
  // 本地护照记录：供 UI 徽章/tokenId 展示，controller = 连接的钱包
  const local = chain.mintPassport(workerId, to, { name: w.name, role: w.role });
  res.json({ ...local, onchain });
});
api.post('/chain/strategy/register', requireUser, (req: AuthedReq, res) => {
  const { workerId, versionId } = req.body || {};
  if (!ownsWorker(req, workerId)) return res.status(403).json({ code: 'FORBIDDEN' });
  const passport = chain.getPassport(workerId);
  if (!passport) return res.status(400).json({ code: 'NO_PASSPORT', message: '请先铸造 Agent Passport' });
  const v = strategies.getVersion(versionId);
  const reg = chain.registerStrategy(passport.token_id, v.source_hash, v.parent_id || '0x0', `/api/versions/${versionId}`);
  db.prepare('UPDATE strategy_versions SET chain_tx_hash=? WHERE id=?').run(reg.txHash, versionId);
  res.json(reg);
});
api.get('/chain/worker-status/:workerId', (req, res) => {
  const passport = chain.getPassport(req.params.workerId);
  const regs = db.prepare('SELECT * FROM strategy_registrations WHERE passport_id = ?').all(passport?.token_id ?? -1);
  res.json({ passport, registrations: regs, network: chain.chainInfo() });
});
api.get('/chain/batches/:batchId/manifest', (req, res) => {
  const b = db.prepare('SELECT * FROM match_batches WHERE batch_id = ?').get(Number(req.params.batchId));
  if (!b) return res.status(404).json({ code: 'NOT_FOUND' });
  res.json(b);
});
api.get('/chain/claims', requireUser, (req: AuthedReq, res) => res.json(tournaments.claimsForUser(req.user!.id)));

// 记录钱包真实交易 (客户端签名后回传)
api.post('/chain/record', requireUser, (req: AuthedReq, res) => {
  const { workerId, kind, txHash, address, chainId } = req.body || {};
  if (!txHash) return res.status(400).json({ code: 'MISSING_TX' });
  res.json(economy.recordAnchor(req.user!.id, workerId || null, kind || 'anchor', txHash, address || '', chainId || 1439));
});
api.get('/chain/anchors', requireUser, (req: AuthedReq, res) => res.json(economy.anchorsForUser(req.user!.id)));

// ---------- 经济模型 ----------
api.get('/economy/me', requireUser, (req: AuthedReq, res) => {
  const uid = req.user!.id;
  res.json({ balance: economy.balance(uid), history: economy.history(uid, 30), stakes: economy.getStakes(uid), seasonPass: economy.seasonPass(uid) });
});
api.get('/economy/tokenomics', (_req, res) => res.json(economy.tokenomics()));
api.get('/economy/market', (_req, res) => res.json(economy.listings()));
api.post('/economy/stake', requireUser, (req: AuthedReq, res) => {
  const { workerId, amount } = req.body || {};
  try { res.json({ stakes: economy.stake(req.user!.id, workerId, Number(amount)), balance: economy.balance(req.user!.id) }); }
  catch (e) { res.status(400).json({ code: (e as Error).message }); }
});
api.post('/economy/unstake', requireUser, (req: AuthedReq, res) => {
  try { res.json({ stakes: economy.unstake(req.user!.id, req.body?.stakeId), balance: economy.balance(req.user!.id) }); }
  catch (e) { res.status(400).json({ code: (e as Error).message }); }
});
api.post('/economy/stake/claim', requireUser, (req: AuthedReq, res) => {
  try { res.json({ stakes: economy.claimYield(req.user!.id, req.body?.stakeId), balance: economy.balance(req.user!.id) }); }
  catch (e) { res.status(400).json({ code: (e as Error).message }); }
});
api.post('/economy/season-pass/buy', requireUser, (req: AuthedReq, res) => {
  try { res.json({ seasonPass: economy.buySeasonPass(req.user!.id), balance: economy.balance(req.user!.id) }); }
  catch (e) { res.status(400).json({ code: (e as Error).message }); }
});
api.post('/economy/market/list', requireUser, (req: AuthedReq, res) => {
  const { item, name, price } = req.body || {};
  try { res.json({ listings: economy.listItem(req.user!.id, item || 'coffee', name || 'Cosmetic', Number(price)) }); }
  catch (e) { res.status(400).json({ code: (e as Error).message }); }
});
api.post('/economy/market/buy', requireUser, (req: AuthedReq, res) => {
  try { res.json(economy.buyListing(req.user!.id, req.body?.listingId)); }
  catch (e) { res.status(400).json({ code: (e as Error).message }); }
});
