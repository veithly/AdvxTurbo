import { db, now } from '../db.js';
import { id, generateWorkerKey, sha256, DEFAULT_SCOPES } from '../util.js';
import { ROLES, tierForRating, DEFAULT_STRATEGY, RULESET_VERSION, RUNTIME_API_VERSION } from '@blame/shared';
import type { RoleId } from '@blame/shared';
import { getPassport, mintPassport } from '../chain/gateway.js';
import { walletFor } from './accounts.js';

export function createWorker(userId: string, name: string, role: RoleId, appearance: object, personality: string, agentTool = 'claude_code') {
  const wid = id('wrk');
  db.prepare(
    'INSERT INTO workers (id, user_id, name, role, appearance_json, personality_text, status, public_challenge_enabled, agent_tool, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(wid, userId, name, role, JSON.stringify(appearance), personality, 'active', 1, agentTool || 'claude_code', now());
  // 初始 v1.0 策略
  const vid = id('ver');
  const code = DEFAULT_STRATEGY;
  db.prepare(
    'INSERT INTO strategy_versions (id, worker_id, semver, source_code, source_hash, artifact_hash, compiler_version, runtime_api_version, submitted_by, change_notes, status, created_at, published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(vid, wid, '1.0.0', code, sha256(code), sha256('artifact:' + code), 'quickjs-1.0', RUNTIME_API_VERSION, 'human', '初始策略', 'published', now(), now());
  db.prepare('UPDATE workers SET current_ranked_version_id=?, current_pve_version_id=? WHERE id=?').run(vid, vid, wid);
  // 创建后自动铸造 Injective 身份 NFT (Agent Passport SBT)
  try {
    const wallet = walletFor(userId);
    const controller = wallet?.address_normalized || ('0x' + sha256('ctrl:' + userId).slice(0, 40));
    mintPassport(wid, controller, { name, role });
  } catch {}
  return getWorker(wid);
}

export function getWorker(wid: string): any {
  if (!wid || typeof wid !== 'string') return undefined;
  return db.prepare('SELECT * FROM workers WHERE id = ?').get(wid);
}

export function listWorkersByUser(userId: string): any[] {
  return db.prepare('SELECT * FROM workers WHERE user_id = ? ORDER BY created_at').all(userId) as any[];
}

export function updateWorker(wid: string, fields: Partial<{ public_challenge_enabled: number; status: string; name: string; agent_tool: string }>) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(fields)) { sets.push(`${k} = ?`); vals.push(v); }
  if (!sets.length) return;
  vals.push(wid);
  db.prepare(`UPDATE workers SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

// ---- Worker Key (PRD 20.4) ----
export function createKey(workerId: string, ownerUserId: string, name: string, scopes: string[] = DEFAULT_SCOPES) {
  const g = generateWorkerKey();
  const kid = id('key');
  db.prepare(
    'INSERT INTO worker_keys (id, worker_id, owner_user_id, prefix, secret_hash, name, scopes, rate_limit_profile, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(kid, workerId, ownerUserId, g.prefix, g.secretHash, name, JSON.stringify(scopes), 'default', now());
  return { id: kid, plaintext: g.plaintext, display: g.display, scopes };
}

export function listKeys(workerId: string): any[] {
  return db
    .prepare('SELECT id, worker_id, name, prefix, scopes, created_at, last_used_at, revoked_at FROM worker_keys WHERE worker_id = ? ORDER BY created_at DESC')
    .all(workerId)
    .map((k: any) => ({ ...k, scopes: JSON.parse(k.scopes || '[]'), display: k.prefix + '…' }));
}

export function revokeKey(keyId: string) {
  db.prepare('UPDATE worker_keys SET revoked_at = ? WHERE id = ?').run(now(), keyId);
}

export function rotateKey(keyId: string) {
  const k = db.prepare('SELECT * FROM worker_keys WHERE id = ?').get(keyId) as any;
  if (!k) throw new Error('KEY_NOT_FOUND');
  revokeKey(keyId);
  return createKey(k.worker_id, k.owner_user_id, k.name + ' (rotated)', JSON.parse(k.scopes));
}

export function workerFromKey(plaintext: string | undefined): { worker: any; scopes: string[]; keyId: string } | null {
  if (!plaintext) return null;
  const hash = sha256(plaintext);
  const k = db.prepare('SELECT * FROM worker_keys WHERE secret_hash = ? AND revoked_at IS NULL').get(hash) as any;
  if (!k) return null;
  db.prepare('UPDATE worker_keys SET last_used_at = ? WHERE id = ?').run(now(), k.id);
  const worker = getWorker(k.worker_id);
  return { worker, scopes: JSON.parse(k.scopes || '[]'), keyId: k.id };
}

// ---- Agent 上下文 (PRD 23.3) ----
export function workerContext(workerId: string) {
  const w = getWorker(workerId);
  if (!w) return null;
  const role = ROLES[w.role as RoleId];
  const recent = db
    .prepare('SELECT * FROM match_participants WHERE worker_id = ? ORDER BY rowid DESC LIMIT 20')
    .all(workerId) as any[];
  const games = recent.length;
  const successRate = games ? recent.filter((r) => r.project_success).length / games : 0;
  const avgPlacement = games ? recent.reduce((s, r) => s + r.placement, 0) / games : 0;
  const avgBlame = games ? recent.reduce((s, r) => s + r.final_blame, 0) / games : 0;
  const passport = getPassport(workerId);
  const dailySims = (db.prepare("SELECT COUNT(*) AS c FROM simulation_runs WHERE worker_id=? AND created_at LIKE ?").get(workerId, new Date().toISOString().slice(0, 10) + '%') as any).c;
  return {
    worker: {
      id: w.id,
      name: w.name,
      role: w.role,
      status: w.status,
      rank: { tier: tierForRating(w.rating), rating: Math.round(w.rating) },
      currentBranches: { ranked: w.current_ranked_version_id, 'friday-raid': w.current_pve_version_id },
    },
    ruleset: {
      version: RULESET_VERSION,
      guideUrl: `/docs/agent-guide/${RULESET_VERSION}`,
      runtimeApiVersion: RUNTIME_API_VERSION,
    },
    limits: {
      simulationsRemainingToday: Math.max(0, 50 - dailySims),
      recordedChallengesRemainingToday: 10,
      nextSimulationAt: null,
    },
    recentPerformance: {
      projectSuccessRate: round3(successRate),
      averagePlacement: round3(avgPlacement),
      averageBlame: round3(avgBlame),
      invalidActionRate: 0.009,
    },
    chain: {
      network: w.passport_network || 'injective-evm-testnet',
      passportMinted: !!passport,
      passportTokenId: passport ? String(passport.token_id) : null,
      latestRegisteredVersion: w.current_ranked_version_id,
    },
  };
}

function round3(v: number) { return Math.round(v * 1000) / 1000; }
