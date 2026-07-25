import { create } from 'zustand';
import { api } from './api.js';

interface User {
  id: string;
  display_name: string;
  email: string;
  locale: string;
  status: string;
}

interface AuthState {
  user: User | null;
  wallet: any | null;
  walletMeta: { address: string; custodial: boolean } | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  walletAuth: (user: User, token: string) => void;
  register: (email: string, password: string, displayName: string, locale: string) => Promise<void>;
  guest: (locale: string) => Promise<void>;
  logout: () => void;
  refreshWallet: () => Promise<void>;
}

function setToken(token: string) {
  localStorage.setItem('token', token);
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  wallet: null,
  walletMeta: null,
  loading: true,
  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) return set({ loading: false });
    try {
      const { user, wallet, walletMeta } = await api.get('/api/auth/me');
      set({ user, wallet, walletMeta: walletMeta || null, loading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, loading: false });
    }
  },
  login: async (email, password) => {
    const { user, token } = await api.post('/api/auth/login', { email, password });
    setToken(token);
    set({ user });
    await get().refreshWallet();
  },
  walletAuth: (user, token) => { setToken(token); set({ user }); void get().refreshWallet(); },
  register: async (email, password, displayName, locale) => {
    const { user, token } = await api.post('/api/auth/register', { email, password, displayName, locale });
    setToken(token);
    set({ user });
  },
  guest: async (locale) => {
    const { user, token } = await api.post('/api/auth/guest', { locale });
    setToken(token);
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, wallet: null, walletMeta: null });
  },
  refreshWallet: async () => {
    try {
      const { wallet, walletMeta } = await api.get('/api/auth/me');
      set({ wallet, walletMeta: walletMeta || null });
    } catch {}
  },
}));
