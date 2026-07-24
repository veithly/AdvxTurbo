import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { Loading, StatusTag } from '../ui.js';
import { sfx } from '../audio.js';

export function Replays() {
  const t = useT();
  const nav = useNavigate();
  const [all, setAll] = useState<any[] | null>(null);
  const [hot, setHot] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/matches?limit=40').then(setAll).catch(() => setAll([]));
    api.get('/api/matches/hot').then(setHot).catch(() => {});
  }, []);

  function open(m: any) {
    sfx('click', 0.3);
    nav('/match/' + m.id);
  }

  if (all === null) return <Loading />;

  return (
    <div className="content">
      <h2 className="page-title">🎬 {t('nav.replays')}</h2>
      <p className="page-sub muted">{t('home.hotIncidents')}</p>

      <div className="grid c4">
        {hot.length === 0 && <p className="muted small">{t('common.empty')}</p>}
        {hot.map((m) => (
          <div key={m.id} className="incident-card" onClick={() => open(m)}>
            <div className="title">「{t(m.title_key, m.title_key)}」</div>
            <div className="row between">
              <StatusTag status={m.result_status} />
              <span className="heat">🔥 {m.meme_heat}</span>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ color: 'var(--cream)', marginTop: 16 }}>{t('common.viewMore')}</h3>
      <div className="grid c3">
        {all.length === 0 && <p className="muted small">{t('common.empty')}</p>}
        {all.map((m) => (
          <div key={m.id} className="incident-card" onClick={() => open(m)}>
            <div className="title">「{t(m.title_key, m.title_key)}」</div>
            <div className="row between">
              <StatusTag status={m.result_status} />
              <span className="heat">🔥 {m.meme_heat}</span>
            </div>
            <div className="row between small muted">
              <span>{m.mode}</span>
              <span>{m.finished_at ? String(m.finished_at).slice(0, 10) : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
