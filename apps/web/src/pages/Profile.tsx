import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useT, useI18n } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Avatar, Loading, useToast } from '../ui.js';
import { sfx } from '../audio.js';

export function Profile() {
  const t = useT();
  const nav = useNavigate();
  const { locale, setLocale } = useI18n();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [workers, setWorkers] = useState<any[] | null>(null);
  const [claims, setClaims] = useState<any[] | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get('/api/workers').then(setWorkers).catch(() => setWorkers([]));
    api.get('/api/chain/claims').then(setClaims).catch(() => setClaims([]));
  }, [user]);

  function changeLocale(l: 'zh' | 'en') {
    sfx('click', 0.3);
    setLocale(l);
    api.post('/api/auth/locale', { locale: l }).catch(() => {});
  }

  if (!user) {
    return <div className="content"><div className="card center"><button className="btn primary" onClick={() => nav('/auth')}>{t('common.login')}</button></div></div>;
  }

  return (
    <div className="content">
      <h2 className="page-title">👤 {t('profile.title')}</h2>

      <div className="card">
        <div className="row between">
          <div>
            <h3>{user.display_name}</h3>
            <p className="small muted">{user.email || t('common.guest')}</p>
            <span className="tag">{user.status}</span>
          </div>
          <button className="btn sm red" onClick={() => { sfx('click', 0.3); logout(); nav('/'); }}>{t('common.logout')}</button>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="small muted">{t('profile.locale')}:</span>
          <button className={'btn sm ' + (locale === 'zh' ? 'primary' : '')} onClick={() => changeLocale('zh')}>中</button>
          <button className={'btn sm ' + (locale === 'en' ? 'primary' : '')} onClick={() => changeLocale('en')}>EN</button>
        </div>
      </div>

      <div className="card">
        <h3>{t('profile.workers')}</h3>
        {workers === null ? <Loading /> : workers.length === 0 ? <p className="muted small">{t('common.empty')}</p> : (
          <div className="row">
            {workers.map((w) => (
              <Link key={w.id} to="/office" className="role-pick" style={{ minWidth: 110 }} onClick={() => sfx('click', 0.3)}>
                <Avatar role={w.role} size={48} />
                <div className="small" style={{ color: 'var(--cream)' }}>{w.name}</div>
                <div className="small muted">{Math.round(w.rating)}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>{t('profile.claims')}</h3>
        {claims === null ? <Loading /> : claims.length === 0 ? <p className="muted small">{t('common.empty')}</p> : (
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
    </div>
  );
}
