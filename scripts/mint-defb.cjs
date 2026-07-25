// 一次性脚本：把 defb 的护照真实铸到用户 MetaMask 地址
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { ethers } = require(path.resolve(__dirname, '../node_modules/ethers'));

const RPC = 'https://k8s.testnet.json-rpc.injective.network/';
const PASSPORT = '0x22338e54c2fF2A619c9Ff2e18b6615c15777a79D';
const OWNER = ethers.getAddress('0xd5994fE3a6Dba7475fBF19220e7FC65dc5Ba73BE');
const WORKER_ID = 'wrk_i0i53p0x1pgk5p94zypm'; // defb
const USER_ID = 'usr_2ss0wbi8xnq16dwulrp9'; // yuio

const ABI = [
  'function mintPassport(address owner, bytes32 workerIdHash, bytes32 metadataHash, string metadataURI) returns (uint256)',
  'function activePassportOf(bytes32) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'event PassportMinted(uint256 indexed tokenId, address indexed owner, bytes32 workerIdHash, bytes32 metadataHash)',
];

function loadKey() {
  const m = fs.readFileSync(path.resolve(__dirname, '../apps/server/.env.relayer'), 'utf8')
    .match(/RELAYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/);
  if (!m) throw new Error('no key');
  return m[1];
}

async function main() {
  const db = new DatabaseSync(path.resolve(__dirname, '../apps/server/data/blame.db'));
  const row = db.prepare('SELECT * FROM chain_passports WHERE worker_id=?').get(WORKER_ID);
  if (!row) throw new Error('no local passport');
  console.log('local passport #' + row.token_id, 'hash:', row.worker_hash);
  if (row.onchain_tx) { console.log('already on chain:', row.onchain_tx); return; }

  const provider = new ethers.JsonRpcProvider(RPC, 1439, { staticNetwork: true });
  const wallet = new ethers.Wallet(loadKey(), provider);
  const c = new ethers.Contract(PASSPORT, ABI, wallet);

  const workerHash = row.worker_hash.startsWith('0x') ? row.worker_hash : '0x' + row.worker_hash;
  const metaHash = row.metadata_hash.startsWith('0x') ? row.metadata_hash : '0x' + row.metadata_hash;

  const tx = await c.mintPassport(OWNER, workerHash, metaHash, `/api/chain/passports/${row.token_id}`);
  console.log('mint tx sent:', tx.hash);

  // 轮询回执，后备用 activePassportOf 判断成功（该 RPC 回执慢）
  let tokenId = null;
  for (let i = 0; i < 60; i++) {
    const rc = await provider.getTransactionReceipt(tx.hash).catch(() => null);
    if (rc) {
      if (rc.status !== 1 && rc.status !== 1n) throw new Error('mint reverted');
      for (const log of rc.logs || []) {
        try { const p = c.interface.parseLog(log); if (p?.name === 'PassportMinted') tokenId = Number(p.args.tokenId); } catch {}
      }
      break;
    }
    const active = await c.activePassportOf(workerHash).catch(() => 0n);
    if (active && active !== 0n) { tokenId = Number(active); break; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (tokenId === null) throw new Error('timeout waiting mint');
  const ownerOnChain = await c.ownerOf(tokenId);
  console.log('on-chain tokenId:', tokenId, 'owner:', ownerOnChain);

  db.prepare('UPDATE chain_passports SET onchain_tx=?, onchain_token_id=?, controller=? WHERE worker_id=?')
    .run(tx.hash, tokenId, OWNER.toLowerCase(), WORKER_ID);
  db.prepare('UPDATE wallet_links SET address_normalized=? WHERE user_id=?')
    .run(OWNER.toLowerCase(), USER_ID);
  console.log('DB updated. explorer: https://testnet.blockscout.injective.network/tx/' + tx.hash);
  console.log('NFT: https://testnet.blockscout.injective.network/token/' + PASSPORT + '/instance/' + tokenId);
}

main().catch((e) => { console.error(e); process.exit(1); });
