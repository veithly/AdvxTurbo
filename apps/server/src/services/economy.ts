import { db, now } from '../db.js';
import { id } from '../util.js';

// ============================================================================
// 经济模型：Coffee Points (CP) 软通证 + 质押 + 赛季通行证 + 装饰交易市场 + 通证学统计
// 全部链下账本可跑通；链上奖金由 TournamentEscrow / 钱包真实交易承载。
// ============================================================================

db.exec(`
CREATE TABLE IF NOT EXISTS economy_ledger (
  id TEXT PRIMARY KEY, user_id TEXT, delta INTEGER, reason TEXT, ref TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS stakes (
  id TEXT PRIMARY KEY, user_id TEXT, worker_id TEXT, amount INTEGER,
  active INTEGER DEFAULT 1, yield_pending INTEGER DEFAULT 0, yield_total INTEGER DEFAULT 0, created_at TEXT
);
CREATE TABLE IF NOT EXISTS season_pass (
  user_id TEXT PRIMARY KEY, tier TEXT, xp INTEGER DEFAULT 0, purchased_at TEXT
);
CREATE TABLE IF NOT EXISTS market_listings (
  id TEXT PRIMARY KEY, seller_user_id TEXT, item TEXT, name TEXT, price INTEGER,
  status TEXT DEFAULT 'open', buyer_user_id TEXT, created_at TEXT, sold_at TEXT
);
CREATE TABLE IF NOT EXISTS onchain_anchors (
  id TEXT PRIMARY KEY, user_id TEXT, worker_id TEXT, kind TEXT, tx_hash TEXT, address TEXT, chain_id INTEGER, created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON economy_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_stake_worker ON stakes(worker_id);
`);

const START_GRANT = 500;
// 软通证 sink（消耗）类原因，用于通证学统计
const SINKS = new Set(['store', 'season_pass', 'stake', 'market_buy', 'entry_fee', 'boost']);

function ledger(userId: string, delta: number, reason: string, ref = '') {
  db.prepare('INSERT INTO economy_ledger (id, user_id, delta, reason, ref, created_at) VALUES (?,?,?,?,?,?)').run(id('cp'), userId, Math.round(delta), reason, ref, now());
}

export function balance(userId: string): number {
  const row = db.prepare('SELECT COALESCE(SUM(delta),0) AS b, COUNT(*) AS n FROM economy_ledger WHERE user_id=?').get(userId) as any;
  if (row.n === 0) { ledger(userId, START_GRANT, 'grant', 'welcome'); return START_GRANT; }
  return row.b as number;
}

export function earn(userId: string, amount: number, reason: string, ref = '') {
  if (amount <= 0) return;
  balance(userId); // 确保初始发放
  ledger(userId, amount, reason, ref);
}

export function spend(userId: string, amount: number, reason: string, ref = ''): void {
  const b = balance(userId);
  if (b < amount) throw new Error('INSUFFICIENT_CP');
  ledger(userId, -amount, reason, ref);
}

export function history(userId: string, limit = 40): any[] {
  return db.prepare('SELECT * FROM economy_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT ?').all(userId, limit) as any[];
}

// ---- 质押：押注某员工，其在排位赛进入前二时产出收益 ----
export function stake(userId: string, workerId: string, amount: number) {
  if (amount <= 0) throw new Error('BAD_AMOUNT');
  spend(userId, amount, 'stake', workerId);
  const sid = id('stk');
  db.prepare('INSERT INTO stakes (id, user_id, worker_id, amount, active, created_at) VALUES (?,?,?,?,1,?)').run(sid, userId, workerId, amount, now());
  return getStakes(userId);
}

export function unstake(userId: string, stakeId: string) {
  const s = db.prepare('SELECT * FROM stakes WHERE id=? AND user_id=? AND active=1').get(stakeId, userId) as any;
  if (!s) throw new Error('STAKE_NOT_FOUND');
  db.prepare('UPDATE stakes SET active=0 WHERE id=?').run(stakeId);
  earn(userId, s.amount + s.yield_pending, 'unstake', stakeId);
  return getStakes(userId);
}

export function claimYield(userId: string, stakeId: string) {
  const s = db.prepare('SELECT * FROM stakes WHERE id=? AND user_id=? AND active=1').get(stakeId, userId) as any;
  if (!s || s.yield_pending <= 0) throw new Error('NO_YIELD');
  earn(userId, s.yield_pending, 'stake_yield', stakeId);
  db.prepare('UPDATE stakes SET yield_pending=0 WHERE id=?').run(stakeId);
  return getStakes(userId);
}

export function getStakes(userId: string): any[] {
  return db.prepare('SELECT s.*, w.name AS worker_name, w.role AS role FROM stakes s JOIN workers w ON w.id=s.worker_id WHERE s.user_id=? AND s.active=1 ORDER BY s.created_at DESC').all(userId) as any[];
}

