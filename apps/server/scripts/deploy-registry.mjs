// Compile + deploy AdvxRegistry (ERC-8004-style identity + item NFTs) to Injective EVM testnet.
// Run from apps/server:  node --env-file=../../.env scripts/deploy-registry.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../contracts/AdvxRegistry.sol');
const OUT = path.join(__dirname, '../chain-registry.json');
const RPC = process.env.INJECTIVE_TESTNET_RPC || 'https://k8s.testnet.json-rpc.injective.network/';
const CHAIN_ID = 1439;
const EXPLORER = 'https://testnet.blockscout.injective.network';
const pk = process.env.PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;
if (!pk) { console.error('Missing PRIVATE_KEY'); process.exit(1); }

const source = fs.readFileSync(SRC, 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'AdvxRegistry.sol': { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
if (out.errors) { for (const e of out.errors) console.log(e.formattedMessage); if (out.errors.some((e) => e.severity === 'error')) process.exit(1); }
const c = out.contracts['AdvxRegistry.sol']['AdvxRegistry'];
const abi = c.abi;
const bytecode = '0x' + c.evm.bytecode.object;
console.log('compiled AdvxRegistry, bytes:', (bytecode.length - 2) / 2);

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
const wallet = new ethers.Wallet(pk, provider);
const addr = await wallet.getAddress();
const nonce = await provider.getTransactionCount(addr, 'latest');
const predicted = ethers.getCreateAddress({ from: addr, nonce });
console.log('deployer:', addr, '| nonce:', nonce, '| predicted:', predicted);
console.log('balance:', ethers.formatEther(await provider.getBalance(addr)), 'INJ');

const factory = new ethers.ContractFactory(abi, bytecode, wallet);
const contract = await factory.deploy();
const deployTx = contract.deploymentTransaction();
console.log('deploy tx sent:', deployTx.hash);

// 轮询 getCode 确认（避免 waitForDeployment 在慢 RPC 上挂起）
let deployed = false;
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const code = await provider.getCode(predicted);
  if (code && code !== '0x') { deployed = true; console.log('code confirmed, bytes:', (code.length - 2) / 2); break; }
  console.log('waiting for code...', i + 1);
}
if (!deployed) { console.error('deploy not confirmed in 60s (check explorer later):', `${EXPLORER}/address/${predicted}`); process.exit(1); }

const result = {
  network: 'injective-evm-testnet', chainId: CHAIN_ID, explorer: EXPLORER,
  deployer: addr, contract: 'AdvxRegistry', address: predicted, deployTx: deployTx.hash,
  abi, deployedAt: new Date().toISOString(),
};
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log('=== ADVX REGISTRY DEPLOYED ===');
console.log('address:', `${EXPLORER}/address/${predicted}`);
console.log('deployTx:', `${EXPLORER}/tx/${deployTx.hash}`);
console.log('saved ->', OUT);
