import crypto from 'node:crypto';
import { customAlphabet } from 'nanoid';

const idAlpha = '0123456789abcdefghijklmnopqrstuvwxyz';
const nano = customAlphabet(idAlpha, 20);

export function id(prefix: string): string {
  return `${prefix}_${nano()}`;
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [algo, salt, derived] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !derived) return false;
  const check = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(derived, 'hex'));
}

export interface GeneratedKey {
  plaintext: string;
  prefix: string;
  display: string;
  secretHash: string;
}

// PRD 20.4 Worker Key：明文只展示一次，DB 只存哈希
export function generateWorkerKey(): GeneratedKey {
  const body = crypto.randomBytes(24).toString('hex');
  const plaintext = `wk_${body}`;
  const prefix = plaintext.slice(0, 6);
  const display = `${plaintext.slice(0, 8)}…${plaintext.slice(-4)}`;
  const secretHash = sha256(plaintext);
  return { plaintext, prefix, display, secretHash };
}

export function token(): string {
  return crypto.randomBytes(32).toString('hex');
}

export const DEFAULT_SCOPES = [
  'worker:read',
  'strategy:read',
  'strategy:simulate',
  'strategy:publish',
  'match:read',
  'challenge:create',
  'tournament:read',
  'tournament:enter_free',
];
