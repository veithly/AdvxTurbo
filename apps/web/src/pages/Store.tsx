import React, { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useToast } from '../ui.js';
import { PixelSprite } from '../PixelSprite.js';
import { sfx } from '../audio.js';

const EXPLORER = 'https://testnet.blockscout.injective.network';

interface Item {
  prop: string;
  nameEn: string;
  price: number;
  onchain: boolean;
  transferable: boolean;
}

// 展示名 i18n key（目录数据以服务端 /api/store/catalog 为准）
const NAME_KEYS: Record<string, string> = {
  coffee: 'store.item.mug', ppt: 'store.item.board', ticket: 'store.item.keycard', server: 'store.item.shield',
  green_bug: 'store.item.hotfix', purple_bug: 'store.item.speed', hidden_bug: 'store.item.tea', red_bug: 'store.item.plant',
};

export function Store() {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [inventory, setInventory] = useState<Record<string, any>>({});

  async function refresh() {
    try {
      const inv = await api.get('/api/store/inventory');
      setBalance(inv.balance);
      setInventory(Object.fromEntries((inv.items || []).map((i: any) => [i.item, i])));
    } catch {}
  }

  useEffect(() => {
    api.get('/api/store/catalog').then(setItems).catch(() => {});
    refresh();
  }, []);

  // 购买：服务端真扣 CP；链上件由 relayer mint 真 NFT 到你的钱包（含托管钱包）
  async function buy(it: Item) {
    sfx('click');
    setBusy(it.prop);
    try {
      const r: any = await api.post('/api/chain/store/mint', { item: it.prop });
      sfx('success');
      toast.show(it.onchain
        ? '⛓ NFT 已 mint 到你的钱包 · ' + (r.txHash || '').slice(0, 12) + '…'
        : '✔ 已入手 ' + t(NAME_KEYS[it.prop], it.nameEn) + ' · -' + it.price + ' ☕');
      if (typeof r.balance === 'number') setBalance(r.balance);
      refresh();
    } catch (e: any) {
      toast.show(e.data?.message || e.data?.code || e.message, 'err');
      sfx('error');
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
          <span className="tag yellow">☕ {balance ?? '—'} {t('store.coffeePoints')}</span>
        </div>
      </div>
      <p className="page-sub muted">{t('store.desc')} · {t('store.cosmetic')} (code-rendered)</p>

      <div className="grid c4">
        {items.map((it) => {
          const owned = inventory[it.prop];
          return (
            <div key={it.prop} className="card center">
              <div style={{ display: 'flex', justifyContent: 'center' }}><PixelSprite kind="prop" name={it.prop} size={56} /></div>
              <div className="small" style={{ color: 'var(--cream)' }}>{t(NAME_KEYS[it.prop], it.nameEn)}</div>
              <div className="row" style={{ justifyContent: 'center' }}>
                <span className={`tag ${it.onchain ? 'cyan' : 'gray'}`}>{it.onchain ? t('store.onchain') : t('store.offchain')}</span>
                <span className="tag">{it.transferable ? t('store.transferable') : t('store.notTransferable')}</span>
              </div>
              <div className="small muted">☕ {it.price} {t('store.coffeePoints')}</div>
              {owned ? (
                <div className="small">
                  <span className="tag green">✔ {t('store.owned')}{owned.token_id ? ` · #${owned.token_id}` : ''}</span>
                  {owned.tx_hash && (
                    <a className="small" style={{ marginLeft: 6 }} href={`${EXPLORER}/tx/${owned.tx_hash}`} target="_blank" rel="noreferrer">tx →</a>
                  )}
                </div>
              ) : (
                <button className="btn sm primary block" disabled={busy === it.prop} onClick={() => buy(it)}>
                  {busy === it.prop ? '⛓…' : t('store.buy') + (it.onchain ? ' (mint NFT)' : '')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="small muted center" style={{ marginTop: 12 }}>no win-rate for sale · 全部为代码渲染 8-bit 装饰</p>
    </div>
  );
}
