import { db, now } from '../db.js';
import { id } from '../util.js';
import * as economy from './economy.js';
import * as accounts from './accounts.js';
import * as chain from '../chain/gateway.js';
import { itemMetadata } from '../chain/nftArt.js';

// 商店目录（价格与上链属性以服务端为准，前端只做展示，防止客户端改价）
export interface StoreItem {
  prop: string;
  nameEn: string;
  price: number;
  onchain: boolean;
  transferable: boolean;
}

export const STORE_ITEMS: StoreItem[] = [
  { prop: 'coffee', nameEn: 'Golden Coffee Mug', price: 80, onchain: true, transferable: true },
  { prop: 'ppt', nameEn: 'Sticky Note Banner', price: 40, onchain: false, transferable: false },
  { prop: 'ticket', nameEn: 'Neon Keycard Skin', price: 110, onchain: true, transferable: true },
  { prop: 'server', nameEn: 'Server Rack Deco', price: 120, onchain: true, transferable: true },
  { prop: 'green_bug', nameEn: 'Lucky Green Bug Pet', price: 90, onchain: false, transferable: false },
  { prop: 'purple_bug', nameEn: 'Purple Exploit Pet', price: 150, onchain: true, transferable: true },
  { prop: 'hidden_bug', nameEn: 'Hidden Bug Plush', price: 60, onchain: false, transferable: false },
  { prop: 'red_bug', nameEn: 'Critical Bug Trophy', price: 50, onchain: false, transferable: false },
];

// 玩家装饰品库存：链上件记录真实 txHash / tokenId（tokenId 回执确认后回填）
db.exec(`
CREATE TABLE IF NOT EXISTS store_inventory (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  item TEXT,
  name TEXT,
  price INTEGER,
  onchain INTEGER DEFAULT 0,
  token_id INTEGER,
  tx_hash TEXT,
  created_at TEXT,
  UNIQUE (user_id, item)
);
`);

export function inventoryFor(userId: string): any[] {
  return db.prepare('SELECT * FROM store_inventory WHERE user_id=? ORDER BY created_at DESC').all(userId) as any[];
}

/** 购买装饰品：真扣 CP；链上件 mint 真 NFT（失败自动退款），每件限购 1 次 */
export async function buyItem(userId: string, prop: string) {
  const item = STORE_ITEMS.find((i) => i.prop === prop);
  if (!item) return { error: 'ITEM_NOT_FOUND' };
  const owned = db.prepare('SELECT id FROM store_inventory WHERE user_id=? AND item=?').get(userId, prop);
  if (owned) return { error: 'ALREADY_OWNED', message: '已拥有该装饰品' };

  // 链上件必须先有钱包（插件钱包或托管钱包均可）
  let to = '';
  if (item.onchain) {
    to = (accounts.walletFor(userId)?.address_normalized || '').toLowerCase();
    if (!to.startsWith('0x')) return { error: 'NO_WALLET', message: '请先连接钱包或创建托管钱包，NFT 会 mint 到你自己的钱包' };
  }

  // 真扣 CP（余额不足直接失败）
  try {
    economy.spend(userId, item.price, 'store_item', prop);
  } catch {
    return { error: 'INSUFFICIENT_CP', message: `CP 不足，需要 ${item.price} ☕` };
  }

  // 非链上件：本地库存即完成
  if (!item.onchain) {
    db.prepare('INSERT INTO store_inventory (id, user_id, item, name, price, onchain, token_id, tx_hash, created_at) VALUES (?,?,?,?,?,0,NULL,NULL,?)')
      .run(id('inv'), userId, prop, item.nameEn, item.price, now());
    return { ok: true, onchain: false, item: prop, balance: economy.balance(userId) };
  }

  // 链上件：tokenURI 用完全上链的 data:URI（8-bit 卡片），钱包/浏览器可直接显示
  const art = itemMetadata(prop, item.nameEn, item.price);
  const r = await chain.mintItemOnChain(to, art.tokenURI);
  if ('error' in r && r.error) {
    economy.earn(userId, item.price, 'store_refund', prop); // mint 失败退款
    return { error: 'MINT_FAILED', message: r.error };
  }
  const txHash = (r as any).txHash as string;
  const invId = id('inv');
  db.prepare('INSERT INTO store_inventory (id, user_id, item, name, price, onchain, token_id, tx_hash, created_at) VALUES (?,?,?,?,?,1,NULL,?,?)')
    .run(invId, userId, prop, item.nameEn, item.price, txHash, now());
  // 后台回填链上 tokenId
  chain.watchItemTokenId(txHash, (tokenId) => {
    db.prepare('UPDATE store_inventory SET token_id=? WHERE id=?').run(tokenId, invId);
    console.log('[store] item tokenId backfilled:', prop, 'tokenId', tokenId);
  });
  return { ok: true, onchain: true, item: prop, txHash, explorer: (r as any).explorer, balance: economy.balance(userId) };
}
