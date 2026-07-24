// 一次性脚本：为已上链的护照 NFT 补「形象+名字」卡片图（updateMetadata 重刷 tokenURI）
// 用法: RELAYER_PRIVATE_KEY=... ADDR_PASSPORT=... node --import tsx scripts/refresh-nft-art.ts <workerId...>
import { initChain, refreshPassportArtOnChain } from '../src/chain/gateway.js';

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('usage: refresh-nft-art.ts <workerId...>');
  process.exit(1);
}

const mode = initChain();
console.log('chain mode:', mode);

for (const wid of ids) {
  try {
    const r = await refreshPassportArtOnChain(wid);
    console.log(wid, '=>', JSON.stringify(r));
  } catch (e: any) {
    console.error(wid, 'FAILED:', e?.message || e);
  }
}
