import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Avatar, Bar, useToast, useConfig, StatusTag, avatarFromWorker } from '../ui.js';
import { sfx } from '../audio.js';

export function Office() {
  const t = useT();
  const nav = useNavigate();
  const cfg = useConfig();
  const { user } = useAuth();
  const toast = useToast();
  const [workers, setWorkers] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [ctx, setCtx] = useState<any>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [recent, setRecent] = useState<any[]>([]);
  const [queuing, setQueuing] = useState(false);
  const [team, setTeam] = useState<string[]>([]);
  const toggleTeam = (id: string) => setTeam((tm) => (tm.includes(id) ? (tm.length > 1 ? tm.filter((x) => x !== id) : tm) : [...tm, id]));

  useEffect(() => {
    if (!user) return;
    api.get('/api/workers').then((ws) => {
      setWorkers(ws);
      if (ws[0]) { selectWorker(ws[0]); setTeam([ws[0].id]); }
    });
  }, [user]);

  async function selectWorker(w: any) {
    setSel(w);
    sfx('click', 0.3);
    const [c, k, r] = await Promise.all([
      api.get('/api/workers/' + w.id + '/context'),
      api.get('/api/workers/' + w.id + '/keys'),
      api.get('/api/matches?limit=8&workerId=' + w.id),
    ]);
    setCtx(c); setKeys(k); setRecent(r); setNewKey('');
  }

  async function genKey() {
    const k = await api.post(`/api/workers/${sel.id}/keys`, { name: 'key-' + (keys.length + 1) });
    setNewKey(k.plaintext);
    setKeys(await api.get('/api/workers/' + sel.id + '/keys'));
    sfx('success');
  }

  async function togglePublic() {
    await api.patch('/api/workers/' + sel.id, { public_challenge_enabled: sel.public_challenge_enabled ? 0 : 1 });
    const w = await api.get('/api/workers/' + sel.id);
    setSel(w);
    setWorkers(workers.map((x) => (x.id === w.id ? w : x)));
  }

  async function startRanked() {
    setQueuing(true);
    sfx('match_start');
    try {
      const { matchId } = await api.post('/api/matches/queue', { workerIds: team.length ? team : [sel.id], players: Math.max(4, team.length) });
      nav('/match/' + matchId + '?live=1');
    } catch (e: any) {
      toast.show(t(e.data?.message ? e.message : e.message, e.data?.message || e.message), 'err');
    } finally {
      setQueuing(false);
    }
  }

  if (!user) return <div className="content"><div className="card center"><button className="btn primary" onClick={() => nav('/auth')}>{t('common.login')}</button></div></div>;

  if (workers.length === 0) {
    return (
      <div className="content"><div className="card center">
        <h3>{t('office.createFirst')}</h3>
        <button className="btn primary" onClick={() => nav('/create')}>＋ {t('home.createWorker')}</button>
      </div></div>
    );
  }

  const prompt = STANDARD_PROMPT;

  return (
    <div className="content">
      <div className="row between">
        <h2 className="page-title">🏢 {t('office.myCompany')} — {user.display_name}</h2>
        <button className="btn purple sm" onClick={() => nav('/create')}>＋ {t('home.createWorker')}</button>
      </div>

      <div className="row worker-scroll" style={{ marginBottom: 16 }}>
        {workers.map((w) => (
          <div key={w.id} className={`role-pick ${sel?.id === w.id ? 'sel' : ''}`} style={{ minWidth: 110, position: 'relative', outline: team.includes(w.id) ? '2px solid var(--green)' : 'none' }} onClick={() => selectWorker(w)}>
            <button title={t('office.toggleTeam')} onClick={(e) => { e.stopPropagation(); toggleTeam(w.id); sfx('click', 0.3); }} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer', background: team.includes(w.id) ? 'var(--green)' : 'var(--gray2)', color: '#fff', fontWeight: 700 }}>{team.includes(w.id) ? '✓' : '＋'}</button>
            <Avatar role={w.role} size={48} spec={avatarFromWorker(w)} />
            <div className="small" style={{ color: 'var(--cream)' }}>{w.name}</div>
            <div className="small muted">{Math.round(w.rating)}</div>
          </div>
        ))}
      </div>

      {sel && ctx && (
        <div className="grid c2">
          <div className="card">
            <div className="row"><Avatar role={sel.role} size={72} spec={avatarFromWorker(sel)} /><div>
              <h3>{sel.name}</h3>
              <span className="tag">{t('role.' + sel.role)}</span>
              <span className="tag yellow">{t(ctx.worker.rank.tier)} · {ctx.worker.rank.rating}</span>
            </div></div>
            <div className="grid c2" style={{ marginTop: 12 }}>
              <div><div className="small muted">{t('office.projectSuccessRate')}</div><Bar value={ctx.recentPerformance.projectSuccessRate * 100} color="green" label={Math.round(ctx.recentPerformance.projectSuccessRate * 100) + '%'} /></div>
              <div><div className="small muted">{t('office.avgBlame')}</div><Bar value={ctx.recentPerformance.averageBlame} color="red" label={Math.round(ctx.recentPerformance.averageBlame) + ''} /></div>
            </div>
            <div className="row between" style={{ marginTop: 12 }}>
              <span className="small muted">{t('office.games')}: {sel.games}</span>
              <label className="row small" style={{ margin: 0 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={!!sel.public_challenge_enabled} onChange={togglePublic} /> {t('office.publicChallenge')}
              </label>
            </div>
            <div className="small muted" style={{ marginTop: 10 }}>👥 {t('office.team')}: {team.map((id) => workers.find((w) => w.id === id)?.name).filter(Boolean).join('、') || '—'}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn primary" disabled={queuing} onClick={startRanked}>{queuing ? <span className="spin">⚔</span> : '⚔'} {t('office.startRanked')}{team.length > 1 ? ` (${team.length}${t('office.teamCount')})` : ''}</button>
              <button className="btn purple" onClick={() => nav('/lab/' + sel.id)}>🧪 {t('nav.agentLab')}</button>
              <a className="btn green sm" href={`${api.base}/api/workers/${sel.id}/codex-pet.zip?token=${localStorage.getItem('token')}`} title={t('create.petHint')}>🐾 {t('office.downloadPet')}</a>
            </div>
            <div className="small muted" style={{ marginTop: 10 }}>
              {t('office.branches')}: ranked <code>{ctx.worker.currentBranches.ranked?.slice(-6)}</code>
              {' · '}Passport: {ctx.chain.passportMinted ? <span className="tag cyan">#{ctx.chain.passportTokenId}</span> : <Link to="/chain">{t('chain.notMinted')}</Link>}
            </div>
          </div>

          <div className="card">
            <h3>🔑 {t('office.workerKey')}</h3>
            <p className="small muted">{t('office.giveToAgent')}</p>
            {keys.map((k) => (
              <div key={k.id} className="row between" style={{ borderBottom: '1px solid var(--gray2)', padding: '4px 0' }}>
                <span className="small">{k.name} <code>{k.display}</code></span>
                {k.revoked_at ? <span className="tag gray">revoked</span> : <button className="btn sm red" onClick={async () => { await api.post(`/api/keys/${k.id}/revoke`); setKeys(await api.get('/api/workers/' + sel.id + '/keys')); }}>revoke</button>}
              </div>
            ))}
            <button className="btn sm" style={{ marginTop: 8 }} onClick={genKey}>＋ {t('office.newKey')}</button>
            {newKey && (
              <>
                <p className="small" style={{ color: 'var(--red2)', marginTop: 8 }}>⚠ {t('office.keyOnce')}</p>
                <div className="keybox">{newKey}</div>
                <button className="btn sm" onClick={() => { navigator.clipboard.writeText(newKey); toast.show(t('common.copied')); }}>📋 {t('common.copy')}</button>
              </>
            )}
            <h4 style={{ marginTop: 16, color: 'var(--cream)' }}>{t('office.prompt')}</h4>
            <pre className="code" style={{ maxHeight: 160 }}>{prompt}</pre>
            <button className="btn sm cyan" onClick={() => { navigator.clipboard.writeText(prompt); toast.show(t('common.copied')); }}>📋 {t('common.copy')}</button>
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>🎬 {t('office.recentMatches')}</h3>
            {recent.length === 0 && <p className="muted small">{t('common.empty')}</p>}
            {recent.map((m) => (
              <div key={m.id} className="row between" style={{ borderBottom: '1px solid var(--gray2)', padding: '6px 0', cursor: 'pointer' }} onClick={() => nav('/match/' + m.id)}>
                <span className="small">「{t(m.title_key, m.title_key)}」</span>
                <span><StatusTag status={m.result_status} /> 🔥{m.meme_heat}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const STANDARD_PROMPT = `你正在调优《抢热点大作战》里的一名黑客松选手（builder）。
目标优先级：
1. 在「端点」偷偷开热点，把项目进度冲到 100%；
2. 别和工作人员重合——被逮到当场取消参赛资格；
3. 管理精力值，别累到崩溃；
4. 抢到 Qoder 额度可大幅加速 build；
5. 保持策略简单、确定、可重放。
工作流程：
- 先调用 GET /v1/agent/worker 读取上下文（自己/工作人员位置、精力、进度）；
- 读取当前策略和最近至少 5 场回放，看你都是怎么被逮的；
- 提出不超过 3 个具体改动；
- 运行固定种子 A/B 回归 (POST /v1/agent/worker/simulations)；
- 只有在项目完成度提升且没被更多次取消资格时才发布；
- 发布时写明 changeNotes 和已知风险。`;
