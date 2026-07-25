import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import solc from 'solc'; import { ethers } from 'ethers';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RPC='https://k8s.testnet.json-rpc.injective.network/'; const CHAIN_ID=1439; const EXPLORER='https://testnet.blockscout.injective.network';
const src=fs.readFileSync(path.join(__dirname,'../contracts/BlameAnchor.sol'),'utf8');
const input={language:'Solidity',sources:{'BlameAnchor.sol':{content:src}},settings:{optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi']}}}};
const abi=JSON.parse(solc.compile(JSON.stringify(input))).contracts['BlameAnchor.sol']['BlameAnchor'].abi;
const p=new ethers.JsonRpcProvider(RPC,CHAIN_ID); const w=new ethers.Wallet(process.env.PRIVATE_KEY,p); const addr=await w.getAddress();
const address=ethers.getCreateAddress({from:addr,nonce:0});
const code=await p.getCode(address); console.log('contract code bytes:',(code.length-2)/2);
const c=new ethers.Contract(address,abi,p);
const count=await c.matchCount(); const owner=await c.owner();
const root=ethers.keccak256(ethers.toUtf8Bytes('catch-the-hotspot:first-anchor'));
const anchored=await c.isAnchored(root);
console.log('owner:',owner,'| matchCount:',count.toString(),'| demoRoot anchored:',anchored);
// tx hashes via blockscout v2
let deployTx=null,anchorTx=null;
try{const r=await fetch(`${EXPLORER}/api/v2/addresses/${addr}/transactions?filter=to%7Cfrom`);const j=await r.json();const items=(j.items||[]).slice().sort((a,b)=>(a.nonce||0)-(b.nonce||0));for(const t of items){if(t.nonce===0)deployTx=t.hash;if(t.nonce===1)anchorTx=t.hash;}}catch(e){console.log('v2 err',e.message);}
const result={network:'injective-evm-testnet',chainId:CHAIN_ID,explorer:EXPLORER,deployer:addr,contract:'BlameAnchor',address,owner,matchCount:count.toString(),demoRoot:root,demoRootAnchored:anchored,deployTx,anchorTx,abi,deployedAt:new Date().toISOString()};
fs.writeFileSync(path.join(__dirname,'../chain-deploy.json'),JSON.stringify(result,null,2));
console.log('address page:',`${EXPLORER}/address/${address}`);
console.log('deployTx:',deployTx||'(see address page)','anchorTx:',anchorTx||'(see address page)');
