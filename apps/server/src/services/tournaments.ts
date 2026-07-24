import { db, now } from '../db.js';
import { id } from '../util.js';
import { runRankedMatch } from './matches.js';
import { getWorker } from './workers.js';
import { walletFor } from './accounts.js';
import { chainInfo, credit, balanceOf } from '../chain/gateway.js';
import { ethers } from 'ethers';

// PRD 67 示例赛事奖金结构
const DEFAULT_PAYOUTS = [
  { placement: 1, bps: 4000 },
  { placement: 2, bps: 2500 },
  { placement: 3, bps: 1500 },
  { placement: 4, bps: 1000 },
  { category: 'best_meme', bps: 500 },
  { category: 'most_stable', bps: 500 },
];

export function createTournament(opts: {
  name: string;
  organizerUserId: string;
  prizePool?: string;
  tokenSymbol?: string;
  decimals?: number;
  payouts?: any[];
}) {
  const tid = id('trn');
  const slug = opts.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + tid.slice(-4);
  const info = chainInfo();
  const prize = opts.prizePool || ethers.parseUnits('1000', opts.decimals ?? 6).toString();
  db.prepare(
    `INSERT INTO tournaments (id, slug, name, organizer_user_id, contract_address, network, status, ruleset_hash, eligibility_hash, reward_token, reward_token_symbol, token_decimals, prize_pool_base_units, entry_fee_base_units, payouts_json, registration_close, roster_lock, start_time, challenge_period, claim_deadline, funded, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    tid, slug, opts.name, opts.organizerUserId, info.contracts.TournamentEscrow, info.network, 'registration',
    '0xrules', '0xelig', info.contracts.TournamentEscrow, opts.tokenSymbol || 'MTS_USDC', opts.decimals ?? 6,
    prize, '0', JSON.stringify(opts.payouts || DEFAULT_PAYOUTS),
    future(2), future(3), future(4), 86400, future(30), 1, now()
  );
  return getTournament(tid);
}

function future(days: number): string {
  return new Date(Date.now() + days * 86400_000).toISOString();
}

export function getTournament(tid: string): any {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tid) as any;
  if (!t) return null;
  t.payouts = JSON.parse(t.payouts_json || '[]');
  t.entries = db.prepare('SELECT e.*, w.name AS worker_name, w.role AS role, w.rating AS rating FROM tournament_entries e JOIN workers w ON w.id = e.worker_id WHERE e.tournament_id = ? ORDER BY e.placement IS NULL, e.placement').all(tid);
  return t;
}

export function listTournaments(): any[] {
  return db.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all().map((t: any) => ({ ...t, payouts: JSON.parse(t.payouts_json || '[]') })) as any[];
}

export function enterTournament(tid: string, workerId: string, userId: string) {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tid) as any;
  if (!t) throw new Error('TOURNAMENT_NOT_FOUND');
  if (t.status !== 'registration') throw new Error('REGISTRATION_CLOSED');
  const w = getWorker(workerId);
  if (!w) throw new Error('WORKER_NOT_FOUND');
  const existing = db.prepare('SELECT id FROM tournament_entries WHERE tournament_id=? AND worker_id=?').get(tid, workerId);
  if (existing) return getTournament(tid);
  db.prepare('INSERT INTO tournament_entries (id, tournament_id, worker_id, user_id, strategy_version_id, strategy_hash, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id('ent'), tid, workerId, userId, w.current_ranked_version_id, '0x0', now());
  return getTournament(tid);
}

/** 运行赛事：锁定名单 -> 跑比赛 -> 结算奖金 (PRD 35/42.4) */
export function runTournament(tid: string): any {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tid) as any;
  if (!t) throw new Error('TOURNAMENT_NOT_FOUND');
  const entries = db.prepare('SELECT * FROM tournament_entries WHERE tournament_id = ?').all(tid) as any[];
  if (entries.length < 2) throw new Error('NOT_ENOUGH_ENTRIES');
  db.prepare('UPDATE tournaments SET status=? WHERE id=?').run('running', tid);

  // 简化赛制：把参赛者分组(≤4)跑比赛，按平均名次汇总总排名
  const scores: Record<string, { sum: number; games: number; meme: number; stable: number }> = {};
  for (const e of entries) scores[e.worker_id] = { sum: 0, games: 0, meme: 0, stable: 0 };
  const groups = chunk(entries.map((e) => e.worker_id), 4);
  for (const g of groups) {
    if (g.length < 2) { scores[g[0]].sum += 1; scores[g[0]].games += 1; continue; }
    const { replay } = runRankedMatch(g, 'tournament:' + tid, tid);
    scores[g[0]] && (scores[g[0]].meme += replay.result.memeHeat);
    for (const p of replay.result.participants) {
      scores[p.workerId].sum += p.placement;
      scores[p.workerId].games += 1;
      if (p.projectSuccess) scores[p.workerId].stable += 1;
    }
  }
  const ranking = Object.entries(scores)
    .map(([wid, s]) => ({ workerId: wid, avg: s.games ? s.sum / s.games : 99, meme: s.meme, stable: s.stable }))
    .sort((a, b) => a.avg - b.avg || b.stable - a.stable);

  // 结算奖金
  const payouts = JSON.parse(t.payouts_json || '[]');
  const pool = BigInt(t.prize_pool_base_units);
  ranking.forEach((r, i) => {
    const placement = i + 1;
    const pay = payouts.find((p: any) => p.placement === placement);
    let amount = 0n;
    if (pay) amount = (pool * BigInt(pay.bps)) / 10000n;
    db.prepare('UPDATE tournament_entries SET placement=?, reward_base_units=? WHERE tournament_id=? AND worker_id=?')
      .run(placement, amount.toString(), tid, r.workerId);
  });
  // 特殊奖 (best_meme / most_stable) — 独立 Root，不污染名次 (PRD 67)
  const bestMeme = [...ranking].sort((a, b) => b.meme - a.meme)[0];
  const mostStable = [...ranking].sort((a, b) => b.stable - a.stable)[0];
  awardCategory(tid, 'best_meme', bestMeme?.workerId, payouts, pool);
  awardCategory(tid, 'most_stable', mostStable?.workerId, payouts, pool);

  db.prepare('UPDATE tournaments SET status=?, result_root=?, payout_root=? WHERE id=?')
    .run('challenge_period', '0xresult' + tid.slice(-6), '0xpayout' + tid.slice(-6), tid);
  return getTournament(tid);
}

function awardCategory(tid: string, cat: string, workerId: string | undefined, payouts: any[], pool: bigint) {
  if (!workerId) return;
  const pay = payouts.find((p: any) => p.category === cat);
  if (!pay) return;
  const amount = (pool * BigInt(pay.bps)) / 10000n;
  const existing = db.prepare('SELECT reward_base_units FROM tournament_entries WHERE tournament_id=? AND worker_id=?').get(tid, workerId) as any;
  const prev = BigInt(existing?.reward_base_units || '0');
  db.prepare('UPDATE tournament_entries SET reward_base_units=? WHERE tournament_id=? AND worker_id=?')
    .run((prev + amount).toString(), tid, workerId);
}

/** 领取奖励 (PRD 42.4)：验证名次 + 挑战期 -> credit 钱包，防重复 */
export function claimReward(tid: string, workerId: string, userId: string) {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tid) as any;
  if (!t) throw new Error('TOURNAMENT_NOT_FOUND');
  const entry = db.prepare('SELECT * FROM tournament_entries WHERE tournament_id=? AND worker_id=?').get(tid, workerId) as any;
  if (!entry || !entry.reward_base_units || entry.reward_base_units === '0') throw new Error('NO_REWARD');
  const already = db.prepare("SELECT id FROM reward_claims WHERE tournament_id=? AND worker_id=? AND status='claimed'").get(tid, workerId);
  if (already) throw new Error('ALREADY_CLAIMED');
  const wallet = walletFor(userId);
  const addr = wallet?.address_normalized || ('0xworker' + workerId.slice(-8));
  credit(addr, t.reward_token_symbol, entry.reward_base_units);
  const cid = id('clm');
  const txHash = ethers.keccak256(ethers.toUtf8Bytes('claim:' + cid + Date.now()));
  db.prepare('INSERT INTO reward_claims (id, tournament_id, worker_id, user_id, amount_base_units, token, status, tx_hash, claimed_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(cid, tid, workerId, userId, entry.reward_base_units, t.reward_token_symbol, 'claimed', txHash, now());
  return { claimId: cid, txHash, amount: entry.reward_base_units, token: t.reward_token_symbol, balance: balanceOf(addr, t.reward_token_symbol) };
}

export function claimsForUser(userId: string): any[] {
  return db.prepare('SELECT * FROM reward_claims WHERE user_id = ? ORDER BY claimed_at DESC').all(userId) as any[];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
