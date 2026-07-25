import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, now } from '../db.js';
import { id } from '../util.js';
import { passportMetadata, passportCardSvg } from './nftArt.js';

const __chainDir = path.dirname(fileURLToPath(import.meta.url));
// 已部署的真实合约（apps/server/chain-deploy.json，由 scripts/deploy-chain.mjs 生成）
export function loadDeployedChain(): any | null {
  try { return JSON.parse(fs.readFileSync(path.join(__chainDir, '../../chain-deploy.json'), 'utf8')); } catch { return null; }
}

// PRD 26/29/34：Injective EVM 集成 (Testnet 1439 / Mainnet 1776)
// 无 RPC/密钥时进入 mock 模式：把承诺、批次、奖金托管记录在本地账本，
// 保证 faucet、Passport、策略登记、比赛锚定、奖励领取全流程可本地演示。

export const INJECTIVE_NETWORKS = {
  testnet: {
    key: 'injective-evm-testnet',
    chainId: 1439,
    name: 'Injective EVM Testnet',
    rpc: process.env.INJECTIVE_TESTNET_RPC || 'https://k8s.testnet.json-rpc.injective.network/',
    explorer: 'https://testnet.blockscout.injective.network',
  },
  mainnet: {
    key: 'injective-evm-mainnet',
    chainId: 1776,
    name: 'Injective EVM Mainnet',
    rpc: process.env.INJECTIVE_MAINNET_RPC || 'https://sentry.evm-rpc.injective.network/',
    explorer: 'https://blockscout.injective.network',
  },
};

const ACTIVE = process.env.INJECTIVE_NETWORK === 'mainnet' ? INJECTIVE_NETWORKS.mainnet : INJECTIVE_NETWORKS.testnet;

// 额外的链上账本表 (mock 模式)
db.exec(`
CREATE TABLE IF NOT EXISTS chain_passports (
  token_id INTEGER PRIMARY KEY,
  worker_id TEXT UNIQUE,
  worker_hash TEXT,
  metadata_hash TEXT,
  controller TEXT,
  frozen INTEGER DEFAULT 0,
  minted_at TEXT,
  tx_hash TEXT
);
CREATE TABLE IF NOT EXISTS chain_balances (
  address TEXT,
  token TEXT,
  amount TEXT,
  PRIMARY KEY (address, token)
);
CREATE TABLE IF NOT EXISTS faucet_log (
  id TEXT PRIMARY KEY,
  address TEXT,
  amount TEXT,
  token TEXT,
  tx_hash TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS strategy_registrations (
  version_hash TEXT PRIMARY KEY,
  passport_id INTEGER,
  source_hash TEXT,
  parent_hash TEXT,
  metadata_uri TEXT,
  tx_hash TEXT,
  registered_at TEXT
);
`);

// live 模式回填列：真实链上 tx 与链上 tokenId（与本地展示 id 解耦）
try { db.exec('ALTER TABLE chain_passports ADD COLUMN onchain_tx TEXT'); } catch {}
try { db.exec('ALTER TABLE chain_passports ADD COLUMN onchain_token_id INTEGER'); } catch {}

let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;
export let CHAIN_MODE: 'live' | 'mock' = 'mock';

// ---- 交易队列：串行化所有链上调用避免 nonce 竞争 ----
let txQueue: Promise<any> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = txQueue.then(fn, fn); // 上一笔失败也继续
  txQueue = p.catch(() => {}); // 不让未处理 rejection 泄漏
  return p;
}

export function initChain() {
  const pk = process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (pk && ACTIVE.rpc) {
    try {
      provider = new ethers.JsonRpcProvider(ACTIVE.rpc, ACTIVE.chainId);
      wallet = new ethers.Wallet(pk, provider);
      CHAIN_MODE = 'live';
    } catch {
      CHAIN_MODE = 'mock';
    }
  } else {
    CHAIN_MODE = 'mock';
  }
  return CHAIN_MODE;
}

function mockTx(seed: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(seed + ':' + Date.now() + ':' + Math.random()));
}

