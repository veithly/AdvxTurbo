import { db, now } from '../db.js';
import { id, token, hashPassword, verifyPassword } from '../util.js';

export interface User {
  id: string;
  display_name: string;
  email: string;
  locale: string;
  status: string;
}

export function register(email: string, password: string, displayName: string, locale = 'zh'): { user: User; token: string } {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) throw new Error('EMAIL_TAKEN');
  const uid = id('usr');
  db.prepare(
    'INSERT INTO users (id, display_name, email, password_hash, locale, status, created_at, last_active_at) VALUES (?,?,?,?,?,?,?,?)'
  ).run(uid, displayName, email, hashPassword(password), locale, 'active', now(), now());
  return { user: getUser(uid)!, token: createSession(uid) };
}

export function login(email: string, password: string): { user: User; token: string } {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!row || !verifyPassword(password, row.password_hash)) throw new Error('INVALID_CREDENTIALS');
  db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(now(), row.id);
  return { user: publicUser(row), token: createSession(row.id) };
}

/** 游客试玩：创建临时账户 (PRD 46.1) */
export function guest(locale = 'zh'): { user: User; token: string } {
  const uid = id('gst');
  db.prepare(
    'INSERT INTO users (id, display_name, email, password_hash, locale, status, created_at, last_active_at) VALUES (?,?,?,?,?,?,?,?)'
  ).run(uid, 'Guest-' + uid.slice(-4), null, '', locale, 'guest', now(), now());
  return { user: getUser(uid)!, token: createSession(uid) };
}

export function createSession(userId: string): string {
  const t = token();
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)').run(t, userId, now());
  return t;
}

export function userFromToken(t: string | undefined): User | null {
  if (!t) return null;
  const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(t) as any;
  return row ? publicUser(row) : null;
}

export function getUser(uid: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(uid) as any;
  return row ? publicUser(row) : null;
}

function publicUser(row: any): User {
  return { id: row.id, display_name: row.display_name, email: row.email, locale: row.locale, status: row.status };
}

export function setLocale(uid: string, locale: string) {
  db.prepare('UPDATE users SET locale = ? WHERE id = ?').run(locale, uid);
}

// PRD 27/37 钱包绑定
export function linkWallet(userId: string, address: string, chainId: number) {
  const norm = address.toLowerCase();
  const existing = db.prepare('SELECT id FROM wallet_links WHERE user_id=? AND address_normalized=? AND revoked_at IS NULL').get(userId, norm) as any;
  if (existing) return existing.id as string;
  const wid = id('wal');
  db.prepare(
    'INSERT INTO wallet_links (id, user_id, chain_family, chain_id, address_normalized, address_display, is_primary, verified_at) VALUES (?,?,?,?,?,?,?,?)'
  ).run(wid, userId, 'evm', chainId, norm, address, 1, now());
  return wid;
}

export function walletFor(userId: string): any | null {
  return db.prepare('SELECT * FROM wallet_links WHERE user_id=? AND revoked_at IS NULL ORDER BY is_primary DESC LIMIT 1').get(userId);
}
