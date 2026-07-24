import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Avatar, useToast, useConfig } from '../ui.js';
import { ProviderLogo } from '../ProviderLogo.js';
import { sfx } from '../audio.js';

const COLORS = ['#D8702B', '#7B53A5', '#4B8955', '#499CBE', '#E85838', '#E8BE49'];
const ROLES = ['engineer', 'pm', 'qa', 'sre', 'designer', 'intern'];

export function CreateWorker() {
  const t = useT();
  const nav = useNavigate();
  const cfg = useConfig();
  const { user } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState('engineer');
  const [color, setColor] = useState(COLORS[0]);
  const [personality, setPersonality] = useState('');
  const [worker, setWorker] = useState<any>(null);
  const [keyPlain, setKeyPlain] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [charSpec, setCharSpec] = useState<any>(null);
  const [avatarMode, setAvatarMode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [agentTool, setAgentTool] = useState('claude_code');

  async function genAvatar() {
    setGenerating(true);
    sfx('click');
    try {
      const r = await api.post('/api/appearance/generate', { role, prompt });
      setCharSpec(r.charSpec);
      setAvatarMode(r.mode);
      sfx('success');
    } catch (e: any) {
      toast.show(e.message, 'err');
    } finally {
      setGenerating(false);
    }
  }

  if (!user) {
    return <div className="content"><div className="card center"><p>{t('common.login')} →</p><button className="btn primary" onClick={() => nav('/auth')}>{t('common.login')}</button></div></div>;
  }

  const steps = ['create.step.appearance', 'create.step.role', 'create.step.personality'];

  async function finish() {
    sfx('click');
    try {
      const w = await api.post('/api/workers', { name: name || 'Worker', role, appearance: { color, charSpec }, personality, agentTool });
      const key = await api.post(`/api/workers/${w.id}/keys`, { name: 'primary' });
      setWorker(w);
      setKeyPlain(key.plaintext);
      setStep(3);
      sfx('success');
    } catch (e: any) {
      toast.show(e.message, 'err');
    }
  }

  const roleMeta = (r: string) => cfg?.roles?.find((x: any) => x.id === r);

  return (
    <div className="content" style={{ maxWidth: 720 }}>
      <h2 className="page-title">{t('create.title')}</h2>
      {step < 3 && (
        <div className="stepper">
          {steps.map((s, i) => (
            <div key={s} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>{i + 1}. {t(s)}</div>
          ))}
        </div>
      )}

      {step === 0 && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'center' }}>
            <div style={{ background: color, padding: 8, border: '3px solid var(--outline)' }}><Avatar role={role} size={96} spec={charSpec || undefined} /></div>
          </div>
          <label>{t('create.name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rollback Raccoon" />
          <label>{t('create.color')}</label>
          <div className="row">
            {COLORS.map((c) => (
              <div key={c} onClick={() => setColor(c)} style={{ width: 34, height: 34, background: c, border: color === c ? '3px solid var(--yellow)' : '3px solid var(--outline)', cursor: 'pointer' }} />
            ))}
          </div>

          <label style={{ marginTop: 14 }}>🤖 {t('create.agentTool')}</label>
          <p className="small muted">{t('create.agentToolHint')}</p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {(cfg?.agentProviders || []).map((ap: any) => (
              <button key={ap.id} className={`btn sm ${agentTool === ap.id ? 'primary' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => { setAgentTool(ap.id); sfx('click', 0.3); }}>
                <ProviderLogo id={ap.id} size={18} /> {ap.name}
              </button>
            ))}
          </div>

          <label style={{ marginTop: 14 }}>🎨 {t('create.customAvatar')}</label>
          <p className="small muted">{t('create.avatarHint')}</p>
          <div className="row" style={{ marginBottom: 6 }}>
            {(cfg?.appearanceTemplates || []).map((tp: any) => (
              <button key={tp.id} className="btn sm" onClick={() => { setPrompt(tp.prompt); sfx('click', 0.3); }}>{t(tp.nameKey, tp.id)}</button>
            ))}
          </div>
          <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('create.avatarPrompt')} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn purple" disabled={generating} onClick={genAvatar}>{generating ? <span className="spin">🎨</span> : '🎨'} {generating ? t('create.generating') : t('create.generate')}</button>
            {charSpec && <button className="btn sm" onClick={() => { setCharSpec(null); setAvatarMode(''); }}>{t('create.useDefault')}</button>}
            {avatarMode && <span className={`tag ${avatarMode === 'ai' ? 'green' : 'gray'}`}>{avatarMode === 'ai' ? t('create.aiAvatar') : t('create.procedural')}</span>}
          </div>

          <button className="btn primary" style={{ marginTop: 16 }} onClick={() => { sfx('click'); setStep(1); }}>{t('common.next')} →</button>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <p className="muted">{t('create.pickRole')}</p>
          <div className="grid c3">
            {ROLES.map((r) => {
              const m = roleMeta(r);
              const mvp = ['engineer', 'pm', 'qa', 'sre'].includes(r);
              return (
                <div key={r} className={`role-pick ${role === r ? 'sel' : ''}`} onClick={() => { setRole(r); sfx('click', 0.3); }}>
                  <Avatar role={r} size={64} />
                  <div style={{ color: 'var(--cream)', marginTop: 6 }}>{t('role.' + r)}</div>
                  {m && <div className="small muted">{t('skill.' + m.skill.type)}</div>}
                  {!mvp && <span className="tag gray">6P</span>}
                </div>
              );
            })}
          </div>
          <div className="row between" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setStep(0)}>← {t('common.prev')}</button>
            <button className="btn primary" onClick={() => { sfx('click'); setStep(2); }}>{t('common.next')} →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <label>{t('create.personality')}</label>
          <input value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder={t('create.personality')} />
          <p className="small muted" style={{ marginTop: 8 }}>{roleMeta(role) && t((roleMeta(role) as any).passiveKey)}</p>
          <div className="row between" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setStep(1)}>← {t('common.prev')}</button>
            <button className="btn primary" onClick={finish}>✔ {t('create.getKey')}</button>
          </div>
        </div>
      )}

      {step === 3 && worker && (
        <div className="card">
          <div className="row"><Avatar role={role} size={72} spec={charSpec || undefined} /><div><h3>{worker.name}</h3><span className="tag">{t('role.' + role)}</span>{worker.passport_token_id && <span className="tag cyan">⛓ {t('office.nft')} #{worker.passport_token_id}</span>}</div></div>
          {worker.passport_token_id && <p className="small" style={{ color: 'var(--green2)' }}>✔ {t('create.nftMinted')} (#{worker.passport_token_id})</p>}
          <h3 style={{ marginTop: 12 }}>🔑 {t('office.workerKey')}</h3>
          <p className="small" style={{ color: 'var(--red2)' }}>⚠ {t('office.keyWarning')} {t('office.keyOnce')}</p>
          <div className="keybox">{keyPlain}</div>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { navigator.clipboard.writeText(keyPlain); toast.show(t('common.copied')); sfx('success'); }}>📋 {t('common.copy')}</button>
          <div style={{ marginTop: 16, borderTop: '1px solid var(--gray2)', paddingTop: 12 }}>
            <p className="small muted">🐾 {t('create.petHint')}</p>
            <a className="btn green" href={`${api.base}/api/workers/${worker.id}/codex-pet.zip?token=${localStorage.getItem('token')}`} onClick={() => sfx('click')}>🐾 {t('create.downloadPet')}</a>
          </div>
          <div className="row" style={{ marginTop: 20 }}>
            <button className="btn primary" onClick={() => nav('/office')}>{t('create.enterOffice')} →</button>
            <button className="btn purple" onClick={() => nav('/lab/' + worker.id)}>{t('nav.agentLab')} →</button>
          </div>
        </div>
      )}
    </div>
  );
}
