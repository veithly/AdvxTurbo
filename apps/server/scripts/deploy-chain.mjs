// Compile + deploy BlameAnchor to Injective EVM testnet, then send one real anchor tx.
// Run from apps/server:  node --env-file=../../.env scripts/deploy-chain.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../contracts/BlameAnchor.sol');
const OUT = path.join(__dirname, '../chain-deploy.json');

const RPC = process.env.INJECTIVE_TESTNET_RPC || 'https://k8s.testnet.json-rpc.injective.network/';
const CHAIN_ID = 1439;
const EXPLORER = 'https://testnet.blockscout.injective.network';
const pk = process.env.PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;
if (!pk) { console.error('Missing PRIVATE_KEY in env'); process.exit(1); }

// --- compile ---
const source = fs.readFileSync(SRC, 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'BlameAnchor.sol': { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
if (out.errors) {
  const fatal = out.errors.filter((e) => e.severity === 'error');
  for (const e of out.errors) console.log(e.formattedMessage);
  if (fatal.length) process.exit(1);
}
const c = out.contracts['BlameAnchor.sol']['BlameAnchor'];
const abi = c.abi;
const bytecode = '0x' + c.evm.bytecode.object;
console.log('compiled BlameAnchor, bytecode bytes:', (bytecode.length - 2) / 2);

// --- deploy ---
const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
const wallet = new ethers.Wallet(pk, provider);
const addr = await wallet.getAddress();
const bal = await provider.getBalance(addr);
console.log('deployer:', addr, '| balance INJ:', ethers.formatEther(bal));

const factory = new ethers.ContractFactory(abi, bytecode, wallet);
const contract = await factory.deploy();
const deployTx = contract.deploymentTransaction();
console.log('deploy tx sent:', deployTx.hash);
await contract.waitForDeployment();
const contractAddress = await contract.getAddress();
console.log('BlameAnchor deployed at:', contractAddress);

// --- one real anchor tx (demo root) ---
const demoRoot = ethers.keccak256(ethers.toUtf8Bytes('catch-the-hotspot:first-anchor:' + Date.now()));
const tx = await contract.anchorMatch(demoRoot);
console.log('anchor tx sent:', tx.hash);
const rc = await tx.wait();
console.log('anchor confirmed in block:', rc.blockNumber);

const result = {
  network: 'injective-evm-testnet',
  chainId: CHAIN_ID,
  explorer: EXPLORER,
  deployer: addr,
  contract: 'BlameAnchor',
  address: contractAddress,
  deployTx: deployTx.hash,
  anchorTx: tx.hash,
  demoRoot,
  abi,
  deployedAt: new Date().toISOString(),
};
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log('\n=== DEPLOY RESULT ===');
console.log('contract:', `${EXPLORER}/address/${contractAddress}`);
console.log('deploy tx:', `${EXPLORER}/tx/${deployTx.hash}`);
console.log('anchor tx:', `${EXPLORER}/tx/${tx.hash}`);
console.log('saved ->', OUT);
