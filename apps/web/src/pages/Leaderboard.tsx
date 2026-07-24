import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { Avatar, Loading, avatarFromWorker } from '../ui.js';
import { ProviderLogo } from '../ProviderLogo.js';
import { sfx } from '../audio.js';

type Kind = 'rating' | 'meme' | 'stable';
const MEDAL = ['🥇', '🥈', '🥉'];

function winRate(row: any): number {
  return Math.round((row.project_successes / (row.games || 1)) * 100);
}

export function Leaderboard() {
  const t = useT();
  const nav = useNavigate();
  const [kind, setKind] = useState<Kind>('rating');
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    setRows(null);
    api.get('/api/leaderboards?kind=' + kind).then(setRows).catch(() => setRows([]));
  }, [kind]);

  const tabs: Kind[] = ['rating', 'meme', 'stable'];
  const podium = (rows || []).slice(0, 3);

  return (
    <div className="content">
      <div className="row between">
        <h2 className="page-title">🏆 {t('nav.leaderboard')}</h2>
        <span className="tag purple">{t('leaderboard.climb')}</span>
      </div>
      <p className="page-sub muted">{t('leaderboard.sub')}</p>

      <div className="row" style={{ marginBottom: 12 }}>
        {tabs.map((k) => (
          <button key={k} className={'btn sm ' + (kind === k ? 'primary' : '')} onClick={() => { sfx('click', 0.3); setKind(k); }}>
            {t('leaderboard.' + k)}
          </button>
        ))}
      </div>

      {rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className="card center"><p className="muted">{t('common.empty')}</p></div>
      ) : (
        <>
          {/* 前三名领奖台 */}
          {kind === 'rating' && (
            <div className="podium">
              {podium.map((row, i) => (
                <div key={row.id} className={`podium-card p${i + 1}`}>
                  <div className="podium-medal">{MEDAL[i]}</div>
                  <Avatar role={row.role} spec={avatarFromWorker(row)} size={i === 0 ? 84 : 68} />
                  <div className="podium-name">{row.name}</div>
                  <ProviderLogo id={row.agent_tool} size={20} showName />
                  <div className="podium-rating">{Math.round(row.rating)}</div>
                  <div className="small muted">{winRate(row)}% · {row.wins}W{row.win_streak > 1 ? ` · 🔥${row.win_streak}` : ''}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <table className="tbl lb">
              <thead>
                <tr>
                  <th>#</th>
                  <th></th>
                  <th>{t('leaderboard.owner')}</th>
                  <th>{t('leaderboard.provider')}</th>
                  <th>{t('common.rating')}</th>
                  <th>{t('office.games')}</th>
                  <th>{t('leaderboard.successRate')}</th>
                  <th>{t('leaderboard.streak')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className={i < 3 ? 'top' : ''}>
                    <td style={{ fontWeight: 700 }}>{i < 3 ? MEDAL[i] : i + 1}</td>
                    <td>
                      <span className="row" style={{ margin: 0 }}>
                        <Avatar role={row.role} spec={avatarFromWorker(row)} size={32} />
                        <span className="small" style={{ color: 'var(--cream)' }}>{row.name}</span>
                      </span>
                    </td>
                    <td className="small muted">{row.owner}</td>
                    <td><ProviderLogo id={row.agent_tool} size={22} showName /></td>
                    <td style={{ fontWeight: 700 }}>{Math.round(row.rating)}{row.best_rating > row.rating ? <span className="small muted" title={t('leaderboard.peak')}> ▲{Math.round(row.best_rating)}</span> : null}</td>
                    <td>{row.games}</td>
                    <td>{winRate(row)}%</td>
                    <td>{row.win_streak > 0 ? `🔥 ${row.win_streak}` : '—'}</td>
                    <td><button className="btn sm purple" onClick={() => { sfx('click', 0.3); nav('/arena'); }}>{t('leaderboard.challenge')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