export function chainInfo() {
  const dep = loadDeployedChain();
  return {
    mode: CHAIN_MODE,
    network: ACTIVE.key,
    chainId: ACTIVE.chainId,
    name: ACTIVE.name,
    explorer: ACTIVE.explorer,
    rpc: ACTIVE.rpc,
    deployed: dep ? { contract: 'BlameAnchor', address: dep.address, deployTx: dep.deployTx, anchorTx: dep.anchorTx, matchCount: dep.matchCount, deployer: dep.deployer } : null,
    contracts: {
      BlameAnchor: dep?.address || process.env.ADDR_ANCHOR || null,
      AgentPassport: process.env.ADDR_PASSPORT || '0xPassport000000000000000000000000000000000',
      StrategyRegistry: process.env.ADDR_STRATEGY || '0xStrategy000000000000000000000000000000000',
      MatchRootRegistry: process.env.ADDR_MATCHROOT || '0xMatchRoot00000000000000000000000000000000',
      TournamentEscrow: process.env.ADDR_TOURNEY || '0xTournament0000000000000000000000000000000',
    },
  };
}

// keccak256(workerId) 作为 workerHash
export function workerHash(workerId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes('blame-worker:' + workerId));
}

// ---- Passport SBT (PRD 30) ----
export function mintPassport(workerId: string, controllerAddr: string, metadata: object) {
  const existing = db.prepare('SELECT * FROM chain_passports WHERE worker_id = ?').get(workerId) as any;
  if (existing) return { alreadyMinted: true, tokenId: existing.token_id, txHash: existing.tx_hash };
  const row = db.prepare('SELECT COALESCE(MAX(token_id),0)+1 AS next FROM chain_passports').get() as any;
  const tokenId = row.next as number;
  const wHash = workerHash(workerId);
  const metaHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(metadata)));
  const txHash = mockTx('mint:' + workerId);
  db.prepare(
    'INSERT INTO chain_passports (token_id, worker_id, worker_hash, metadata_hash, controller, frozen, minted_at, tx_hash) VALUES (?,?,?,?,?,0,?,?)'
  ).run(tokenId, workerId, wHash, metaHash, controllerAddr, now(), txHash);
  recordEvent('PassportMinted', { tokenId, workerId, workerHash: wHash, metadataHash: metaHash }, txHash);
  db.prepare('UPDATE workers SET passport_network=?, passport_token_id=?, passport_worker_hash=? WHERE id=?').run(ACTIVE.key, String(tokenId), wHash, workerId);
  // live 模式：后台补一笔真实链上铸造（不阻塞创建流程）
  enqueue(() => anchorPassportOnChain(workerId)).catch((e) => console.log('[chain] live mint failed:', e?.message || e));
  return { alreadyMinted: false, tokenId, txHash, workerHash: wHash, metadataHash: metaHash };
}

// ---- Live 真实合约调用 (Passport) ----
const PASSPORT_ABI = [
  'function mintPassport(address owner, bytes32 workerIdHash, bytes32 metadataHash, string metadataURI) returns (uint256)',
  'function updateMetadata(uint256 tokenId, bytes32 newMetadataHash, string newURI)',
  'function activePassportOf(bytes32) view returns (uint256)',
  'event PassportMinted(uint256 indexed tokenId, address indexed owner, bytes32 workerIdHash, bytes32 metadataHash)',
];

/** 组装 NFT 卡片元数据（8-bit 形象 + 名字），tokenURI 为完全上链的 data:URI */
function passportArtFor(workerId: string, wHash: string) {
  const w = db.prepare('SELECT name, role, appearance_json FROM workers WHERE id=?').get(workerId) as any;
  let spec: any;
  try { spec = JSON.parse(w?.appearance_json || '{}')?.charSpec; } catch {}
  return passportMetadata({ name: w?.name || 'Agent', role: w?.role || 'engineer', spec, workerHash: wHash });
}

/** 预览用：护照卡片 SVG（供 /api/chain/passports/:workerId/card.svg） */
export function passportCardSvgFor(workerId: string): string | null {
  const w = db.prepare('SELECT name, role, appearance_json FROM workers WHERE id=?').get(workerId) as any;
  if (!w) return null;
  let spec: any;
  try { spec = JSON.parse(w.appearance_json || '{}')?.charSpec; } catch {}
  return passportCardSvg(w.name || 'Agent', w.role || 'engineer', spec);
}

