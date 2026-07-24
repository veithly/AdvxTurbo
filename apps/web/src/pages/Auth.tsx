import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT, useI18n } from '../i18n/index.js';
import { useAuth } from '../store.js';
import { useToast } from '../ui.js';
import { sfx } from '../audio.js';

export function Auth() {
  const t = useT();
  const { locale } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const { login, register, guest } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('player1@blame.game');
  const [password, setPassword] = useState('test1234');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    sfx('click');
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name || email.split('@')[0], locale);
      sfx('success');
      nav('/office');
    } catch (e: any) {
      toast.show(t('auth.' + e.message, e.message), 'err');
      sfx('error');
    } finally {
      setBusy(false);
    }
  }

  async function playGuest() {
    setBusy(true);
    try {
      await guest(locale);
      nav('/arena');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content" style={{ maxWidth: 460 }}>
      <div className="card">
        <h2 className="page-title">{t('auth.loginTitle')}</h2>
        <div className="stepper">
          <div className={`step ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>{t('common.login')}</div>
          <div className={`step ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>{t('common.register')}</div>
        </div>
        <label>{t('auth.email')}</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@blame.game" />
        <label>{t('auth.password')}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {mode === 'register' && (
          <>
            <label>{t('auth.displayName')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="MyCorp" />
          </>
        )}
        <button className="btn primary block" style={{ marginTop: 16 }} disabled={busy} onClick={submit}>
          {mode === 'login' ? t('common.login') : t('common.register')}
        </button>
        <p className="small muted center" style={{ marginTop: 10 }}>
          {mode === 'login' ? (
            <a onClick={() => setMode('register')}>{t('auth.needAccount')}</a>
          ) : (
            <a onClick={() => setMode('login')}>{t('auth.haveAccount')}</a>
          )}
        </p>
        <hr style={{ borderColor: 'var(--gray2)' }} />
        <button className="btn block" disabled={busy} onClick={playGuest}>👤 {t('common.guest')}</button>
        <p className="small muted center" style={{ marginTop: 8 }}>{t('auth.guestHint')}</p>
        <p className="small muted center">demo: player1@blame.game / test1234</p>
      </div>
    </div>
  );
}
