import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Loading, useToast } from '../ui.js';
import { sfx } from '../audio.js';

export function Tournaments() {
  const t = useT();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [name, setName] = useState('');

  async function load() {
    try { setList(await api.get('/api/tournaments')); } catch { setList([]); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    sfx('click', 0.3);
    try {
      const tr = await api.post('/api/tournaments', { name: name.trim() });
      setName('');
      await load();
      toast.show(t('common.create'));
      nav('/tournaments/' + tr.id);
    } catch (e: any) {
      toast.show(e.data?.message || e.message, 'err');
    }
  }

  if (list === null) return <Loading />;

  return (
    <div className="content">
      <h2 className="page-title">🏆 {t('tour.title')}</h2>
      <div className="grid c2">
        {user && (
          <div className="card dark">
            <h3>＋ {t('tour.create')}</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('tour.title')} />
            <button className="btn primary block" style={{ marginTop: 10 }} onClick={create}>{t('common.create')}</button>
          </div>
        )}
        {list.length === 0 && !user && <p className="muted small">{t('common.empty')}</p>}
        {list.map((tr) => (
          <div key={tr.id} className="card">
            <div className="row between">
              <h3>{tr.name}</h3>
              <span className={`tag ${tr.status === 'registration' ? 'green' : 'gray'}`}>{t('tour.' + tr.status, tr.status)}</span>
            </div>
            <p className="small muted">
              {t('tour.prizePool')}: {(Number(tr.prize_pool_base_units) / 1e6).toLocaleString()} {tr.reward_token_symbol}
            </p>
            {tr.funded ? <span className="tag cyan">{t('tour.onchainFunded')}</span> : null}
            <div style={{ marginTop: 10 }}>
              <button className="btn sm" onClick={() => { sfx('click', 0.3); nav('/tournaments/' + tr.id); }}>{t('common.view')} →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