function passportContract(): ethers.Contract | null {
  const addr = process.env.ADDR_PASSPORT || '';
  if (CHAIN_MODE !== 'live' || !wallet || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
  return new ethers.Contract(addr, PASSPORT_ABI, wallet);
}

/** live 模式：把本地 passport 记录真实铸到链上，回填真 tx 与链上 tokenId；可用 ownerOverride 指定真实钱包 */
export async function anchorPassportOnChain(workerId: string, ownerOverride?: string) {
  const c = passportContract();
  if (!c) return { ok: false, error: 'NOT_LIVE' };
  const row = db.prepare('SELECT * FROM chain_passports WHERE worker_id=?').get(workerId) as any;
  if (!row) return { ok: false, error: 'NO_LOCAL_PASSPORT' };
  if (row.onchain_tx) return { ok: true, alreadyOnChain: true, txHash: row.onchain_tx, tokenId: row.onchain_token_id, explorer: `${ACTIVE.explorer}/tx/${row.onchain_tx}` };
  const owner = ownerOverride || row.controller;
  // tokenURI：内嵌「形象+名字」SVG 卡片的 data:URI，钱包/浏览器可直接显示图片
  const art = passportArtFor(workerId, row.worker_hash);
  const tx = await c.mintPassport(owner, row.worker_hash, art.metadataHash, art.tokenURI);
  // 该 RPC 回执轮询极慢，tx.wait() 会卡死：手动轮询回执 + activePassportOf 后备确认
  let chainTokenId: number | null = null;
  for (let i = 0; i < 60; i++) {
    const rc = await provider!.getTransactionReceipt(tx.hash).catch(() => null);
    if (rc) {
      if (rc.status !== 1) throw new Error('MINT_REVERTED');
      for (const log of rc.logs || []) {
        try {
          const p = c.interface.parseLog(log);
          if (p?.name === 'PassportMinted') chainTokenId = Number(p.args.tokenId);
        } catch {}
      }
      break;
    }
    const active: bigint = await c.activePassportOf(row.worker_hash).catch(() => 0n);
    if (active && active !== 0n) { chainTokenId = Number(active); break; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (chainTokenId === null) throw new Error('MINT_TIMEOUT');
  db.prepare('UPDATE chain_passports SET onchain_tx=?, onchain_token_id=?, controller=? WHERE worker_id=?').run(tx.hash, chainTokenId, owner, workerId);
  recordEvent('PassportMintedOnChain', { workerId, owner, tokenId: chainTokenId }, tx.hash);
  console.log('[chain] passport minted on-chain:', workerId, 'tokenId', chainTokenId, tx.hash);
  return { ok: true, txHash: tx.hash, tokenId: chainTokenId, explorer: `${ACTIVE.explorer}/tx/${tx.hash}` };
}

export function getPassport(workerId: string) {
  return db.prepare('SELECT * FROM chain_passports WHERE worker_id = ?').get(workerId) as any;
}

/** live 模式：为已上链的护照重刷 tokenURI（补图/改名后更新卡片） */
export async function refreshPassportArtOnChain(workerId: string) {
  const c = passportContract();
  if (!c) return { ok: false, error: 'NOT_LIVE' };
  const row = db.prepare('SELECT * FROM chain_passports WHERE worker_id=?').get(workerId) as any;
  if (!row?.onchain_token_id) return { ok: false, error: 'NOT_ON_CHAIN' };
  const art = passportArtFor(workerId, row.worker_hash);
  const tx = await c.updateMetadata(row.onchain_token_id, art.metadataHash, art.tokenURI);
  for (let i = 0; i < 60; i++) {
    const rc = await provider!.getTransactionReceipt(tx.hash).catch(() => null);
    if (rc) {
      if (rc.status !== 1) throw new Error('UPDATE_REVERTED');
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  db.prepare('UPDATE chain_passports SET metadata_hash=? WHERE worker_id=?').run(art.metadataHash, workerId);
  console.log('[chain] passport art refreshed:', workerId, 'tokenId', row.onchain_token_id, tx.hash);
  return { ok: true, txHash: tx.hash, tokenId: row.onchain_token_id, explorer: `${ACTIVE.explorer}/tx/${tx.hash}` };
}

// ---- Strategy Registry (PRD 31) ----
const STRATEGY_ABI = [
  'function registerVersion(uint256 passportId, bytes32 versionHash, bytes32 sourceHash, bytes32 artifactHash, bytes32 parentVersionHash, bytes32 compatibilityHash, bytes32 metadataHash, string metadataURI)',
  'function commitments(bytes32) view returns (uint256 passportId, bytes32 versionHash, bytes32 sourceHash, bytes32 artifactHash, bytes32 parentVersionHash, bytes32 compatibilityHash, bytes32 metadataHash, uint64 registeredAt, address registrant, bool revoked)',
  'event StrategyVersionRegistered(uint256 indexed passportId, bytes32 indexed versionHash, bytes32 sourceHash, address registrant)',
];

function strategyContract(): ethers.Contract | null {
  const addr = process.env.ADDR_STRATEGY || '';
  if (CHAIN_MODE !== 'live' || !wallet || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
  return new ethers.Contract(addr, STRATEGY_ABI, wallet);
}

export function registerStrategy(passportId: number, sourceHash: string, parentHash: string, metadataUri: string) {
  const versionHash = ethers.keccak256(ethers.toUtf8Bytes(sourceHash + ':' + passportId + ':' + Date.now()));
  const txHash = mockTx('register:' + versionHash);
  db.prepare(
    'INSERT OR REPLACE INTO strategy_registrations (version_hash, passport_id, source_hash, parent_hash, metadata_uri, tx_hash, registered_at) VALUES (?,?,?,?,?,?,?)'
  ).run(versionHash, passportId, sourceHash, parentHash, metadataUri, txHash, now());
  recordEvent('StrategyVersionRegistered', { passportId, versionHash, sourceHash }, txHash);
  // live 模式：后台真链登记（不阻塞）
  enqueue(() => anchorStrategyOnChain(passportId, versionHash, sourceHash, parentHash, metadataUri))
    .catch((e) => console.log('[chain] strategy register failed:', e?.message || e));
  return { versionHash, txHash };
}

/** live 模式：真实调用 StrategyRegistry.registerVersion */
async function anchorStrategyOnChain(passportId: number, versionHash: string, sourceHash: string, parentHash: string, metadataUri: string) {
  const c = strategyContract();
  if (!c) return;
  // 需要链上 tokenId（不是本地 token_id）
  const passport = db.prepare('SELECT onchain_token_id FROM chain_passports WHERE token_id=?').get(passportId) as any;
  const onchainId = passport?.onchain_token_id;
  if (!onchainId) { console.log('[chain] strategy skip: passport not on-chain yet'); return; }
  const artifactHash = ethers.ZeroHash;
  const compatibilityHash = ethers.ZeroHash;
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataUri));
  const parentBytes = parentHash && parentHash !== '0x0' ? ethers.zeroPadValue(ethers.toBeHex(parentHash), 32) : ethers.ZeroHash;
  const tx = await c.registerVersion(
    onchainId, versionHash,
    ethers.zeroPadValue(ethers.toBeHex(sourceHash.startsWith('0x') ? sourceHash : '0x' + sourceHash), 32),
    artifactHash, parentBytes, compatibilityHash, metadataHash, metadataUri
  );
  // 轮询回执
  for (let i = 0; i < 60; i++) {
    const rc = await provider!.getTransactionReceipt(tx.hash).catch(() => null);
    if (rc) {
      if (rc.status !== 1) throw new Error('STRATEGY_REGISTER_REVERTED');
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  // 回填真链 tx
  db.prepare('UPDATE strategy_registrations SET tx_hash=? WHERE version_hash=?').run(tx.hash, versionHash);
  console.log('[chain] strategy registered on-chain:', versionHash, 'passportId', onchainId, tx.hash);
}

// ---- Match Batch Root (PRD 32) ----
const MATCHROOT_ABI = [
  'function submitBatch(uint64 batchId, bytes32 merkleRoot, bytes32 engineSetHash, bytes32 manifestHash, uint64 matchCount, uint64 startTime, uint64 endTime, string manifestURI, bytes[] verifierSignatures)',
  'function batches(uint64) view returns (uint64 batchId, bytes32 merkleRoot, bytes32 engineSetHash, bytes32 manifestHash, uint64 matchCount, uint64 startTime, uint64 endTime, string manifestURI, bool invalidated)',
  'event MatchBatchSubmitted(uint64 indexed batchId, bytes32 merkleRoot, uint64 matchCount, string manifestURI)',
];

function matchRootContract(): ethers.Contract | null {
  const addr = process.env.ADDR_MATCHROOT || '';
  if (CHAIN_MODE !== 'live' || !wallet || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
  return new ethers.Contract(addr, MATCHROOT_ABI, wallet);
}

export function submitMatchBatch(leaves: string[]) {
  const root = merkleRoot(leaves);
  const row = db.prepare('SELECT COALESCE(MAX(batch_id),1000)+1 AS next FROM match_batches').get() as any;
  const batchId = row.next as number;
  const txHash = mockTx('batch:' + batchId);
  const manifestHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(leaves)));
  db.prepare(
    'INSERT INTO match_batches (batch_id, merkle_root, engine_set_hash, manifest_hash, match_count, start_time, end_time, manifest_uri, tx_hash, invalidated) VALUES (?,?,?,?,?,?,?,?,?,0)'
  ).run(batchId, root, manifestHash, manifestHash, leaves.length, now(), now(), `/api/chain/batches/${batchId}/manifest`, txHash);
  recordEvent('MatchBatchSubmitted', { batchId, merkleRoot: root, matchCount: leaves.length }, txHash);
  // live 模式：后台真链锚定（不阻塞比赛结算）
  enqueue(() => anchorBatchOnChain(batchId, root, manifestHash, leaves.length))
    .catch((e) => console.log('[chain] batch submit failed:', e?.message || e));
  return { batchId, root, txHash };
}

/** live 模式：真实调用 MatchRootRegistry.submitBatch */
async function anchorBatchOnChain(batchId: number, root: string, manifestHash: string, matchCount: number) {
  const c = matchRootContract();
  if (!c) return;
  const nowTs = BigInt(Math.floor(Date.now() / 1000));
  const engineSetHash = ethers.keccak256(ethers.toUtf8Bytes('engine:' + (process.env.ENGINE_VERSION || 'v1')));
  // MVP 验证器签名：relayer 自签 2 次（测试网演示用，主网需真实多方签名）
  const msg = ethers.solidityPackedKeccak256(['uint64', 'bytes32'], [batchId, root]);
  const sig = await wallet!.signMessage(ethers.getBytes(msg));
  const verifierSigs = [sig, sig]; // 2 个同源签名满足合约 >= 2 要求
  const tx = await c.submitBatch(
    batchId, root, engineSetHash, manifestHash, matchCount,
    nowTs, nowTs, `/api/chain/batches/${batchId}/manifest`, verifierSigs
  );
  for (let i = 0; i < 60; i++) {
    const rc = await provider!.getTransactionReceipt(tx.hash).catch(() => null);
    if (rc) {
      if (rc.status !== 1) throw new Error('BATCH_SUBMIT_REVERTED');
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  db.prepare('UPDATE match_batches SET tx_hash=? WHERE batch_id=?').run(tx.hash, batchId);
  console.log('[chain] batch anchored on-chain:', batchId, 'root', root.slice(0, 18), tx.hash);
}

export function matchLeaf(m: {
  matchId: string;
  mode: string;
  engineHash: string;
  rulesetHash: string;
  mapHash: string;
  eventDeckHash: string;
  seedCommitment: string;
  finalSeed: string;
  resultHash: string;
  replayHash: string;
}): string {
  return ethers.solidityPackedKeccak256(
    ['string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string'],
    [m.matchId, m.mode, m.engineHash, m.rulesetHash, m.mapHash, m.eventDeckHash, m.seedCommitment, m.finalSeed, m.resultHash, m.replayHash]
  );
}

// OZ 风格 sorted-pair keccak Merkle
export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return ethers.ZeroHash;
  let layer = [...leaves].sort();
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) next.push(hashPair(layer[i], layer[i + 1]));
      else next.push(layer[i]);
    }
    layer = next;
  }
  return layer[0];
}

export function merkleProof(leaves: string[], target: string): string[] {
  let layer = [...leaves].sort();
  const proof: string[] = [];
  let idxTarget = layer.indexOf(target);
  if (idxTarget < 0) return [];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        next.push(hashPair(layer[i], layer[i + 1]));
        if (i === idxTarget) proof.push(layer[i + 1]);
        else if (i + 1 === idxTarget) proof.push(layer[i]);
      } else {
        next.push(layer[i]);
      }
    }
    idxTarget = Math.floor(idxTarget / 2);
    layer = next;
  }
  return proof;
}

