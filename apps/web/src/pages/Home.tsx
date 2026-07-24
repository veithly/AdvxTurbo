import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Avatar, useToast } from '../ui.js';
import { sfx, playBgm } from '../audio.js';

export function Home() {
  const t = useT();
  const nav = useNavigate();
  const { user, guest } = useAuth();
  const toast = useToast();
  const [hot, setHot] = useState<any[]>([]);
  const [cup, setCup] = useState<any>(null);

  useEffect(() => {
    api.get('/api/matches/hot').then(setHot).catch(() => {});
    api.get('/api/tournaments').then((ts) => setCup(ts[0])).catch(() => {});
  }, []);

  async function playDemo() {
    sfx('click');
    if (!user) {
      try { await guest(localStorage.getItem('locale') || 'zh'); } catch {}
    }
    playBgm();
    nav('/arena');
  }

  const roles = ['engineer', 'pm', 'qa', 'sre', 'designer', 'intern'];

  return (
    <div className="content">
      <div className="hero">
        <div className="row center" style={{ justifyContent: 'center', marginBottom: 8 }}>
          {roles.map((r) => <Avatar key={r} role={r} size={56} />)}
          <Avatar role="boss" size={56} />
        </div>
        <h1>{t('app.title')}</h1>
        <div className="en">CATCH THE HOTSPOT · {t('app.subtitle')}</div>
        <div className="tagline">「{t('app.tagline')}」<br /><span className="muted">{t('app.tagline.en')}</span></div>
        <div className="cta">
          <button className="btn primary" onClick={playDemo}>▶ {t('home.playDemo')}</button>
          <Link className="btn purple" to={user ? '/create' : '/auth'} onClick={() => sfx('click')}>＋ {t('home.createWorker')}</Link>
          <Link className="btn" to="/replays" onClick={() => sfx('click')}>🎬 {t('home.hotReplays')}</Link>
        </div>
        <p className="muted small" style={{ marginTop: 16 }}>{t('home.coreLoop')}</p>
      </div>

      <div className="grid c3">
        <div className="card">
          <h3>🤖 {t('home.howAI')}</h3>
          <ol style={{ paddingLeft: 18, lineHeight: 1.9 }}>
            <li>{t('home.step1')}</li>
            <li>{t('home.step2')}</li>
            <li>{t('home.step3')}</li>
          </ol>
          <Link className="btn sm cyan" to="/docs">{t('nav.docs')} →</Link>
        </div>
        <div className="card">
          <h3>⛓ {t('home.whyInjective')}</h3>
          <p className="small">{t('home.whyInjectiveBody')}</p>
          <div className="row">
            <span className="tag cyan">Passport SBT</span>
            <span className="tag purple">Strategy Hash</span>
            <span className="tag green">Match Merkle Root</span>
            <span className="tag yellow">Escrow</span>
          </div>
          <Link className="btn sm" to="/chain" style={{ marginTop: 10 }}>{t('nav.chainVault')} →</Link>
        </div>
        <div className="card">
          <h3>🏆 {t('home.latestCup')}</h3>
          {cup ? (
            <>
              <p style={{ color: 'var(--cream)' }}>{cup.name}</p>
              <p className="small muted">{t('tour.prizePool')}: {(Number(cup.prize_pool_base_units) / 1e6).toLocaleString()} {cup.reward_token_symbol}</p>
              <span className={`tag ${cup.status === 'registration' ? 'green' : 'gray'}`}>{t('tour.' + cup.status, cup.status)}</span>
              {cup.funded ? <span className="tag cyan">{t('tour.onchainFunded')}</span> : null}
              <div><Link className="btn sm" to={`/tournaments/${cup.id}`} style={{ marginTop: 10 }}>{t('common.view')} →</Link></div>
            </>
          ) : <p className="muted small">{t('common.empty')}</p>}
        </div>
      </div>

      <h3 style={{ color: 'var(--cream)', marginTop: 8 }}>🔥 {t('home.hotIncidents')}</h3>
      <div className="grid c4">
        {hot.length === 0 && <p className="muted small">{t('common.empty')} — <Link to="/arena">{t('home.playDemo')}</Link></p>}
        {hot.map((m) => (
          <div key={m.id} className="incident-card" onClick={() => { sfx('click'); nav('/match/' + m.id); }}>
            <div className="title">「{t('title.' + camel(m.title_key), m.title_key)}」</div>
            <div className="row between">
              <span className={`tag ${m.project_success ? 'green' : 'red'}`}>{t('status.' + m.result_status, m.result_status)}</span>
              <span className="heat">🔥 {m.meme_heat}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// title_key 在 DB 里是 'title.shippedButScapegoat' 形式，去掉前缀
function camel(key: string): string {
  return key.replace(/^title\./, '');
}
