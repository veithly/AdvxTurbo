import { audioUrl } from './api.js';

// 8-bit 音效 + 背景音乐播放器 (文件由 scripts/generate-sfx.mjs 生成)
let muted = localStorage.getItem('muted') === '1';
let bgm: HTMLAudioElement | null = null;
const cache: Record<string, HTMLAudioElement> = {};

export function isMuted() {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem('muted', muted ? '1' : '0');
  if (bgm) bgm.muted = muted;
  return muted;
}

export function sfx(name: string, volume = 0.5) {
  if (muted) return;
  try {
    let a = cache[name];
    if (!a) {
      a = new Audio(audioUrl(`sfx/${name}.wav`));
      cache[name] = a;
    }
    const clone = a.cloneNode(true) as HTMLAudioElement;
    clone.volume = volume;
    clone.play().catch(() => {});
  } catch {}
}

export function playBgm(name = 'office_theme', volume = 0.28) {
  try {
    if (bgm) {
      bgm.pause();
      bgm = null;
    }
    bgm = new Audio(audioUrl(`bgm/${name}.wav`));
    bgm.loop = true;
    bgm.volume = volume;
    bgm.muted = muted;
    bgm.play().catch(() => {});
  } catch {}
}

export function stopBgm() {
  if (bgm) {
    bgm.pause();
    bgm = null;
  }
}
