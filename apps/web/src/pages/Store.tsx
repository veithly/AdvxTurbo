import React, { useState } from 'react';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useToast } from '../ui.js';
import { PixelSprite } from '../PixelSprite.js';
import { sfx } from '../audio.js';

interface Item {
  prop: string;
  nameKey: string;
  nameEn: string;
  price: number;
  onchain: boolean;
  transferable: boolean;
}

// 装饰道具全部由 8-bit 生成器代码渲染（PixelSprite），不使用任何 PNG
const ITEMS: Item[] = [
  { prop: 'coffee', nameKey: 'store.item.mug', nameEn: 'Golden Coffee Mug', price: 80, onchain: true, transferable: true },
  { prop: 'ppt', nameKey: 'store.item.board', nameEn: 'Sticky Note Banner', price: 40, onchain: false, transferable: false },
  { prop: 'ticket', nameKey: 'store.item.keycard', nameEn: 'Neon Keycard Skin', price: 110, onchain: true, transferable: true },
  { prop: 'server', nameKey: 'store.item.shield', nameEn: 'Server Rack Deco', price: 120, onchain: true, transferable: true },
  { prop: 'green_bug', nameKey: 'store.item.hotfix', nameEn: 'Lucky Green Bug Pet', price: 90, onchain: false, transferable: false },
  { prop: 'purple_bug', nameKey: 'store.item.speed', nameEn: 'Purple Exploit Pet', price: 150, onchain: true, transferable: true },
  { prop: 'hidden_bug', nameKey: 'store.item.tea', nameEn: 'Hidden Bug Plush', price: 60, onchain: false, transferable: false },
  { prop: 'red_bug', nameKey: 'store.item.plant', nameEn: 'Critical Bug Trophy', price: 50, onchain: false, transferable: false },
];

export function Store() {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState('');

  // 链上装饰品：购买即 mint 真 NFT 到你连接的钱包（AdvxRegistry）
  async function buy(it: Item) {
    sfx('click');
    if (!it.onchain) { sfx('success'); toast.show('✔ ' + t(it.nameKey, it.nameEn)); return; }
    setBusy(it.nameKey);
    try {
      const r: any = await api.post('/api/chain/store/mint', { item: it.prop, name: it.nameEn });
      if (r.error) toast.show(r.error, 'err');
      else { sfx('success'); toast.show('⛓ NFT 已 mint 到你的钱包 · ' + (r.txHash || '').slice(0, 12) + '…'); }
    } catch (e: any) {
      toast.show(e.data?.message || e.message, 'err');
    } finally { setBusy(''); }
  }

  async function claimReward() {
    sfx('click');
    try {
      const r: any = await api.post('/api/chain/reward/claim', {});
      if (r.error) toast.show(r.error, 'err');
      else { sfx('success'); toast.show('🎁 INJ 奖励已发到你的钱包 · ' + (r.txHash || '').slice(0, 12) + '…'); }
    } catch (e: any) {
      toast.show(e.data?.message || e.message, 'err');
    }
  }

  return (
    <div className="content">
      <div className="row between">
        <h2 className="page-title">🛍 {t('store.title')}</h2>
        <div className="row">
          <button className="btn sm green" onClick={claimReward}>🎁 领今日 INJ 奖励</button>
          <span className="tag yellow">☕ 480 {t('store.coffeePoints')}</span>
        </div>
      </div>
      <p className="page-sub muted">{t('store.desc')} · {t('store.cosmetic')} (code-rendered)</p>

      <div className="grid c4">
        {ITEMS.map((it) => (
          <div key={it.nameKey} className="card center">
            <div style={{ display: 'flex', justifyContent: 'center' }}><PixelSprite kind="prop" name={it.prop} size={56} /></div>
            <div className="small" style={{ color: 'var(--cream)' }}>{t(it.nameKey, it.nameEn)}</div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <span className={`tag ${it.onchain ? 'cyan' : 'gray'}`}>{it.onchain ? t('store.onchain') : t('store.offchain')}</span>
              <span className="tag">{it.transferable ? t('store.transferable') : t('store.notTransferable')}</span>
            </div>
            <div className="small muted">☕ {it.price} {t('store.coffeePoints')}</div>
            <button className="btn sm primary block" disabled={busy === it.nameKey} onClick={() => buy(it)}>{busy === it.nameKey ? '⛓…' : t('store.buy')}{it.onchain ? ' (mint NFT)' : ''}</button>
          </div>
        ))}
      </div>

      <p className="small muted center" style={{ marginTop: 12 }}>no win-rate for sale · 全部为代码渲染 8-bit 装饰</p>
    </div>
  );
}