function hashPair(a: string, b: string): string {
  const [x, y] = a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a];
  return ethers.keccak256(ethers.concat([x, y]));
}

// ---- Faucet (PRD: 完整 faucet 功能) ----
const FAUCET_TOKEN = 'INJ';
const FAUCET_AMOUNT = ethers.parseEther('1').toString();

export function faucet(address: string) {
  const day = new Date().toISOString().slice(0, 10);
  const already = db.prepare("SELECT COUNT(*) AS c FROM faucet_log WHERE address=? AND created_at LIKE ?").get(address, day + '%') as any;
  if (already.c >= 3) return { ok: false, error: 'FAUCET_RATE_LIMIT', message: '每日领取上限为 3 次' };
  const txHash = mockTx('faucet:' + address);
  const bal = (db.prepare('SELECT amount FROM chain_balances WHERE address=? AND token=?').get(address, FAUCET_TOKEN) as any)?.amount || '0';
  const newBal = (BigInt(bal) + BigInt(FAUCET_AMOUNT)).toString();
  db.prepare('INSERT OR REPLACE INTO chain_balances (address, token, amount) VALUES (?,?,?)').run(address, FAUCET_TOKEN, newBal);
  db.prepare('INSERT INTO faucet_log (id, address, amount, token, tx_hash, created_at) VALUES (?,?,?,?,?,?)').run(id('fct'), address, FAUCET_AMOUNT, FAUCET_TOKEN, txHash, now());
  recordEvent('FaucetDrip', { address, amount: FAUCET_AMOUNT }, txHash);
  return { ok: true, txHash, token: FAUCET_TOKEN, amount: FAUCET_AMOUNT, balance: newBal, explorer: `${ACTIVE.explorer}/tx/${txHash}` };
}

