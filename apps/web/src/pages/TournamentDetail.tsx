import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Avatar, Loading, useToast } from '../ui.js';
import { sfx } from '../audio.js';

export function TournamentDetail() {
  const { id } = useParams();
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [pick, setPick] = useState('');

  async function load() {
    try { setData(await api.get('/api/tournaments/' + id)); } catch (e: any) { toast.show(e.data?.message || e.message, 'err'); }
  }
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (!user) return;
    api.get('/api/workers').then((ws) => { setWorkers(ws); if (ws[0]) setPick(ws[0].id); }).catch(() => {});
  }, [user]);

  async function act(fn: () => Promise<any>, okMsg?: string) {
    sfx('click', 0.3);
    try {
      const r = await fn();
      toast.show(r?.txHash ? okMsg + ' ' + String(r.txHash).slice(0, 10) + '…' : okMsg || t('common.confirm'));
      await load();
    } catch (e: any) {
      toast.show(e.data?.message || e.message, 'err');
    }
  }

  if (!data) return <Loading />;

  const symbol = data.reward_token_symbol;
  const myIds = new Set(workers.map((w) => w.id));
  const explorer = data.chain?.explorer;

  return (
    <div className="content">
      <div className="row between">
        <h2 className="page-title">🏆 {data.name}</h2>
        <span className={`tag ${data.status === 'registration' ? 'green' : 'gray'}`}>{t('tour.' + data.status, data.status)}</span>
      </div>

      <div className="grid c2">
        <div className="card">
          <p className="small muted">{t('tour.prizePool')}: {(Number(data.prize_pool_base_units) / 1e6).toLocaleString()} {symbol}</p>
          <p className="small">{t('chain.explorer')}: <code>{data.contract_address || '—'}</code></p>
          <p className="small">{t('tour.rules')}: <code>{data.ruleset_hash}</code></p>
          {explorer && data.contract_address && (
            <a className="btn sm cyan" href={`${explorer}/address/${data.contract_address}`} target="_blank" rel="noreferrer">{t('chain.explorer')} →</a>
          )}
        </div>
        <div className="card">
          <h3>{t('tour.payouts')}</h3>
          {(data.payouts || []).map((p: any, i: number) => (
            <div key={i} className="row between small">
              <span>{p.placement != null ? '#' + p.placement : t('tour.' + (p.category === 'best_meme' ? 'bestMeme' : 'mostStable'), p.category)}</span>
              <span className="muted">{p.bps / 100}%</span>
            </div>
          ))}
        </div>
      </div>

      {user && (
        <div className="card dark">
          <div className="row">
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {data.status === 'registration' && (
              <button className="btn sm primary" disabled={!pick} onClick={() => act(() => api.post('/api/tournaments/' + id + '/entries', { workerId: pick }), t('tour.enter'))}>{t('tour.enter')}</button>
            )}
            {(data.status === 'registration' || data.status === 'running') && (
              <button className="btn sm purple" onClick={() => act(() => api.post('/api/tournaments/' + id + '/run'), t('tour.run'))}>{t('tour.run')}</button>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3>{t('tour.entries')}</h3>
        {(data.entries || []).length === 0 ? (
          <p className="muted small">{t('common.empty')}</p>
        ) : (
          <table className="tbl">
            <thead><tr><th>{t('tour.placement')}</th><th></th><th></th><th>{t('tour.reward')}</th><th></th></tr></thead>
            <tbody>
              {data.entries.map((e: any) => (
                <tr key={e.worker_id}>
                  <td>{e.placement != null ? '#' + e.placement : '-'}</td>
                  <td><span className="row" style={{ margin: 0 }}><Avatar role={e.role} size={28} /><span className="small">{e.worker_name}</span></span></td>
                  <td className="small muted">{t('role.' + e.role, e.role)}</td>
                  <td>{e.reward_base_units ? (Number(e.reward_base_units) / 1e6) + ' ' + symbol : '-'}</td>
                  <td>
                    {user && myIds.has(e.worker_id) && Number(e.reward_base_units) > 0 && (
                      <button className="btn sm green" onClick={() => act(() => api.post('/api/tournaments/' + id + '/claim', { workerId: e.worker_id }), t('tour.claimReward'))}>{t('tour.claimReward')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
