import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { useI18n, useT } from './i18n/index.js';
import { useAuth } from './store.js';
import { api, nativeAsset } from './api.js';
import { toggleMute, isMuted, sfx } from './audio.js';

export { nativeAsset, assetUrl, audioUrl } from './api.js';

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

const ROLE_ASSET: Record<string, string> = {
  engineer: 'characters/01_orange_cat_programmer.png',
  pm: 'characters/02_capybara_product_manager.png',
  qa: 'characters/03_goose_qa_tester.png',
  sre: 'characters/04_raccoon_devops.png',
  designer: 'characters/05_shiba_designer.png',
  intern: 'characters/06_hamster_intern.png',
  boss: 'characters/07_bulldog_boss.png',
};
export function roleAsset(role: string): string {
  return nativeAsset(ROLE_ASSET[role] || ROLE_ASSET.engineer);
}

// 自定义形象 URL 解析（相对路径走 API base / proxy）
export function resolveAvatar(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return api.base + url;
}

export function avatarFromWorker(w: any): string | undefined {
  if (!w) return undefined;
  try {
    const a = typeof w.appearance_json === 'string' ? JSON.parse(w.appearance_json || '{}') : w.appearance || {};
    return resolveAvatar(a?.avatarUrl);
  } catch {
    return undefined;
  }
}

export function Avatar({ role, size = 64, className = '', src }: { role: string; size?: number; className?: string; src?: string }) {
  const resolved = resolveAvatar(src) || roleAsset(role);
  return <img className={`avatar sprite ${className}`} src={resolved} width={size} height={size} alt={role} style={{ width: size, height: size }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = roleAsset(role); }} />;
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

  const links: Array<[string, string]> = [
    ['/', 'nav.home'], ['/office', 'nav.office'], ['/lab', 'nav.agentLab'], ['/arena', 'nav.arena'],
    ['/tournaments', 'nav.tournaments'], ['/replays', 'nav.replays'], ['/leaderboard', 'nav.leaderboard'],
    ['/chain', 'nav.chainVault'], ['/store', 'nav.store'], ['/docs', 'nav.docs'],
  ];

  return (
    <nav className="nav">
      <NavLink to="/" className="brand">
        {t('app.title')}
        <small>BLAME GAME</small>
      </NavLink>
      {links.map(([to, key]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'navlink' + (isActive ? ' active' : '')} onClick={() => sfx('click', 0.3)}>
          {t(key)}
        </NavLink>
      ))}
      <span className="spacer" />
      <div className="navctl">
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