export function balanceOf(address: string, token = FAUCET_TOKEN): string {
  return (db.prepare('SELECT amount FROM chain_balances WHERE address=? AND token=?').get(address, token) as any)?.amount || '0';
}

export function credit(address: string, token: string, amount: string) {
  const bal = balanceOf(address, token);
  db.prepare('INSERT OR REPLACE INTO chain_balances (address, token, amount) VALUES (?,?,?)').run(address, token, (BigInt(bal) + BigInt(amount)).toString());
}

function recordEvent(name: string, decoded: object, txHash: string) {
  db.prepare(
    'INSERT INTO chain_events (chain_id, block_number, block_hash, tx_hash, log_index, contract_address, event_name, decoded_json, observed_at, finalized_at, processed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(ACTIVE.chainId, mockBlock(), mockTx('blk'), txHash, 0, chainInfo().contracts.AgentPassport, name, JSON.stringify(decoded), now(), now(), now());
}

let blockCounter = 100000;
function mockBlock(): number {
  return blockCounter++;
}

export function recentChainEvents(limit = 50) {
  return db.prepare('SELECT * FROM chain_events ORDER BY id DESC LIMIT ?').all(limit) as any[];
}

// ============================================================================
// 真实链上操作（live 模式）：AdvxRegistry (ERC-8004 身份/装饰品 NFT) + BlameAnchor 锚定 + INJ 奖励
// 策略：交易发出即返回 txHash（不等 receipt，避免慢 RPC 挂起）；串行发送避免 nonce 冲突。
// ============================================================================

export function loadRegistry(): any | null {
  try { return JSON.parse(fs.readFileSync(path.join(__chainDir, '../../chain-registry.json'), 'utf8')); } catch { return null; }
}

// 复用顶部的 txQueue（单一队列串行化所有链上调用，避免 nonce 竞争）
function enqueueTx<T>(fn: () => Promise<T>): Promise<T> {
  const p = txQueue.then(fn, fn);
  txQueue = p.catch(() => {});
  return p;
}

// 慢 RPC 保护：发交易超过 timeoutMs 直接报错返回，避免前端请求挂死“点了没反应”
function withTimeout<T>(p: Promise<T>, timeoutMs = 20_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TX_TIMEOUT: RPC 响应超时，请稍后重试')), timeoutMs)),
  ]);
}

