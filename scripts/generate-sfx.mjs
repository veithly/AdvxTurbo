#!/usr/bin/env node
// 生成 8-bit 音效与背景音乐 (纯 Node，无依赖)。输出到 assets_audio/{sfx,bgm}/*.wav
// PRD 音频资源制作：短音效脚本化生成；背景音乐见 scripts/generate-music.md (MiniMax)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../assets_audio');
const SR = 44100;

fs.mkdirSync(path.join(OUT, 'sfx'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'bgm'), { recursive: true });

// ---- WAV 编码 (16-bit PCM mono) ----
function writeWav(file, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
}

// ---- 波形 ----
function square(t, f, duty = 0.5) { return ((t * f) % 1) < duty ? 1 : -1; }
function triangle(t, f) { const p = (t * f) % 1; return 4 * Math.abs(p - 0.5) - 1; }
function saw(t, f) { return 2 * ((t * f) % 1) - 1; }
function noise() { return Math.random() * 2 - 1; }

// 生成一段音符
function tone({ freq, dur, type = 'square', vol = 0.5, attack = 0.005, decay = 0.05, sustain = 0.7, release = 0.05, sweep = 0, duty = 0.5 }) {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freq + sweep * t;
    let w;
    if (type === 'square') w = square(t, f, duty);
    else if (type === 'triangle') w = triangle(t, f);
    else if (type === 'saw') w = saw(t, f);
    else w = noise();
    // ADSR 包络
    let env;
    const rel = dur - release;
    if (t < attack) env = t / attack;
    else if (t < attack + decay) env = 1 - (1 - sustain) * ((t - attack) / decay);
    else if (t < rel) env = sustain;
    else env = sustain * (1 - (t - rel) / release);
    out[i] = w * env * vol;
  }
  return out;
}

function concat(...arrs) {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
function mix(...arrs) {
  const total = Math.max(...arrs.map((a) => a.length));
  const out = new Float32Array(total);
  for (const a of arrs) for (let i = 0; i < a.length; i++) out[i] += a[i];
  return out;
}
const N = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, E5: 659.25, G5: 783.99, C3: 130.81, G3: 196, A3: 220, F3: 174.61, E3: 164.81 };

// ---- SFX ----
const sfx = {
  click: () => tone({ freq: 660, dur: 0.06, type: 'square', vol: 0.4, duty: 0.25, release: 0.03 }),
  success: () => concat(tone({ freq: N.C5, dur: 0.09, vol: 0.4 }), tone({ freq: N.E5, dur: 0.09, vol: 0.4 }), tone({ freq: N.G5, dur: 0.16, vol: 0.45 })),
  error: () => concat(tone({ freq: 220, dur: 0.12, type: 'square', vol: 0.45, duty: 0.5 }), tone({ freq: 160, dur: 0.2, type: 'square', vol: 0.45 })),
  match_start: () => concat(tone({ freq: N.C4, dur: 0.1, vol: 0.4 }), tone({ freq: N.G4, dur: 0.1, vol: 0.4 }), tone({ freq: N.C5, dur: 0.22, vol: 0.5, sweep: 200 })),
  ship: () => tone({ freq: 300, dur: 0.4, type: 'square', vol: 0.5, sweep: 900, duty: 0.4 }),
  explosion: () => mix(tone({ freq: 90, dur: 0.5, type: 'noise', vol: 0.5, release: 0.3 }), tone({ freq: 70, dur: 0.5, type: 'square', vol: 0.3, sweep: -60 })),
  alert: () => concat(tone({ freq: 880, dur: 0.12, type: 'square', vol: 0.4 }), tone({ freq: 660, dur: 0.12, type: 'square', vol: 0.4 }), tone({ freq: 880, dur: 0.14, type: 'square', vol: 0.4 })),
  fix: () => concat(tone({ freq: N.E4, dur: 0.05, type: 'triangle', vol: 0.4 }), tone({ freq: N.A4, dur: 0.1, type: 'triangle', vol: 0.45, sweep: 300 })),
  coffee: () => tone({ freq: 400, dur: 0.25, type: 'noise', vol: 0.25, release: 0.2 }),
  blame: () => concat(tone({ freq: N.A4, dur: 0.1, type: 'saw', vol: 0.4 }), tone({ freq: N.F4, dur: 0.1, type: 'saw', vol: 0.4 }), tone({ freq: N.C4, dur: 0.25, type: 'saw', vol: 0.45 })),
};

for (const [name, gen] of Object.entries(sfx)) {
  writeWav(path.join(OUT, 'sfx', name + '.wav'), gen());
  console.log('  sfx/' + name + '.wav');
}

// ---- BGM: 可循环 8-bit 办公室主题 (~24s) ----
function buildBgm() {
  const bpm = 132;
  const beat = 60 / bpm;
  const eighth = beat / 2;
  // I-V-vi-IV 循环 (C - G - Am - F)，每和弦 4 拍
  const chords = [
    [N.C4, N.E4, N.G4], [N.G3, N.B4, N.D4], [N.A3, N.C5, N.E5], [N.F3, N.A4, N.C5],
  ];
  const bassNotes = [N.C3, N.G3, N.A3, N.F3];
  const parts = [];
  for (let rep = 0; rep < 3; rep++) {
    for (let c = 0; c < chords.length; c++) {
      const arp = chords[c];
      const bassBuf = tone({ freq: bassNotes[c] / 2, dur: beat * 4, type: 'triangle', vol: 0.28, sustain: 0.8, release: 0.1 });
      // 琶音：每八分音符一个音
      const arpSteps = [];
      for (let i = 0; i < 8; i++) {
        arpSteps.push(tone({ freq: arp[i % arp.length] * (i >= 4 ? 2 : 1), dur: eighth, type: 'square', vol: 0.18, duty: 0.35, release: 0.02 }));
      }
      const lead = tone({ freq: arp[0] * 2, dur: beat * 2, type: 'square', vol: 0.14, duty: 0.5, release: 0.1 });
      const measure = mix(bassBuf, concat(...arpSteps), concat(new Float32Array(Math.floor(SR * beat)), lead));
      parts.push(measure);
    }
  }
  return concat(...parts);
}
writeWav(path.join(OUT, 'bgm', 'office_theme.wav'), buildBgm());
console.log('  bgm/office_theme.wav');
console.log('Done. Audio at:', OUT);
