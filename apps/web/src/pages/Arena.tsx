import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Avatar, useToast, StatusTag, useConfig, avatarFromWorker } from '../ui.js';
import { sfx, playBgm } from '../audio.js';

export function Arena() {
  const t = useT();
  const nav = useNavigate();
  const cfg = useConfig();
  const { user, guest } = useAuth();
  const toast = useToast();
  const [workers, setWorkers] = useState<any[]>([]);
  const [sel, setSel] = useState<string>('');
  const [mode, setMode] = useState('ranked');
  const [matching, setMatching] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => { playBgm(); }, []);
  useEffect(() => {
    api.get('/api/matches?limit=10').then(setRecent);
    if (user) api.get('/api/workers').then((ws) => { setWorkers(ws); if (ws[0]) setSel(ws[0].id); });
  }, [user]);

  async function ensureUser() {
    if (!user) await guest(localStorage.getItem('locale') || 'zh');
  }

  async function startRanked() {
    await ensureUser();
    let workerId = sel;
    if (workers.length === 0) {
      // 游客：临时创建一个演示员工
      const w = await api.post('/api/workers', { name: 'DemoCat', role: 'engineer', appearance: { color: '#D8702B' }, personality: 'demo' });
      workerId = w.id;
      setWorkers([w]); setSel(w.id);
    }
    setMatching(true);
    sfx('match_start');
    try {
      const { matchId } = await api.post('/api/matches/queue', { workerId, players: 4, mode });
      setTimeout(() => nav('/match/' + matchId + '?live=1'), 900);
    } catch (e: any) {
      toast.show(e.data?.message || e.message, 'err');
      setMatching(false);
    }
  }

  return (
    <div className="content">
      <h2 className="page-title">⚔ {t('nav.arena')}</h2>
      <p className="page-sub">{t('arena.currentSeason')}: ranked-2026-07-1 · 4P · 90s · open-office-hell</p>

      <div className="grid c2">
        <div className="card">
          <h3>🏅 {t('arena.rankedQueue')}</h3>
          {user && workers.length > 0 && (
            <>
              <p className="small muted">{t('arena.pickWorker')}</p>
              <div className="row">
                {workers.map((w) => (
                  <div key={w.id} className={`role-pick ${sel === w.id ? 'sel' : ''}`} style={{ minWidth: 90 }} onClick={() => setSel(w.id)}>
                    <Avatar role={w.role} size={40} src={avatarFromWorker(w)} />
                    <div className="small">{w.name}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="small muted" style={{ marginTop: 10 }}>{t('arena.gameMode')}</p>
          <div className="grid c2" style={{ gap: 8 }}>
            {(cfg?.gameModes || []).map((m: any) => (
              <div key={m.id} className={`role-pick ${mode === m.id ? 'sel' : ''}`} style={{ textAlign: 'left', padding: 8 }} onClick={() => { setMode(m.id); sfx('click', 0.3); }}>
                <div style={{ color: 'var(--cream)' }}>{m.emoji} {t(m.nameKey, m.id)}</div>
                <div className="small muted">{t(m.descKey, '')}</div>
              </div>
            ))}
          </div>
          {matching ? (
            <div className="center" style={{ padding: 20 }}>
              <div className="row" style={{ justifyContent: 'center' }}>
                {['engineer', 'pm', 'qa', 'sre'].map((r, i) => <Avatar key={r} role={r} size={48} className={i % 2 ? 'flash' : ''} />)}
              </div>
              <p className="muted"><span className="spin">⚙</span> {t('arena.matching')}</p>
            </div>
          ) : (
            <button className="btn primary block" style={{ marginTop: 12 }} onClick={startRanked}>▶ {t('arena.startMatch')}</button>
          )}
          <p className="small muted" style={{ marginTop: 8 }}>{user ? '' : t('auth.guestHint')}</p>
        </div>

        <div className="card">
          <h3>📺 {t('arena.watchLive')}</h3>
          <p className="small muted">{t('arena.spectate')}</p>
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            {recent.map((m) => (
              <div key={m.id} className="row between" style={{ borderBottom: '1px solid var(--gray2)', padding: '6px 0' }}>
                <span className="small">「{t(m.title_key, m.title_key)}」</span>
                <span className="row">
                  <StatusTag status={m.result_status} />
                  <button className="btn sm" onClick={() => nav('/match/' + m.id + '?live=1')}>▶</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
