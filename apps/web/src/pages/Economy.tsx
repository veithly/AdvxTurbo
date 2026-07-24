import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Avatar, Bar, useToast } from '../ui.js';
import { PixelSprite } from '../PixelSprite.js';
import { sfx } from '../audio.js';

export function Economy() {
  const t = useT();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [me, setMe] = useState<any>(null);
  const [tok, setTok] = useState<any>(null);
  const [market, setMarket] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [stakeWid, setStakeWid] = useState('');
  const [stakeAmt, setStakeAmt] = useState(100);

  async function refresh() {
    const [m, tk, mk] = await Promise.all([
      api.get('/api/economy/me').catch(() => null),
      api.get('/api/economy/tokenomics'),
      api.get('/api/economy/market'),
    ]);
    setMe(m); setTok(tk); setMarket(mk);
  }
  useEffect(() => {
    refresh();
    if (user) api.get('/api/workers').then((ws) => { setWorkers(ws); if (ws[0]) setStakeWid(ws[0].id); });
  }, [user]);

  async function act(fn: () => Promise<any>, msg: string) {
    try { await fn(); await refresh(); toast.show(msg); sfx('success'); }
    catch (e: any) { toast.show(t('econ.' + (e.message || ''), e.message || 'error'), 'err'); sfx('error'); }
  }

  if (!user) return <div className="content"><div className="card center"><p>{t('common.login')}</p><button className="btn primary" onClick={() => nav('/auth')}>{t('common.login')}</button></div></div>;

  return (
    <div className="content">
      <div className="row between">
        <h2 className="page-title">💰 {t('nav.economy')}</h2>
        <span className="tag yellow">☕ {me?.balance ?? '…'} {tok?.symbol || 'CP'}</span>
      </div>
      <p className="page-sub">Coffee Points 软通证 · 质押 / 赛季通行证 / 交易市场 / 通证学</p>

      <div className="grid c2">
        {/* 通证学 */}
        <div className="card">
          <h3>📊 {t('econ.tokenomics')}</h3>
          {tok && (
            <>
              <table className="tbl"><tbody>
                <tr><td>{t('econ.minted')} (faucet)</td><td>{tok.minted}</td></tr>
                <tr><td>{t('econ.burned')} (sink)</td><td>{tok.burned}</td></tr>
                <tr><td>{t('econ.circulating')}</td><td>{tok.circulating}</td></tr>
                <tr><td>{t('econ.staked')}</td><td>{tok.staked}</td></tr>
                <tr><td>{t('econ.holders')}</td><td>{tok.holders}</td></tr>
              </tbody></table>
              <div className="small muted" style={{ marginTop: 6 }}>{t('econ.faucets')}: {tok.faucets?.map((f: any) => `${f.reason} +${f.minted}`).join(' · ')}</div>
              <div className="small muted">{t('econ.sinks')}: {tok.sinks?.map((s: any) => `${s.reason} -${s.burned}`).join(' · ') || '—'}</div>
            </>
          )}
        </div>

        {/* 赛季通行证 */}
        <div className="card">
          <h3>🎟 {t('econ.seasonPass')}</h3>
          {me && (
            <>
              <div className="row"><span className={`tag ${me.seasonPass.tier === 'premium' ? 'yellow' : 'gray'}`}>{t('econ.' + me.seasonPass.tier, me.seasonPass.tier)}</span><span className="small muted">XP {me.seasonPass.xp}</span></div>
              <Bar value={(me.seasonPass.xp % 500) / 5} color="purple" label={'Lv ' + Math.floor(me.seasonPass.xp / 500)} />
              <p className="small muted" style={{ marginTop: 6 }}>{t('econ.passHint')}</p>
              {me.seasonPass.tier !== 'premium' && <button className="btn primary sm" onClick={() => act(() => api.post('/api/economy/season-pass/buy'), t('econ.seasonPass'))}>{t('econ.buyPass')} (800 CP)</button>}
            </>
          )}
        </div>

        {/* 质押 */}
        <div className="card">
          <h3>📈 {t('econ.staking')}</h3>
          <p className="small muted">{t('econ.stakeHint')}</p>
          <div className="row">
            <select value={stakeWid} onChange={(e) => setStakeWid(e.target.value)} style={{ maxWidth: 160 }}>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <input type="number" value={stakeAmt} onChange={(e) => setStakeAmt(Number(e.target.value))} style={{ maxWidth: 90 }} />
            <button className="btn purple sm" onClick={() => act(() => api.post('/api/economy/stake', { workerId: stakeWid, amount: stakeAmt }), t('econ.stake'))}>{t('econ.stake')}</button>
          </div>
          <div style={{ marginTop: 8 }}>
            {(me?.stakes || []).length === 0 && <p className="muted small">{t('common.empty')}</p>}
            {(me?.stakes || []).map((s: any) => (
              <div key={s.id} className="row between" style={{ borderBottom: '1px solid var(--gray2)', padding: '4px 0' }}>
                <span className="row"><Avatar role={s.role} size={28} /> <span className="small">{s.worker_name}</span></span>
                <span className="small">☕{s.amount} · <span style={{ color: 'var(--green2)' }}>+{s.yield_pending}</span></span>
                <span className="row">
                  <button className="btn sm green" disabled={!s.yield_pending} onClick={() => act(() => api.post('/api/economy/stake/claim', { stakeId: s.id }), t('econ.claim'))}>{t('econ.claim')}</button>
                  <button className="btn sm" onClick={() => act(() => api.post('/api/economy/unstake', { stakeId: s.id }), t('econ.unstake'))}>{t('econ.unstake')}</button>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 交易市场 */}
        <div className="card">
          <h3>🛒 {t('econ.market')}</h3>
          <div className="row">
            <button className="btn sm" onClick={() => act(() => api.post('/api/economy/market/list', { item: 'coffee', name: 'Golden Mug', price: 120 }), t('econ.list'))}>+ {t('econ.list')} (120)</button>
          </div>
          <div style={{ marginTop: 8, maxHeight: 220, overflow: 'auto' }}>
            {market.length === 0 && <p className="muted small">{t('common.empty')}</p>}
            {market.map((l) => (
              <div key={l.id} className="row between" style={{ borderBottom: '1px solid var(--gray2)', padding: '4px 0' }}>
                <span className="row"><PixelSprite kind="prop" name={l.item} size={26} /> <span className="small">{l.name}</span></span>
                <span className="small muted">{l.seller}</span>
                <span className="row"><span className="tag yellow">☕{l.price}</span><button className="btn sm primary" onClick={() => act(() => api.post('/api/economy/market/buy', { listingId: l.id }), t('econ.buy'))}>{t('econ.buy')}</button></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 账本 */}
      <div className="card">
        <h3>🧾 {t('econ.history')}</h3>
        <table className="tbl"><thead><tr><th>{t('econ.reason')}</th><th>Δ CP</th><th>ref</th></tr></thead><tbody>
          {(me?.history || []).map((h: any) => (
            <tr key={h.id}><td>{h.reason}</td><td style={{ color: h.delta > 0 ? 'var(--green2)' : 'var(--red2)' }}>{h.delta > 0 ? '+' : ''}{h.delta}</td><td className="small muted">{h.ref}</td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}
