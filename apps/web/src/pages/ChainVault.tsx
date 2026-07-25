import React, { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Avatar, Loading, useToast } from '../ui.js';
import { sfx } from '../audio.js';
import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useSendTransaction, useSwitchChain, useBalance } from 'wagmi';

const EXPLORER = 'https://testnet.blockscout.injective.network';
const explorerTx = (h: string) => `${EXPLORER}/tx/${h}`;
const explorerAddr = (a: string) => `${EXPLORER}/address/${a}`;

// 自锚定交易 data：把承诺载荷编成 hex
function toHexData(obj: unknown): `0x${string}` {
  const s = 'BLAME:' + JSON.stringify(obj);
  let out = '0x';
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16).padStart(2, '0');
  return out as `0x${string}`;
}

export function ChainVault() {
  const t = useT();
  const { user } = useAuth();
  const { address, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const injBalance = useBalance({ address, chainId: 1439 });
  const toast = useToast();
  const [info, setInfo] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [status, setStatus] = useState<Record<string, any>>({});
  const [events, setEvents] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [anchors, setAnchors] = useState<any[]>([]);
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

  async function loadStatus(w: any) {
    try {
      const st = await api.get('/api/chain/worker-status/' + w.id);
      setStatus((s) => ({ ...s, [w.id]: st }));
    } catch {}
  }
  function err(e: any) { toast.show(e.data?.message || e.message, 'err'); }

  // 用真实钱包（wagmi/RainbowKit）发送链上交易 (self-anchor 携带承诺)，并回传服务端记录
  async function walletTx(kind: string, workerId?: string) {
    if (!address) { toast.show(t('chain.connectFirst'), 'err'); openConnectModal?.(); return; }
    setTxBusy(kind + (workerId || ''));
    try {
      if (chainId !== 1439) await switchChainAsync({ chainId: 1439 });
      const txHash = await sendTransactionAsync({ to: address, value: 0n, data: toHexData({ kind, workerId: workerId || null, at: Date.now() }) });
      await api.post('/api/chain/record', { workerId, kind, txHash, address, chainId: 1439 });
      setAnchors(await api.get('/api/chain/anchors'));
      toast.show(t('chain.anchored') + ' ' + txHash.slice(0, 10) + '…');
      sfx('success');
    } catch (e: any) {
      toast.show(e?.shortMessage || e?.message || 'tx failed', 'err'); sfx('error');
    } finally { setTxBusy(''); }
  }

  async function faucet() {
    sfx('click', 0.3);
    if (!address) { toast.show(t('chain.connectFirst'), 'err'); openConnectModal?.(); return; }
    try {
      const r = await api.post('/api/chain/faucet', { address });
      injBalance.refetch?.();
      toast.show(t('chain.faucetOk') + (r.txHash ? ' ' + String(r.txHash).slice(0, 10) + '…' : ''));
    } catch (e) { err(e); }
  }
  async function mint(w: any) {
    sfx('click', 0.3);
    if (!address) { toast.show(t('chain.connectFirst'), 'err'); openConnectModal?.(); return; }
    setTxBusy('mint' + w.id);
    try {
      if (chainId !== 1439) await switchChainAsync({ chainId: 1439 });
      // 1) 玩家用连接的钱包签一笔真实确认交易（钱包弹窗在此），携带 mint 承诺
      const txHash = await sendTransactionAsync({ to: address, value: 0n, data: toHexData({ kind: 'passport_mint', workerId: w.id, at: Date.now() }) });
      await api.post('/api/chain/record', { workerId: w.id, kind: 'passport_mint', txHash, address, chainId: 1439 });
      // 2) 后端 relayer 把真 NFT mint 到同一个连接地址
      await api.post('/api/chain/passport/mint', { workerId: w.id, address });
      toast.show(t('chain.minted') + ' ' + txHash.slice(0, 10) + '…');
      sfx('success');
      await loadStatus(w);
      setAnchors(await api.get('/api/chain/anchors'));
    } catch (e: any) {
      toast.show(e?.shortMessage || e?.data?.message || e?.message || 'mint failed', 'err'); sfx('error');
    } finally { setTxBusy(''); }
  }
  async function register(w: any) {
    sfx('click', 0.3);
    if (!address) { toast.show(t('chain.connectFirst'), 'err'); openConnectModal?.(); return; }
    setTxBusy('reg' + w.id);
    try {
      if (chainId !== 1439) await switchChainAsync({ chainId: 1439 });
      const versions = await api.get('/api/workers/' + w.id + '/versions');
      const published = versions.filter((v: any) => v.published_at || v.status === 'published');
      const versionId = (published[published.length - 1] || versions[versions.length - 1])?.id;
      // 玩家钱包签名确认策略登记
      const txHash = await sendTransactionAsync({ to: address, value: 0n, data: toHexData({ kind: 'strategy_register', workerId: w.id, versionId, at: Date.now() }) });
      await api.post('/api/chain/record', { workerId: w.id, kind: 'strategy_register', txHash, address, chainId: 1439 });
      await api.post('/api/chain/strategy/register', { workerId: w.id, versionId });
      toast.show(t('chain.strategyReg') + ' ' + txHash.slice(0, 10) + '…');
      sfx('success');
      await loadStatus(w);
    } catch (e: any) { toast.show(e?.shortMessage || e?.data?.message || e?.message || 'tx failed', 'err'); sfx('error'); }
    finally { setTxBusy(''); }
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
        <div className="row between"><h3>⛓ {t('chain.realTx')} · Injective EVM 1439</h3><ConnectButton showBalance={false} chainStatus="icon" /></div>
        <p className="small muted">{t('chain.walletTx')} — Injective EVM Testnet.</p>
        {address && (
          <p className="small">{address.slice(0, 12)}… · {injBalance.data ? (Number(injBalance.data.value) / 1e18).toFixed(4) + ' INJ' : ''} · <a href={explorerAddr(address)} target="_blank" rel="noreferrer">Explorer →</a></p>
        )}
        <div className="row" style={{ marginTop: 6 }}>
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
        {!address ? (
          <>
            <p className="small muted">{t('chain.connectFirst')}</p>
            <button className="btn primary" onClick={() => openConnectModal?.()}>{t('chain.linkWallet')}</button>
          </>
        ) : (
          <>
            <p className="small"><code>{address}</code></p>
            <p className="small muted">{t('chain.balance')}: {injBalance.data ? (Number(injBalance.data.value) / 1e18) + ' INJ' : '—'}</p>
            <button className="btn sm cyan" onClick={faucet}>{t('chain.faucet')}</button>
            <a className="btn sm" href={explorerAddr(address)} target="_blank" rel="noreferrer">{t('chain.explorer')} →</a>
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
                  {!passport && <button className="btn sm primary" disabled={txBusy === 'mint' + w.id} onClick={() => mint(w)}>{txBusy === 'mint' + w.id ? '…' : t('chain.mintPassport')}</button>}
                  {passport && <button className="btn sm purple" disabled={txBusy === 'reg' + w.id} onClick={() => register(w)}>{txBusy === 'reg' + w.id ? '…' : t('chain.registerStrategy')}</button>}
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
