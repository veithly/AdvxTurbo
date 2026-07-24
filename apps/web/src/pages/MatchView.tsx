import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import type { MatchReplay } from '@blame/shared';
import { pickMatchGoals } from '@blame/shared';
import type { CharSpec } from '../pixelart.js';
import { OfficeCanvas } from '../OfficeCanvas.js';
import { Avatar, Bar, StatusTag, Loading, useToast } from '../ui.js';
import { ProviderLogo } from '../ProviderLogo.js';
import { sfx } from '../audio.js';

const HOT_KINDS = ['bug_spawn', 'bug_exploded', 'incident_phase', 'ship', 'disqualified', 'boss_caught', 'force_assign', 'skill_rollback', 'event', 'match_end'];
const GAME_MODE_EMOJI: Record<string, string> = { ranked: '⚖️', credit_war: '🏆', zero_incident: '🛡️', slack_master: '😎', intern_uprising: '🐹', friday_raid: '🌙' };
// 事件 -> 人物头顶气泡台词
const EVENT_BUBBLE: Record<string, string> = { bug_fixed: 'bubble.fix', ship: 'bubble.ship', boss_caught: 'bubble.caught', force_assign: 'bubble.dump', skill_rollback: 'bubble.rollback', bug_exploded: 'bubble.explode' };

