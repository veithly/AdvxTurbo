// 用当前 relayer 私钥重部署核心合约（旧部署者 0x72D8… 私钥丢失，onlyRole 全部失效）
// AgentPassport + StrategyRegistry + MatchRootRegistry，admin = relayer，
// 部署结果写入 contracts/deployments/injectiveTestnet.json 与 apps/server/chain-core.json。
// 用法: node scripts/redeploy-core.cjs
const fs = require('node:fs');
const path = require('node:path');
const solc = require('solc');
const { ethers } = require(path.resolve(__dirname, '../../node_modules/ethers'));

const RPC = process.env.INJECTIVE_TESTNET_RPC || 'https://k8s.testnet.json-rpc.injective.network/';
const CHAIN_ID = 1439;

function loadKey() {
  if (process.env.RELAYER_PRIVATE_KEY) return process.env.RELAYER_PRIVATE_KEY;
  if (process.env.PRIVATE_KEY) return process.env.PRIVATE_KEY;
  const envFile = path.resolve(__dirname, '../../.env');
  const m = fs.readFileSync(envFile, 'utf8').match(/PRIVATE_KEY=(0x[0-9a-fA-F]{64})/);
  if (!m) throw new Error('no PRIVATE_KEY in root .env');
  return m[1];
}

// 与 compile-check.cjs 同配置的 solc 编译
function compileAll() {
  const dir = path.resolve(__dirname, '../contracts');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sol'));
  const sources = {};
  for (const f of files) sources[f] = { content: fs.readFileSync(path.join(dir, f), 'utf8') };
  const findImports = (p) => {
    const f = path.basename(p);
    return sources[f] ? { contents: sources[f].content } : { error: 'not found: ' + p };
  };
  const input = {
    language: 'Solidity',
    sources,
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (out.errors || []).filter((e) => e.severity === 'error');
  if (errors.length) { errors.forEach((e) => console.error(e.formattedMessage)); throw new Error('solc compile failed'); }
  const byName = {};
  for (const f of Object.keys(out.contracts || {}))
    for (const c of Object.keys(out.contracts[f])) byName[c] = out.contracts[f][c];
  return byName;
}

async function waitCode(provider, hash, addr) {
  for (let i = 0; i < 90; i++) {
    const rc = await provider.getTransactionReceipt(hash).catch(() => null);
    if (rc) {
      if (rc.status !== 1 && rc.status !== 1n) throw new Error('deploy reverted ' + hash);
      return;
    }
    const code = await provider.getCode(addr).catch(() => '0x');
    if (code && code !== '0x') return; // 慢 RPC 后备：地址上出现代码即成功
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('deploy timeout ' + hash);
}

async function deployOne(wallet, provider, art, name, args) {
  const factory = new ethers.ContractFactory(art.abi, '0x' + art.evm.bytecode.object, wallet);
  const nonce = await provider.getTransactionCount(wallet.address, 'latest');
  const predicted = ethers.getCreateAddress({ from: wallet.address, nonce });
  const unsigned = await factory.getDeployTransaction(...args);
  const tx = await wallet.sendTransaction({ ...unsigned, nonce });
  process.stdout.write(`${name} tx=${tx.hash} addr=${predicted} ... `);
  await waitCode(provider, tx.hash, predicted);
  console.log('OK');
  return { address: predicted, deployTx: tx.hash };
}

async function main() {
  const compiled = compileAll();
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
  const wallet = new ethers.Wallet(loadKey(), provider);
  const bal = await provider.getBalance(wallet.address);
  console.log('Deployer:', wallet.address, '| balance:', ethers.formatEther(bal), 'INJ');

  const passport = await deployOne(wallet, provider, compiled.AgentPassport, 'AgentPassport', [wallet.address]);
  const strategy = await deployOne(wallet, provider, compiled.StrategyRegistry, 'StrategyRegistry', [wallet.address, passport.address]);
  const matchRoot = await deployOne(wallet, provider, compiled.MatchRootRegistry, 'MatchRootRegistry', [wallet.address]);

  const addresses = {
    network: 'injectiveTestnet',
    chainId: CHAIN_ID,
    deployer: wallet.address,
    AgentPassport: passport.address,
    StrategyRegistry: strategy.address,
    MatchRootRegistry: matchRoot.address,
    deployTxs: { AgentPassport: passport.deployTx, StrategyRegistry: strategy.deployTx, MatchRootRegistry: matchRoot.deployTx },
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.resolve(__dirname, '../deployments/injectiveTestnet.json'), JSON.stringify(addresses, null, 2));
  // 服务端直接读取的地址文件（gateway.ts loadCoreContracts）
  fs.writeFileSync(path.resolve(__dirname, '../../apps/server/chain-core.json'), JSON.stringify(addresses, null, 2));
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