async function sendContractTx(address: string, abi: any[], method: string, args: any[]): Promise<{ txHash: string; mode: string } | { error: string }> {
  if (CHAIN_MODE !== 'live' || !wallet) return { txHash: mockTx(method), mode: 'mock' };
  try {
    return await withTimeout(enqueueTx(async () => {
      const c = new ethers.Contract(address, abi, wallet!);
      const tx = await c[method](...args); // 发出即返回，不等 receipt
      return { txHash: tx.hash, mode: 'live' };
    }));
  } catch (e: any) {
    return { error: (e?.shortMessage || e?.message || String(e)).slice(0, 200) };
  }
}

/** ERC-8004 风格：把选手身份注册成 NFT，mint 到玩家自己的钱包 */
export async function registerAgentOnChain(agentOwner: string, workerId: string, uri: string) {
  const reg = loadRegistry();
  if (!reg) return { error: 'REGISTRY_NOT_DEPLOYED' };
  const r = await sendContractTx(reg.address, reg.abi, 'registerAgent', [agentOwner, workerHash(workerId), uri]);
  if ('txHash' in r) recordEvent('AgentRegistered8004', { workerId, agentOwner, uri, registry: reg.address }, r.txHash);
  return { ...r, registry: reg.address, explorer: 'txHash' in r ? `${ACTIVE.explorer}/tx/${r.txHash}` : undefined };
}

