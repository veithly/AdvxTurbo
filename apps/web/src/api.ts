// 统一 API 客户端。开发环境经 Vite proxy 到 :4000
const BASE = import.meta.env.VITE_API_URL || '';

function tokenHeader(): Record<string, string> {
  const t = localStorage.getItem('token');
  return t ? { authorization: `Bearer ${t}` } : {};
}

async function req<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...tokenHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw Object.assign(new Error(data.code || res.statusText), { data, status: res.status });
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => req<T>('GET', p),
  post: <T = any>(p: string, b?: unknown) => req<T>('POST', p, b),
  patch: <T = any>(p: string, b?: unknown) => req<T>('PATCH', p, b),
  base: BASE,
};

// 素材 URL 助手
export function assetUrl(rel: string): string {
  return `${BASE}/assets/${rel}`;
}
export function nativeAsset(rel: string): string {
  return `${BASE}/assets/native/${rel}`;
}
export function audioUrl(name: string): string {
  return `${BASE}/audio/${name}`;
}
export function wsUrl(matchId: string, speed = 2): string {
  const base = BASE || `${location.protocol}//${location.host}`;
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/ws/match?id=${matchId}&speed=${speed}`;
}
