import crypto from 'node:crypto';
import { ethers } from 'ethers';
import { db, now } from '../db.js';
import { linkWallet, walletFor } from './accounts.js';
import * as chain from '../chain/gateway.js';

// 内置托管钱包：给没有钱包的用户在服务端生成 EVM 钱包，
// 私钥 AES-256-GCM 加密入库（密钥来自 WALLET_SECRET，缺省从 relayer PRIVATE_KEY 派生），
// 创建后自动由 relayer 注资 0.01 INJ gas。仅面向黑客松测试网，主网请接真正的 KMS。

db.exec(`
CREATE TABLE IF NOT EXISTS custodial_wallets (
  user_id TEXT PRIMARY KEY,
  address TEXT UNIQUE,
  pk_cipher TEXT,
  fund_tx TEXT,
  created_at TEXT
);
`);

function masterKey(): Buffer {
  const secret = process.env.WALLET_SECRET || process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY || 'advx-dev-secret';
  return crypto.createHash('sha256').update('custody:' + secret).digest();
}

function encryptPk(pk: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
  const enc = Buffer.concat([cipher.update(pk, 'utf8'), cipher.final()]);
  return ['gcm', iv.toString('hex'), cipher.getAuthTag().toString('hex'), enc.toString('hex')].join('$');
}

function decryptPk(stored: string): string {
  const [algo, ivHex, tagHex, dataHex] = stored.split('$');
  if (algo !== 'gcm') throw new Error('BAD_CIPHER');
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

export function custodialWalletOf(userId: string): { address: string; fund_tx: string | null } | null {
  const row = db.prepare('SELECT address, fund_tx FROM custodial_wallets WHERE user_id=?').get(userId) as any;
  return row || null;
}

export function isCustodialAddress(address: string): boolean {
  return !!db.prepare('SELECT 1 FROM custodial_wallets WHERE address=?').get(address.toLowerCase());
}

/** 为用户创建托管钱包（幂等）：生成→加密入库→绑为主钱包→relayer 真实注资 gas */
export async function createCustodialWallet(userId: string): Promise<{ address: string; created: boolean; fundTx?: string; fundError?: string; explorer?: string }> {
  const existing = custodialWalletOf(userId);
  if (existing) return { address: existing.address, created: false, fundTx: existing.fund_tx || undefined };
  const w = ethers.Wallet.createRandom();
  const address = w.address.toLowerCase();
  db.prepare('INSERT INTO custodial_wallets (user_id, address, pk_cipher, fund_tx, created_at) VALUES (?,?,?,?,?)')
    .run(userId, address, encryptPk(w.privateKey), null, now());
  linkWallet(userId, w.address, 1439);
  // 首次注资：真实链上转 0.01 INJ 作为 gas（失败不阻塞创建，可稍后用 faucet 补领）
  const sent = await chain.sendGas(address, process.env.FAUCET_INJ || '0.01');
  if ('txHash' in sent) {
    db.prepare('UPDATE custodial_wallets SET fund_tx=? WHERE user_id=?').run(sent.txHash, userId);
    return { address, created: true, fundTx: sent.txHash, explorer: sent.explorer };
  }
  return { address, created: true, fundError: sent.error };
}

/** 托管钱包签名器（后续如需代用户发交易/签名时使用） */
export function custodialSigner(userId: string): ethers.Wallet | null {
  const row = db.prepare('SELECT pk_cipher FROM custodial_wallets WHERE user_id=?').get(userId) as any;
  if (!row) return null;
  return new ethers.Wallet(decryptPk(row.pk_cipher));
}

/** 导出托管钱包私钥（仅限本人托管钱包；非托管用户返回 null） */
export function exportPrivateKey(userId: string): { address: string; privateKey: string } | null {
  const row = db.prepare('SELECT address, pk_cipher FROM custodial_wallets WHERE user_id=?').get(userId) as any;
  if (!row) return null;
  return { address: row.address, privateKey: decryptPk(row.pk_cipher) };
}

/** 用户主钱包是否为托管钱包（供 /auth/me 展示徽章） */
export function walletMeta(userId: string): { address: string; custodial: boolean } | null {
  const w = walletFor(userId);
  if (!w) return null;
  return { address: w.address_normalized, custodial: isCustodialAddress(w.address_normalized) };
}
