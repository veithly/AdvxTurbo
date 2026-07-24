import React, { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Avatar, Loading, useToast } from '../ui.js';
import { sfx } from '../audio.js';

function randAddr() {
  return '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
}

export function ChainVault() {
  const t = useT();
  const { user, wallet, refreshWallet } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [status, setStatus] = useState<Record<string, any>>({});
  const [events, setEvents] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/chain/info').then(setInfo).catch(() => {});
    api.get('/api/chain/events').then(setEvents).catch(() => {});
    if (user) {
      api.get('/api/workers').then(setWorkers).catch(() => {});
      api.get('/api/chain/claims').then(setClaims).catch(() => {});
    }
  }, [user]);

  useEffect(() => { workers.forEach(loadStatus); }, [workers]);
  useEffect(() => {
    if (wallet?.address_normalized) {
      api.get('/api/chain/balance/' + wallet.address_normalized).then((b) => setBalance(b.inj)).catch(() => {});
    }
  }, [wallet]);

  async function loadStatus(w: any) {
    try {
      const st = await api.get('/api/chain/worker-status/' + w.id);
      setStatus((s) => ({ ...s, [w.id]: st }));
    } catch {}
  }
  function err(e: any) { toast.show(e.data?.message || e.message, 'err'); }

  async function linkWallet() {
    sfx('click', 0.3);
    try {
      await api.post('/api/auth/wallet/link', { address: randAddr() });
      await refreshWallet();
      toast.show(t('chain.linkWallet'));
    } catch (e) { err(e); }
  }
  async function faucet() {
    sfx('click', 0.3);
    try {
      const r = await api.post('/api/chain/faucet', {});
      const amt = r.balance?.amount ?? r.amount;
      if (amt != null) setBalance(String(amt));
      toast.show(t('chain.faucetOk') + (r.txHash ? ' ' + String(r.txHash).slice(0, 10) + '…' : ''));
    } catch (e) { err(e); }
  }
  async function mint(w: any) {
    sfx('click', 0.3);
    try { await api.post('/api/chain/passport/mint', { workerId: w.id }); toast.show(t('chain.minted')); await loadStatus(w); }
    catch (e) { err(e); }
  }
  async function register(w: any) {
    sfx('click', 0.3);
    try {
      const versions = await api.get('/api/workers/' + w.id + '/versions');
      const published = versions.filter((v: any) => v.published_at || v.status === 'published');
      const versionId = (published[published.length - 1] || versions[versions.length - 1])?.id;
      await api.post('/api/chain/strategy/register', { workerId: w.id, versionId });
      toast.show(t('chain.strategyReg'));
      await loadStatus(w);
    } catch (e) { err(e); }
  }

  if (!info) return <Loading />;

  return (
    <div className="content">
      <h2 className="page-title">⛓ {t('chain.title')}</h2>
      <div className="card">
        <p>{t('chain.network')}: {info.name} (chainId {info.chainId})</p>
        <p className="small muted">{info.mode === 'mock' ? t('chain.mockNote') : t('chain.liveNote')}</p>
      </div>

      <div className="card">
        <h3>{t('chain.wallet')}</h3>
        {!wallet ? (
          <button className="btn primary" onClick={linkWallet}>{t('chain.simulateWallet')}</button>
        ) : (
          <>
            <p className="small"><code>{wallet.address_display}</code></p>
            <p className="small muted">{t('chain.balance')}: {balance != null ? (Number(balance) / 1e18) + ' INJ' : '—'}</p>
            <button className="btn sm cyan" onClick={faucet}>{t('chain.faucet')}</button>
            {info.explorer && (
              <a className="btn sm" href={`${info.explorer}/address/${wallet.address_normalized}`} target="_blank" rel="noreferrer">{t('chain.explorer')} →</a>
            )}
          </>
        )}
      </div>

      {user && (
        <div className="grid c2">
          {workers.map((w) => {
            const st = status[w.id];
            const passport = st?.passport;
            return (
              <div key={w.id} className="card">
                <div className="row"><Avatar role={w.role} size={48} /><h3>{w.name}</h3></div>
                <div className="row">
                  {passport
                    ? <span className="tag cyan">{t('chain.minted')} #{passport.token_id}</span>
                    : <span className="tag gray">{t('chain.notMinted')}</span>}
                  <span className="small muted">{t('chain.strategyReg')}: {st?.registrations?.length ?? 0}</span>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  {!passport && <button className="btn sm primary" onClick={() => mint(w)}>{t('chain.mintPassport')}</button>}
                  {passport && <button className="btn sm purple" onClick={() => register(w)}>{t('chain.registerStrategy')}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {user && (
        <div className="card">
          <h3>{t('chain.claimable')}</h3>
          {claims.length === 0 ? <p className="muted small">{t('common.empty')}</p> : (
            <table className="tbl">
              <thead><tr><th></th><th>{t('tour.reward')}</th><th>{t('tour.status')}</th><th>{t('chain.txHash')}</th></tr></thead>
              <tbody>
                {claims.map((c, i) => (
                  <tr key={i}>
                    <td className="small">{c.token}</td>
                    <td>{Number(c.amount_base_units) / 1e6}</td>
                    <td><span className="tag gray">{c.status}</span></td>
                    <td className="small muted"><code>{c.tx_hash ? String(c.tx_hash).slice(0, 12) + '…' : '—'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="card dark">
        <h3>{t('chain.events')}</h3>
        {events.length === 0 ? <p className="muted small">{t('common.empty')}</p> : (
          events.slice(0, 20).map((ev, i) => (
            <div key={i} className="row between small">
              <span className="tag purple">{ev.event_name}</span>
              <code className="muted">{ev.tx_hash ? String(ev.tx_hash).slice(0, 12) + '…' : '—'}</code>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
