// 补部署剩余 3 个合约（绕过 hardhat waitForDeployment 卡死问题）
// 用法: node scripts/deploy-rest.cjs
const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require(path.resolve(__dirname, '../../node_modules/ethers'));

const RPC = 'https://k8s.testnet.json-rpc.injective.network/';
const PASSPORT = '0x22338e54c2fF2A619c9Ff2e18b6615c15777a79D'; // 已部署(nonce4, ERC-721 兼容版)

function loadKey() {
  const envFile = path.resolve(__dirname, '../../apps/server/.env.relayer');
  const m = fs.readFileSync(envFile, 'utf8').match(/RELAYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/);
  if (!m) throw new Error('no key');
  return m[1];
}

function artifact(name) {
  const p = path.resolve(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function waitReceipt(provider, hash, addr) {
  for (let i = 0; i < 60; i++) {
    const rc = await provider.getTransactionReceipt(hash).catch(() => null);
    if (rc) return rc;
    // 后备判断：合约地址上出现代码即视为成功
    const code = await provider.getCode(addr).catch(() => '0x');
    if (code && code !== '0x') return { status: 1, contractAddress: addr, fallback: true };
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('receipt timeout ' + hash);
}

async function deployOne(wallet, provider, name, args) {
  const art = artifact(name);
  const factory = new ethers.ContractFactory(art.abi, art.bytecode, wallet);
  const nonce = await provider.getTransactionCount(wallet.address, 'latest');
  const predicted = ethers.getCreateAddress({ from: wallet.address, nonce });
  const unsigned = await factory.getDeployTransaction(...args);
  const tx = await wallet.sendTransaction({ ...unsigned, nonce });
  process.stdout.write(`${name} tx=${tx.hash} predicted=${predicted} ... `);
  const rc = await waitReceipt(provider, tx.hash, predicted);
  if (rc.status !== 1 && rc.status !== 1n) throw new Error(name + ' deploy reverted');
  console.log('OK' + (rc.fallback ? ' (code-check)' : ''));
  return predicted;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, 1439, { staticNetwork: true });
  const wallet = new ethers.Wallet(loadKey(), provider);
  console.log('Deployer:', wallet.address);

  const strategy = await deployOne(wallet, provider, 'StrategyRegistry', [wallet.address, PASSPORT]);
  const matchRoot = await deployOne(wallet, provider, 'MatchRootRegistry', [wallet.address]);
  const escrow = await deployOne(wallet, provider, 'TournamentEscrow', [wallet.address]);

  const addresses = {
    network: 'injectiveTestnet',
    chainId: 1439,
    deployer: wallet.address,
    AgentPassport: PASSPORT,
    StrategyRegistry: strategy,
    MatchRootRegistry: matchRoot,
    TournamentEscrow: escrow,
    deployedAt: new Date().toISOString(),
  };
  const dir = path.resolve(__dirname, '../deployments');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'injectiveTestnet.json'), JSON.stringify(addresses, null, 2));
  console.log(JSON.stringify(addresses, null, 2));
  console.log('ADDR_PASSPORT=' + PASSPORT);
  console.log('ADDR_STRATEGY=' + strategy);
  console.log('ADDR_MATCHROOT=' + matchRoot);
  console.log('ADDR_TOURNEY=' + escrow);
}

main().catch((e) => { console.error(e); process.exit(1); });