export function MatchView() {
  const t = useT();
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [replay, setReplay] = useState<MatchReplay | null>(null);
  const [parts, setParts] = useState<any[]>([]); // match_participants（含 worker_name / agent_tool / rating_before/after）
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 默认 1×，方便看清
  const [done, setDone] = useState(false);
  const timerRef = useRef<any>(null);
  const lastEventTick = useRef(-1);

  useEffect(() => {
    api.get('/api/matches/' + id + '/replay').then((r) => {
      setReplay(r);
      // 回放一律从头自动播放（此前非 live 直接跳到最后一帧，导致大家都在“发布”）
      setIdx(0); setPlaying(true); setDone(false);
      if (sp.get('live')) sfx('match_start');
    }).catch(() => toast.show('not found', 'err'));
    api.get('/api/matches/' + id).then((m) => setParts(m.participants || [])).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!playing || !replay) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => {
        if (i >= replay.frames.length - 1) {
          setPlaying(false);
          setDone(true);
          sfx(replay.result.projectSuccess ? 'success' : 'error');
          return i;
        }
        return i + 1;
      });
    }, Math.max(35, 120 / speed));
    return () => clearInterval(timerRef.current);
  }, [playing, speed, replay]);

  useEffect(() => {
    if (!replay) return;
    const frame = replay.frames[idx];
    if (!frame) return;
    if (frame.tick !== lastEventTick.current) {
      lastEventTick.current = frame.tick;
      const evs = replay.timeline.filter((e) => e.tick === frame.tick);
      if (evs.some((e) => e.kind === 'bug_exploded')) sfx('explosion', 0.6);
      else if (evs.some((e) => e.kind === 'ship')) sfx('ship', 0.6);
      else if (evs.some((e) => e.kind === 'event')) sfx('alert', 0.4);
      else if (evs.some((e) => e.kind === 'bug_fixed')) sfx('fix', 0.4);
    }
  }, [idx, replay]);

  if (!replay) return <Loading />;

  const frame = replay.frames[idx];
  const res = replay.result;
  const pById: Record<string, any> = {};
  parts.forEach((p) => { pById[p.worker_id] = p; });
  const roles: Record<string, string> = {};
  const specs: Record<string, Partial<CharSpec>> = {};
  res.participants.forEach((p) => {
    roles[p.workerId] = p.role;
    specs[p.workerId] = workerSpec(p.workerId, pById[p.workerId]?.appearance_json);
  });
  const nameFor = (wid: string) => pById[wid]?.worker_name || t('role.' + (roles[wid] || 'engineer'));
  const names: Record<string, string> = {};
  res.participants.forEach((p) => { names[p.workerId] = nameFor(p.workerId); });
  const realIds = new Set(res.participants.map((p) => p.workerId));
  const builderFrames = frame.workers.filter((w) => realIds.has(w.id));

  const shownEvents = replay.timeline.filter((e) => e.tick <= frame.tick && HOT_KINDS.includes(e.kind)).slice(-40).reverse();
  const champion = [...res.participants].sort((a, b) => a.placement - b.placement)[0];

  // ---- 实时目标条件（清楚地告诉玩家"这一局在干嘛"）----
  const upto = replay.timeline.filter((e) => e.tick <= frame.tick);
  const shipped = upto.some((e) => e.kind === 'ship');
  const exploded = upto.some((e) => e.kind === 'bug_exploded');
  const gctx = {
    progress: frame.releaseProgress,
    buildingNow: frame.workers.filter((w) => w.label === 'building').length,
    dq: upto.some((e) => e.kind === 'disqualified'),
  };
  const goals = pickMatchGoals(id || res.replayHash || 'x', 4);
  const goalMet = (g: any): boolean => {
    switch (g.key) {
      case 'progress': return gctx.progress >= (g.n ?? 75);
      case 'buildTeam': return gctx.buildingNow >= (g.n ?? 8);
      case 'noDq': return !gctx.dq;
      case 'submit': return gctx.progress >= 100;
      default: return false;
    }
  };
  const goalLabel = (g: any) => t(g.labelKey).replace('{n}', String(g.n ?? ''));
  const metCount = goals.filter(goalMet).length;
  const modeId = (res as any).modeId as string | undefined;
  const winKey = (res as any).winConditionKey as string | undefined;

  // ---- 领先 / 垫底（按项目进度）----
  const liveWorkers = [...builderFrames].sort((a, b) => b.contribution - a.contribution);
  const safest = liveWorkers[0];
  const riskiest = liveWorkers[liveWorkers.length - 1];

  // ---- 解说：最新一条 + 滚动 ----
  const latestEv = shownEvents[0];
  const latestText = latestEv ? narrate(t, latestEv, nameFor) : t('commentary.start');

  // ---- 人物头顶对话气泡（最近事件优先，否则按状态）----
  const bubbleWin = replay.timeline.filter((e) => e.tick <= frame.tick && e.tick >= frame.tick - 6);
  const bubbles: Record<string, string> = {};
  for (const w of frame.workers) {
    if ((w as any).label === 'staff') { bubbles[w.id] = bubbleWin.some((e) => e.kind === 'disqualified') ? t('bubble.bossCaught') : t('bubble.bossPatrol'); continue; }
    if ((w as any).label === 'dq') { bubbles[w.id] = t('bubble.dq'); continue; }
    if (!realIds.has(w.id)) continue; // 群演不显示气泡，避免杂乱
    const ev = [...bubbleWin].reverse().find((e) => e.workerId === w.id && EVENT_BUBBLE[e.kind]);
    bubbles[w.id] = ev ? t(EVENT_BUBBLE[ev.kind]) : t('bubble.' + ((w as any).label || 'working'), t('bubble.working'));
  }

  return (
    <div className="content">
      <div className="row between">
        <h2 className="page-title">🎬 {t('replay.title')}</h2>
        <div className="row">
          <StatusTag status={res.resultStatus} />
          <span className="tag yellow">🔥 {t('replay.memeHeat')} {res.memeHeat}</span>
          {modeId && <span className="tag purple">{GAME_MODE_EMOJI[modeId] || ''} {t('mode.' + modeId, modeId)}</span>}
        </div>
      </div>

      {/* 目标栏：明确告诉玩家这一局的目标 + 进度 */}
      <div className="objective">
        <div className="row between">
          <div className="obj-title">🎯 {t('obj.goal')}</div>
          <div className="obj-leader small">
            {t('obj.safest')}: <b style={{ color: 'var(--green2)' }}>{t('role.' + roles[safest?.id])}</b>
            {'   '}· {t('obj.risk')}: <b style={{ color: 'var(--red2)' }}>{t('role.' + roles[riskiest?.id])}</b>
          </div>
        </div>
        <div className="obj-conds">
          {goals.map((g) => { const met = goalMet(g); return (
            <span key={g.key} className={`obj-cond ${met ? 'met' : 'unmet'}`}>{met ? '✅' : '⬜'} {goalLabel(g)}</span>
          ); })}
          <span className="obj-cond" style={{ borderColor: 'var(--yellow)', color: 'var(--yellow)' }}>🏆 {t('goal.done')} {metCount}/{goals.length}</span>
        </div>
        {null}
      </div>

      {/* 全宽大舞台 */}
      <div className="stage-wrap">
        <OfficeCanvas frame={frame} roles={roles} names={names} specs={specs} bubbles={bubbles} height={640} />
      </div>

      {/* 播放控制 */}
      <div className="card" style={{ marginTop: 10 }}>
        <div className="row between">
          <div className="row">
            <button className="btn sm primary" onClick={() => { setPlaying(!playing); sfx('click', 0.3); }}>{playing ? '⏸ ' + t('replay.pause') : '▶ ' + t('replay.play')}</button>
            <button className="btn sm" onClick={() => { setIdx(0); setDone(false); }}>⏮</button>
            <span className="small muted" style={{ marginLeft: 6 }}>{t('replay.speed')}</span>
            {[1, 2, 4].map((s) => (
              <button key={s} className={`btn sm ${speed === s ? 'primary' : ''}`} onClick={() => setSpeed(s)}>{s}×</button>
            ))}
          </div>
          <span className="tag">{t('phase.' + frame.phase, frame.phase)} · t{frame.tick} · {idx + 1}/{replay.frames.length}</span>
        </div>
        <input type="range" min={0} max={replay.frames.length - 1} value={idx} onChange={(e) => { setIdx(Number(e.target.value)); setPlaying(false); }} style={{ marginTop: 8 }} />
        <div className="grid c2" style={{ marginTop: 8 }}>
          <div><div className="small muted">🚀 {t('replay.progress')}</div><Bar value={frame.releaseProgress} color="blue" label={frame.releaseProgress + '%'} /></div>
          <div><div className="small muted">🔨 {t('hud.buildingNow')}</div><Bar value={Math.min(100, gctx.buildingNow * 5)} color="green" label={gctx.buildingNow + ''} /></div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
        {/* 左：解说 + HUD */}
        <div>
          <div className="card">
            <h3>🎙 {t('commentary.title')}</h3>
            <div className="commentary-latest">{latestText}</div>
            <div className="commentary-feed">
              {shownEvents.map((e, i) => (
                <div key={i} className={`cm ${['bug_exploded', 'boss_caught', 'force_assign', 'ship'].includes(e.kind) ? 'hot' : ''}`}>
                  <span className="muted">t{e.tick}</span> {narrate(t, e, nameFor)}
                </div>
              ))}
            </div>
          </div>

          <div className="hud" style={{ marginTop: 10 }}>
            {res.participants.map((p) => {
              const w = frame.workers.find((x) => x.id === p.workerId);
              return (
                <div key={p.workerId} className="who" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="row"><Avatar role={p.role} spec={specs[p.workerId]} size={40} /><div><div className="small" style={{ color: 'var(--cream)' }}>{nameFor(p.workerId)}</div><div className="small muted">{t('role.' + p.role)}{done && p.placement === 1 && <span className="scapegoat-badge">🏆</span>}</div></div></div>
                  <div className="small muted">{w ? t('label.' + w.label, w.label) : '—'}</div>
                  <Bar value={w ? w.contribution : 0} color="blue" label={'build ' + (w ? w.contribution : 0)} />
                  <Bar value={w ? w.energy : 0} color="yellow" label={'⚡' + (w ? w.energy : 0)} />
                  <Bar value={w ? ((w as any).inspiration || 0) : 0} color="purple" label={'💡' + (w ? ((w as any).inspiration || 0) : 0)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* 右：结果 / 时间线 */}
        <div>
          {done && (
            <div className="card">
              <h3>🏁 {t('status.' + res.resultStatus)}</h3>
              {champion && (
                <div style={{ background: 'var(--deep)', border: '2px solid var(--green)', padding: 8, margin: '8px 0' }}>
                  <div className="row"><Avatar role={champion.role} spec={specs[champion.workerId]} size={40} /><div><b style={{ color: 'var(--green2)' }}>🏆 {t('replay.champion')}</b><div className="small">{nameFor(champion.workerId)}</div></div></div>
                </div>
              )}
              <table className="tbl">
                <thead><tr><th>#</th><th>{t('leaderboard.provider')}</th><th>{t('common.you')}</th><th>{t('common.rating')}</th><th>{t('replay.finalScore')}</th></tr></thead>
                <tbody>
                  {[...res.participants].sort((a, b) => a.placement - b.placement).map((p) => {
                    const mp = pById[p.workerId];
                    const delta = mp ? Math.round((mp.rating_after ?? 0) - (mp.rating_before ?? 0)) : 0;
                    return (
                      <tr key={p.workerId}>
                        <td>{p.placement === 1 ? '👑' : p.placement}</td>
                        <td><ProviderLogo id={mp?.agent_tool} size={20} /></td>
                        <td>{nameFor(p.workerId)}{p.secretObjectiveAchieved && ' ⭐'}</td>
                        <td>{mp ? Math.round(mp.rating_after) : '—'} <span className="small" style={{ color: delta >= 0 ? 'var(--green2)' : 'var(--red2)' }}>{delta >= 0 ? '+' : ''}{delta}</span></td>
                        <td>{p.finalScore}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn sm cyan" onClick={() => { navigator.clipboard.writeText(location.origin + api.base + '/api/matches/' + id + '/agent.json'); toast.show(t('replay.copyAgent') + ' ✔'); }}>📋 {t('replay.copyAgent')}</button>
                <button className="btn sm purple" onClick={() => { sfx('click', 0.3); nav('/leaderboard'); }}>🏆 {t('leaderboard.climb')}</button>
              </div>
              <div className="small muted" style={{ marginTop: 8 }}>replayHash <code>{res.replayHash.slice(0, 18)}…</code></div>
            </div>
          )}

          <div className="card">
            <h3>⏱ {t('replay.timeline')}</h3>
            <div style={{ maxHeight: 240, overflow: 'auto' }}>
              {shownEvents.map((e, i) => (
                <div key={i} className={`timeline-ev ${['bug_exploded', 'boss_caught', 'force_assign', 'ship'].includes(e.kind) ? 'hot' : ''}`}>
                  <span className="muted small">t{e.tick}</span> {narrate(t, e, nameFor)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 把原始事件翻译成人话解说（带角色名，方便看懂）
function narrate(t: (k: string, f?: string) => string, e: any, nameFor: (w: string) => string): string {
  const who = e.workerId ? nameFor(e.workerId) : '';
  switch (e.kind) {
    case 'event': return '📢 ' + t('event.' + (e.data?.card || ''), e.data?.card || 'event');
    case 'bug_spawn': return `🐛 ${t('cm.bugSpawn')} (sev${e.data?.severity ?? '?'})`;
    case 'bug_exploded': return `💥 ${t('cm.explode')}`;
    case 'bug_fixed': return `🔧 ${who} ${t('cm.fixed')}`;
    case 'ship': return `🚀 ${who || ''} ${t('cm.shipped')}`;
    case 'disqualified': return `🚫 ${t('cm.dq').replace('{who}', who)}`;
    case 'boss_caught': return `🦺 ${t('cm.caught').replace('{who}', who)}`;
    case 'force_assign': return `🎯 ${t('cm.forceAssign').replace('{who}', who)}`;
    case 'incident_phase': return `🚨 ${t('cm.incident')}`;
    case 'skill_rollback': return `↩ ${who} ${t('cm.rollback')}`;
    case 'match_end': return `🏁 ${t('cm.matchEnd')}`;
    default: return e.kind;
  }
}

// 为每个员工给出区分度高的形象 spec：有自定义 charSpec 则用之；否则按 workerId 确定性变色衬衫，
// 保证即使同一职业的两名员工也长得不一样。
const SHIRT_VARIANTS = ['#172231', '#1F4C73', '#1B2635', '#252B35', '#2367A6', '#8E5AC8', '#3D5A3A', '#5A3A52', '#7A3B2E', '#2E5A5A'];
function workerSpec(wid: string, appearanceJson?: string): Partial<CharSpec> {
  try { const a = JSON.parse(appearanceJson || '{}'); if (a && a.charSpec) return a.charSpec; } catch {}
  let h = 0; for (let i = 0; i < wid.length; i++) h = (h * 31 + wid.charCodeAt(i)) >>> 0;
  return { shirt: SHIRT_VARIANTS[h % SHIRT_VARIANTS.length] };
}

function blameReason(t: (k: string, f?: string) => string, r: any): string {
  if (!r) return '';
  const parts = [
    { k: r.origin, key: 'origin' },
    { k: r.custody, key: 'custody' },
    { k: r.ignoredAlerts, key: 'ignoredAlerts' },
    { k: r.unauthorizedTransfer, key: 'unauthorizedTransfer' },
  ].sort((a, b) => b.k - a.k);
  const top = parts[0];
  const map: Record<string, string> = {
    origin: '制造了严重 Bug / created the critical bug',
    custody: '事故发生时仍持有该 Bug / held the bug at incident time',
    ignoredAlerts: '多次忽略告警 / repeatedly ignored alerts',
    unauthorizedTransfer: '强行甩锅给同事 / force-assigned the blame',
  };
  return map[top.key] || '责任模型综合判定 / composite responsibility';
}
