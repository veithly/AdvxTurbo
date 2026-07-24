import React, { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Avatar, Loading, useToast } from '../ui.js';
import { sfx } from '../audio.js';
import { useWallet, sendTx, explorerTx, explorerAddr, hasWallet, INJECTIVE_TESTNET, WalletButton } from '../wallet.js';

function randAddr() {
  return '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
}

export function ChainVault() {
  const t = useT();
  const { user, wallet, refreshWallet } = useAuth();
  const w2 = useWallet();
  const toast = useToast();
  const [info, setInfo] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [status, setStatus] = useState<Record<string, any>>({});
  const [events, setEvents] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [anchors, setAnchors] = useState<any[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [txBusy, setTxBusy] = useState('');

  useEffect(() => {
    api.get('/api/chain/info').then(setInfo).catch(() => {});
    api.get('/api/chain/events').then(setEvents).catch(() => {});
    if (user) {
      api.get('/api/workers').then(setWorkers).catch(() => {});
      api.get('/api/chain/claims').then(setClaims).catch(() => {});
      api.get('/api/chain/anchors').then(setAnchors).catch(() => {});
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

  // 用真实钱包发送链上交易 (self-anchor 携带承诺)，并回传服务端记录
  async function walletTx(kind: string, workerId?: string) {
    if (!w2.address) { toast.show(t('chain.connectFirst'), 'err'); await w2.connect(); return; }
    setTxBusy(kind + (workerId || ''));
    try {
      const txHash = await sendTx({ payload: { kind, workerId: workerId || null, at: Date.now() } });
      await api.post('/api/chain/record', { workerId, kind, txHash, address: w2.address, chainId: INJECTIVE_TESTNET.chainIdDec });
      setAnchors(await api.get('/api/chain/anchors'));
      toast.show(t('chain.anchored') + ' ' + txHash.slice(0, 10) + '…');
      sfx('success');
    } catch (e: any) {
      toast.show(e?.message || 'tx failed', 'err'); sfx('error');
    } finally { setTxBusy(''); }
  }

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

      {/* 真实钱包链上交易 */}
      <div className="card" style={{ borderColor: 'var(--purple)' }}>
        <div className="row between"><h3>⛓ {t('chain.realTx')} · Injective EVM 1439</h3><WalletButton /></div>
        <p className="small muted">{t('chain.walletTx')} — {INJECTIVE_TESTNET.chainName}. {hasWallet() ? '' : '(MetaMask / OKX Wallet)'}</p>
        {w2.address && (
          <p className="small">{w2.address.slice(0, 12)}… · {w2.balance != null ? (Number(BigInt(w2.balance)) / 1e18).toFixed(4) + ' INJ' : ''} · <a href={explorerAddr(w2.address)} target="_blank" rel="noreferrer">Explorer →</a></p>
        )}
        <div className="row" style={{ marginTop: 6 }}>
          <button className="btn purple sm" disabled={!!txBusy} onClick={() => walletTx('passport_mint', workers[0]?.id)}>🪩 Passport TX</button>
          <button className="btn cyan sm" disabled={!!txBusy} onClick={() => walletTx('strategy_register', workers[0]?.id)}>📝 Strategy TX</button>
          <button className="btn sm" disabled={!!txBusy} onClick={() => walletTx('anchor')}>⚓ Anchor TX</button>
        </div>
        {anchors.length > 0 && (
          <div style={{ marginTop: 8, maxHeight: 150, overflow: 'auto' }}>
            <div className="small muted">{t('chain.onchainHistory')}</div>
            {anchors.map((a) => (
              <div key={a.id} className="row between small" style={{ padding: '2px 0' }}>
                <span className="tag purple">{a.kind}</span>
                <a href={explorerTx(a.tx_hash)} target="_blank" rel="noreferrer"><code>{String(a.tx_hash).slice(0, 16)}…</code></a>
              </div>
            ))}
          </div>
        )}
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
