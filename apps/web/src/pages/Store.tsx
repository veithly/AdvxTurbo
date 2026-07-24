import React from 'react';
import { useT } from '../i18n/index.js';
import { nativeAsset } from '../api.js';
import { useToast } from '../ui.js';
import { sfx } from '../audio.js';

interface Item {
  asset: string;
  nameKey: string;
  nameEn: string;
  price: number;
  onchain: boolean;
  transferable: boolean;
}

const ITEMS: Item[] = [
  { asset: 'vfx/05_blue_shield.png', nameKey: 'store.item.shield', nameEn: 'Blue Shield Trail', price: 120, onchain: true, transferable: true },
  { asset: 'vfx/01_hotfix_green_sparks.png', nameKey: 'store.item.hotfix', nameEn: 'Hotfix Sparks FX', price: 90, onchain: false, transferable: false },
  { asset: 'vfx/07_coffee_speed_boost.png', nameKey: 'store.item.speed', nameEn: 'Coffee Speed Aura', price: 150, onchain: false, transferable: false },
  { asset: 'props/07_bubble_tea.png', nameKey: 'store.item.tea', nameEn: 'Bubble Tea Emote', price: 60, onchain: false, transferable: false },
  { asset: 'props/05_coffee_mug.png', nameKey: 'store.item.mug', nameEn: 'Golden Coffee Mug', price: 80, onchain: true, transferable: true },
  { asset: 'props/22_sticky_note_board.png', nameKey: 'store.item.board', nameEn: 'Sticky Note Banner', price: 40, onchain: false, transferable: false },
  { asset: 'props/27_worker_keycard.png', nameKey: 'store.item.keycard', nameEn: 'Neon Keycard Skin', price: 110, onchain: true, transferable: true },
  { asset: 'props/20_potted_plant.png', nameKey: 'store.item.plant', nameEn: 'Desk Plant Deco', price: 50, onchain: false, transferable: false },
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
      <p className="page-sub muted">{t('store.desc')}</p>

      <div className="grid c4">
        {ITEMS.map((it) => (
          <div key={it.nameKey} className="card center">
            <img src={nativeAsset(it.asset)} width={48} height={48} alt={it.nameEn} style={{ imageRendering: 'pixelated' }} />
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

      <p className="small muted center" style={{ marginTop: 12 }}>{t('store.cosmetic')} · no win-rate for sale</p>
    </div>
  );
}