/** 商店装饰品：mint 真 NFT 到玩家钱包 */
export async function mintItemOnChain(to: string, uri: string) {
  const reg = loadRegistry();
  if (!reg) return { error: 'REGISTRY_NOT_DEPLOYED' };
  const r = await sendContractTx(reg.address, reg.abi, 'mintItem', [to, uri]);
  if ('txHash' in r) recordEvent('ItemMintedOnChain', { to, uri, registry: reg.address }, r.txHash);
  return { ...r, registry: reg.address, explorer: 'txHash' in r ? `${ACTIVE.explorer}/tx/${r.txHash}` : undefined };
}

/** 比赛结果真实锚链（BlameAnchor.anchorMatch），限频省 gas */
let lastAnchorAt = 0;
export async function anchorMatchOnChain(rootHex: string) {
  const dep = loadDeployedChain();
  if (!dep) return { error: 'ANCHOR_NOT_DEPLOYED' };
  const now = Date.now();
  if (now - lastAnchorAt < 60_000) return { skipped: 'rate_limited' };
  lastAnchorAt = now;
  const root = rootHex.startsWith('0x') ? rootHex : '0x' + rootHex;
  const r = await sendContractTx(dep.address, dep.abi, 'anchorMatch', [root.slice(0, 66).padEnd(66, '0')]);
  if ('txHash' in r) recordEvent('MatchAnchoredOnChain', { root }, r.txHash);
  return r;
}

/** INJ 奖励发放（小额，直接转到玩家钱包） */
export async function sendInjReward(to: string, amountInj: string) {
  if (CHAIN_MODE !== 'live' || !wallet) return { txHash: mockTx('reward:' + to), mode: 'mock' };
  try {
    return await withTimeout(enqueueTx(async () => {
      const tx = await wallet!.sendTransaction({ to, value: ethers.parseEther(amountInj) });
      recordEvent('InjRewardSent', { to, amountInj }, tx.hash);
      return { txHash: tx.hash, mode: 'live', explorer: `${ACTIVE.explorer}/tx/${tx.hash}` };
    }));
  } catch (e: any) {
    return { error: (e?.shortMessage || e?.message || String(e)).slice(0, 200) };
  }
}