/** 比赛结算后：按名次发 CP + 给前二员工的质押者派息（在 matches 服务中调用） */
export function rewardMatch(participants: Array<{ workerId: string; placement: number }>, workerOwner: (id: string) => string | undefined) {
  const cpByPlacement = [0, 100, 60, 30, 10];
  for (const p of participants) {
    const owner = workerOwner(p.workerId);
    if (owner) earn(owner, cpByPlacement[p.placement] ?? 5, 'match_reward', p.workerId);
    // 前二 -> 质押派息 5%
    if (p.placement <= 2) {
      const stakers = db.prepare('SELECT * FROM stakes WHERE worker_id=? AND active=1').all(p.workerId) as any[];
      for (const s of stakers) {
        const y = Math.max(1, Math.floor(s.amount * (p.placement === 1 ? 0.06 : 0.03)));
        db.prepare('UPDATE stakes SET yield_pending=yield_pending+?, yield_total=yield_total+? WHERE id=?').run(y, y, s.id);
      }
    }
  }
}

// ---- 赛季通行证 ----
const PASS_PRICE = 800;
export function seasonPass(userId: string) {
  const row = db.prepare('SELECT * FROM season_pass WHERE user_id=?').get(userId) as any;
  return row || { user_id: userId, tier: 'free', xp: 0 };
}
export function buySeasonPass(userId: string) {
  const cur = seasonPass(userId);
  if (cur.tier === 'premium') throw new Error('ALREADY_PREMIUM');
  spend(userId, PASS_PRICE, 'season_pass', 'premium');
  db.prepare('INSERT INTO season_pass (user_id, tier, xp, purchased_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET tier=?')
    .run(userId, 'premium', cur.xp || 0, now(), 'premium');
  return seasonPass(userId);
}
export function addSeasonXp(userId: string, xp: number) {
  const cur = seasonPass(userId);
  db.prepare('INSERT INTO season_pass (user_id, tier, xp, purchased_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET xp=xp+?')
    .run(userId, cur.tier || 'free', xp, now(), xp);
}

// ---- 装饰交易市场（CP 计价） ----
export function listItem(userId: string, item: string, name: string, price: number) {
  if (price <= 0) throw new Error('BAD_PRICE');
  db.prepare('INSERT INTO market_listings (id, seller_user_id, item, name, price, status, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id('lst'), userId, item, name, price, 'open', now());
  return listings();
}
export function listings(): any[] {
  return db.prepare("SELECT l.*, u.display_name AS seller FROM market_listings l JOIN users u ON u.id=l.seller_user_id WHERE l.status='open' ORDER BY l.created_at DESC LIMIT 50").all() as any[];
}
export function buyListing(userId: string, listingId: string) {
  const l = db.prepare("SELECT * FROM market_listings WHERE id=? AND status='open'").get(listingId) as any;
  if (!l) throw new Error('LISTING_NOT_FOUND');
  if (l.seller_user_id === userId) throw new Error('OWN_LISTING');
  spend(userId, l.price, 'market_buy', listingId);
  earn(l.seller_user_id, Math.floor(l.price * 0.95), 'market_sale', listingId); // 5% 手续费销毁
  db.prepare("UPDATE market_listings SET status='sold', buyer_user_id=?, sold_at=? WHERE id=?").run(userId, now(), listingId);
  return { ok: true, balance: balance(userId) };
}

// ---- 通证学统计（sink/faucet 平衡） ----
export function tokenomics() {
  const rows = db.prepare('SELECT reason, SUM(delta) AS total, COUNT(*) AS n FROM economy_ledger GROUP BY reason').all() as any[];
  let minted = 0, burned = 0;
  for (const r of rows) { if (r.total > 0) minted += r.total; else burned += -r.total; }
  const circulating = db.prepare('SELECT COALESCE(SUM(delta),0) AS c FROM economy_ledger').get() as any;
  const staked = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM stakes WHERE active=1').get() as any;
  const holders = db.prepare('SELECT COUNT(DISTINCT user_id) AS h FROM economy_ledger').get() as any;
  return {
    symbol: 'CP',
    name: 'Coffee Points',
    minted, burned,
    circulating: circulating.c,
    staked: staked.s,
    holders: holders.h,
    sinks: rows.filter((r) => SINKS.has(r.reason)).map((r) => ({ reason: r.reason, burned: -r.total })),
    faucets: rows.filter((r) => r.total > 0).map((r) => ({ reason: r.reason, minted: r.total })),
  };
}

// ---- 记录钱包真实交易（客户端签名后回传） ----
export function recordAnchor(userId: string, workerId: string | null, kind: string, txHash: string, address: string, chainId: number) {
  db.prepare('INSERT INTO onchain_anchors (id, user_id, worker_id, kind, tx_hash, address, chain_id, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id('anc'), userId, workerId, kind, txHash, address, chainId, now());
  if (workerId && kind === 'strategy_register') {
    db.prepare('UPDATE strategy_versions SET chain_tx_hash=? WHERE id=(SELECT current_ranked_version_id FROM workers WHERE id=?)').run(txHash, workerId);
  }
  return { ok: true };
}
export function anchorsForUser(userId: string): any[] {
  return db.prepare('SELECT * FROM onchain_anchors WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(userId) as any[];
}
