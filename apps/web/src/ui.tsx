import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { useI18n, useT } from './i18n/index.js';
import { useAuth } from './store.js';
import { api } from './api.js';
import { toggleMute, isMuted, sfx } from './audio.js';
import { PixelSprite } from './PixelSprite.js';
import type { CharSpec } from './pixelart.js';
import { WalletButton } from './wallet.js';

// ---- config cache ----
let configCache: any = null;
export function useConfig() {
  const [cfg, setCfg] = useState<any>(configCache);
  useEffect(() => {
    if (configCache) return;
    api.get('/api/config').then((c) => {
      configCache = c;
      setCfg(c);
    }).catch(() => {});
  }, []);
  return cfg;
}

// 从员工的 appearance_json 读取代码渲染形象 spec（自定义外观）
export function avatarFromWorker(w: any): Partial<CharSpec> | undefined {
  if (!w) return undefined;
  try {
    const a = typeof w.appearance_json === 'string' ? JSON.parse(w.appearance_json || '{}') : w.appearance || {};
    return a?.charSpec || undefined;
  } catch {
    return undefined;
  }
}

// 代码渲染的角色头像（不使用任何 PNG）
export function Avatar({ role, size = 64, className = '', spec }: { role: string; size?: number; className?: string; spec?: Partial<CharSpec> }) {
  return <PixelSprite role={role} size={size} className={'avatar ' + className} spec={spec} />;
}

export function Bar({ value, max = 100, color = '', label }: { value: number; max?: number; color?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bar ${color}`}>
      <i style={{ width: pct + '%' }} />
      {label !== undefined && <span className="lbl">{label}</span>}
    </div>
  );
}

// ---- Toast ----
interface ToastState { msg: string; kind: 'ok' | 'err' | null; show: (m: string, k?: 'ok' | 'err') => void; }
export const useToast = create<ToastState>((set) => ({
  msg: '', kind: null,
  show: (msg, kind = 'ok') => {
    set({ msg, kind });
    setTimeout(() => set({ kind: null }), 2600);
  },
}));

export function ToastHost() {
  const { msg, kind } = useToast();
  if (!kind) return null;
  return <div className={`toast ${kind === 'err' ? 'err' : ''}`}>{msg}</div>;
}

export function Nav() {
  const t = useT();
  const { locale, setLocale } = useI18n();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [muted, setMuted] = useState(isMuted());
  const [open, setOpen] = useState(false);

  const links: Array<[string, string, string]> = [
    ['/', 'nav.home', '🏠'], ['/office', 'nav.office', '🏢'], ['/lab', 'nav.agentLab', '🧪'], ['/arena', 'nav.arena', '⚔'],
    ['/tournaments', 'nav.tournaments', '🏆'], ['/replays', 'nav.replays', '🎬'], ['/leaderboard', 'nav.leaderboard', '📊'],
    ['/economy', 'nav.economy', '💰'], ['/chain', 'nav.chainVault', '⛓'], ['/store', 'nav.store', '🛍'], ['/docs', 'nav.docs', '📖'],
  ];

  return (
    <nav className="nav">
      <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
        {t('app.title')}
        <small>CATCH THE HOTSPOT</small>
      </NavLink>
      <div className="menu-wrap">
        <button className="btn sm" onClick={() => { setOpen((o) => !o); sfx('click', 0.3); }}>☰ {t('nav.menu')}</button>
        {open && (
          <>
            <div className="menu-backdrop" onClick={() => setOpen(false)} />
            <div className="menu-panel">
              {links.map(([to, key, icon]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'menu-item' + (isActive ? ' active' : '')} onClick={() => { setOpen(false); sfx('click', 0.3); }}>
                  <span className="menu-ico">{icon}</span> {t(key)}
                </NavLink>
              ))}
            </div>
          </>
        )}
      </div>
      <span className="spacer" />
      <div className="navctl">
        <WalletButton />
        <button className="btn sm" onClick={() => { const m = toggleMute(); setMuted(m); }} title="mute">{muted ? '🔇' : '🔊'}</button>
        <button className="btn sm" onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}>{locale === 'zh' ? 'EN' : '中'}</button>
        {user ? (
          <>
            <NavLink to="/profile" className="btn sm cyan">{user.display_name?.slice(0, 10) || t('nav.profile')}</NavLink>
            <button className="btn sm" onClick={() => { logout(); nav('/'); }}>{t('common.logout')}</button>
          </>
        ) : (
          <NavLink to="/auth" className="btn sm primary">{t('common.login')}</NavLink>
        )}
      </div>
    </nav>
  );
}

export function Loading() {
  const t = useT();
  return <div className="content center"><p className="muted"><span className="spin">⏳</span> {t('common.loading')}</p></div>;
}

export function StatusTag({ status }: { status: string }) {
  const t = useT();
  const cls = status === 'success' ? 'green' : 'red';
  return <span className={`tag ${cls}`}>{t('status.' + status, status)}</span>;
}
