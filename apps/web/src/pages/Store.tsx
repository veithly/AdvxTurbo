import React from 'react';
import { useT } from '../i18n/index.js';
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

  function buy() {
    sfx('success');
    toast.show('✔');
  }

  return (
    <div className="content">
      <div className="row between">
        <h2 className="page-title">🛍 {t('store.title')}</h2>
        <span className="tag yellow">☕ 480 {t('store.coffeePoints')}</span>
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
            <button className="btn sm primary block" onClick={buy}>{t('store.buy')}</button>
          </div>
        ))}
      </div>

      <p className="small muted center" style={{ marginTop: 12 }}>no win-rate for sale · 全部为代码渲染 8-bit 装饰</p>
    </div>
  );
}
