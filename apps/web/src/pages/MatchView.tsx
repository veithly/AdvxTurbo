import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import type { MatchReplay } from '@blame/shared';
import { OfficeCanvas } from '../OfficeCanvas.js';
import { Avatar, Bar, StatusTag, Loading, useToast } from '../ui.js';
import { sfx } from '../audio.js';

const HOT_KINDS = ['bug_spawn', 'bug_exploded', 'incident_phase', 'ship', 'boss_caught', 'force_assign', 'skill_rollback', 'event', 'match_end'];
const GAME_MODE_EMOJI: Record<string, string> = { ranked: '⚖️', credit_war: '🏆', zero_incident: '🛡️', slack_master: '😎', intern_uprising: '🐹', friday_raid: '🌙' };

export function MatchView() {
  const t = useT();
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [replay, setReplay] = useState<MatchReplay | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [done, setDone] = useState(false);
  const timerRef = useRef<any>(null);
  const lastEventTick = useRef(-1);

  useEffect(() => {
    api.get('/api/matches/' + id + '/replay').then((r) => {
      setReplay(r);
      if (sp.get('live')) { setIdx(0); setPlaying(true); setDone(false); sfx('match_start'); }
      else { setIdx(r.frames.length - 1); setDone(true); }
    }).catch(() => toast.show('not found', 'err'));
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
    }, Math.max(16, 100 / speed));
    return () => clearInterval(timerRef.current);
  }, [playing, speed, replay]);

  // 关键事件音效
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
  const roles: Record<string, string> = {};
  const names: Record<string, string> = {};
  res.participants.forEach((p) => { roles[p.workerId] = p.role; });
  // names from participants missing -> use workerId; try fetch not needed
  res.participants.forEach((p) => { names[p.workerId] = p.workerId.slice(-4); });

  const shownEvents = replay.timeline.filter((e) => e.tick <= frame.tick && HOT_KINDS.includes(e.kind)).slice(-40).reverse();
  const scapegoat = res.participants.find((p) => p.scapegoat);
  const respGraph = res.responsibilityGraph;

  return (
    <div className="content">
      <div className="row between">
        <h2 className="page-title">🎬 {t('replay.title')}</h2>
        <div className="row">
          <StatusTag status={res.resultStatus} />
          <span className="tag yellow">🔥 {t('replay.memeHeat')} {res.memeHeat}</span>
                    {(res as any).modeId && <span className="tag purple">{(GAME_MODE_EMOJI[(res as any).modeId] || '')} {t('mode.' + (res as any).modeId, (res as any).modeId)}</span>}
          {res.projectSuccess !== undefined && <span className="tag cyan">✓ {t('replay.verified')}</span>}
        </div>
      </div>
      <p className="page-sub">「{t(res.titleKey, res.titleKey)}」 · {t('phase.' + frame.phase, frame.phase)} · tick {frame.tick}{(res as any).winConditionKey ? ' · ' + t('replay.winCondition') + ': ' + t('winCond.' + (res as any).winConditionKey, (res as any).winConditionKey) : ''}</p>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div>
          <OfficeCanvas frame={frame} roles={roles} names={names} scapegoatId={done ? scapegoat?.workerId : undefined} />
          {/* 播放控制 */}
          <div className="card" style={{ marginTop: 10 }}>
            <div className="row between">
              <div className="row">
                <button className="btn sm" onClick={() => { setPlaying(!playing); sfx('click', 0.3); }}>{playing ? '⏸ ' + t('replay.pause') : '▶ ' + t('replay.play')}</button>
                <button className="btn sm" onClick={() => { setIdx(0); setDone(false); }}>⏮</button>
                {[0.5, 1, 2, 4].map((s) => (
                  <button key={s} className={`btn sm ${speed === s ? 'primary' : ''}`} onClick={() => setSpeed(s)}>{s}×</button>
                ))}
              </div>
              <span className="small muted">{idx + 1}/{replay.frames.length}</span>
            </div>
            <input type="range" min={0} max={replay.frames.length - 1} value={idx} onChange={(e) => { setIdx(Number(e.target.value)); setPlaying(false); }} style={{ marginTop: 8 }} />
            <div className="grid c2" style={{ marginTop: 8 }}>
              <div><div className="small muted">{t('replay.progress')}</div><Bar value={frame.releaseProgress} color="blue" label={frame.releaseProgress + '%'} /></div>
              <div><div className="small muted">{t('replay.stability')}</div><Bar value={frame.stability} color={frame.stability < 40 ? 'red' : 'green'} label={frame.stability + ''} /></div>
            </div>
          </div>

          {/* HUD 员工卡 */}
          <div className="hud" style={{ marginTop: 10 }}>
            {frame.workers.map((w) => {
              const p = res.participants.find((x) => x.workerId === w.id)!;
              return (
                <div key={w.id} className="who" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="row"><Avatar role={roles[w.id]} size={36} /><div className="small">{t('role.' + roles[w.id])}{done && p?.scapegoat && <span className="scapegoat-badge">🎯</span>}</div></div>
                  <div className="small muted">{t('label.' + w.label, w.label)}</div>
                  <Bar value={w.blame} color="red" label={'blame ' + w.blame} />
                  <Bar value={w.energy} color="yellow" label={'⚡' + w.energy} />
                </div>
              );
            })}
          </div>
        </div>

        {/* 侧栏：结果 / 时间线 */}
        <div>
          {done && (
            <div className="card">
              <h3>🏁 {t('status.' + res.resultStatus)}</h3>
              {scapegoat && (
                <div style={{ background: 'var(--deep)', border: '2px solid var(--red)', padding: 8, margin: '8px 0' }}>
                  <div className="row"><Avatar role={scapegoat.role} size={40} /><div><b style={{ color: 'var(--red2)' }}>{t('replay.scapegoat')}</b><div className="small">{t('role.' + scapegoat.role)} · blame {scapegoat.finalBlame}</div></div></div>
                  <p className="small" style={{ marginTop: 6 }}>{blameReason(t, respGraph.find((r) => r.workerId === scapegoat.workerId))}</p>
                </div>
              )}
              <table className="tbl">
                <thead><tr><th>#</th><th>{t('common.you')}</th><th>{t('replay.finalScore')}</th><th>blame</th></tr></thead>
                <tbody>
                  {[...res.participants].sort((a, b) => a.placement - b.placement).map((p) => (
                    <tr key={p.workerId}>
                      <td>{p.placement}</td>
                      <td>{p.placement === 1 ? '👑 ' : ''}{t('role.' + p.role)}{p.secretObjectiveAchieved && ' ⭐'}</td>
                      <td>{p.finalScore}</td>
                      <td>{p.finalBlame}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn sm cyan block" style={{ marginTop: 8 }} onClick={() => { navigator.clipboard.writeText(location.origin + api.base + '/api/matches/' + id + '/agent.json'); toast.show(t('replay.copyAgent') + ' ✔'); }}>📋 {t('replay.copyAgent')}</button>
              <div className="small muted" style={{ marginTop: 8 }}>replayHash <code>{res.replayHash.slice(0, 18)}…</code></div>
            </div>
          )}

          <div className="card">
            <h3>⏱ {t('replay.timeline')}</h3>
            <div style={{ maxHeight: 260, overflow: 'auto' }}>
              {shownEvents.map((e, i) => (
                <div key={i} className={`timeline-ev ${['bug_exploded', 'boss_caught', 'force_assign', 'ship'].includes(e.kind) ? 'hot' : ''}`}>
                  <span className="muted small">t{e.tick}</span> {eventText(t, e)}
                </div>
              ))}
            </div>
          </div>

          {done && (
            <div className="card">
              <h3>⚖ {t('replay.responsibility')}</h3>
              {respGraph.map((r) => (
                <div key={r.workerId} className="small" style={{ marginBottom: 4 }}>
                  <div className="row between"><span>{t('role.' + roles[r.workerId])}</span><b style={{ color: r.finalBlame > 40 ? 'var(--red2)' : 'var(--cream)' }}>{r.finalBlame}</b></div>
                  <Bar value={r.finalBlame} color="red" />
                  <span className="muted" style={{ fontSize: 11 }}>origin {r.origin} · custody {r.custody} · mitig {r.mitigation}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function eventText(t: (k: string, f?: string) => string, e: any): string {
  switch (e.kind) {
    case 'event': return '📢 ' + t('event.' + (e.data?.card || ''), e.data?.card || 'event');
    case 'bug_spawn': return '🐛 Bug sev' + (e.data?.severity ?? '');
    case 'bug_exploded': return '💥 ' + t('title.p0Explosion');
    case 'bug_fixed': return '🔧 fix';
    case 'ship': return '🚀 ship';
    case 'boss_caught': return '👔 ' + (e.workerId || '') + ' caught';
    case 'force_assign': return '🎯 force assign';
    case 'incident_phase': return '🚨 ' + t('phase.incident');
    case 'skill_rollback': return '↩ rollback';
    case 'match_end': return '🏁';
    default: return e.kind;
  }
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
