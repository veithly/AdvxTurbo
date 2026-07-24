import React, { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { Avatar, Loading } from '../ui.js';
import { sfx } from '../audio.js';

type Kind = 'rating' | 'meme' | 'stable';

export function Leaderboard() {
  const t = useT();
  const [kind, setKind] = useState<Kind>('rating');
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    setRows(null);
    api.get('/api/leaderboards?kind=' + kind).then(setRows).catch(() => setRows([]));
  }, [kind]);

  const tabs: Kind[] = ['rating', 'meme', 'stable'];

  return (
    <div className="content">
      <h2 className="page-title">🏆 {t('nav.leaderboard')}</h2>
      <div className="row" style={{ marginBottom: 12 }}>
        {tabs.map((k) => (
          <button
            key={k}
            className={'btn sm ' + (kind === k ? 'primary' : '')}
            onClick={() => { sfx('click', 0.3); setKind(k); }}
          >
            {t('leaderboard.' + k)}
          </button>
        ))}
      </div>

      {rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className="card center"><p className="muted">{t('common.empty')}</p></div>
      ) : (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th></th>
                <th>{t('leaderboard.owner')}</th>
                <th>{t('common.rating')}</th>
                <th>{t('office.games')}</th>
                <th>{t('leaderboard.successRate')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id}>
                  <td>{i + 1}</td>
                  <td>
                    <span className="row" style={{ margin: 0 }}>
                      <Avatar role={row.role} size={32} />
                      <span className="small">{row.name}</span>
                    </span>
                  </td>
                  <td className="small muted">{row.owner}</td>
                  <td>{Math.round(row.rating)}</td>
                  <td>{row.games}</td>
                  <td>{Math.round((row.project_successes / (row.games || 1)) * 100) + '%'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
