import React, { useEffect, useRef } from 'react';
import { ZONES, MAP_WIDTH, MAP_HEIGHT } from '@blame/shared';
import type { ReplayFrame } from '@blame/shared';
import { roleAsset, nativeAsset } from './ui.js';
import { useT } from './i18n/index.js';

const imgCache: Record<string, HTMLImageElement> = {};
function getImg(src: string): HTMLImageElement {
  if (!imgCache[src]) {
    const im = new Image();
    im.src = src;
    imgCache[src] = im;
  }
  return imgCache[src];
}

const ZONE_COLORS: Record<string, string> = {
  devDesk: '#2b3b52', designDesk: '#3a2f52', qa: '#2f5244', meeting: '#4a3a24',
  pantry: '#523f24', restroom: '#24404f', hr: '#3f3a52', release: '#524524',
  serverRoom: '#522b2b', bossOffice: '#3a2438',
};

const BUG_SPRITE: Record<number, string> = {
  5: 'props/01_serious_red_bug.png', 4: 'props/01_serious_red_bug.png',
  3: 'props/03_purple_exploit_bug.png', 2: 'props/02_green_virus_bug.png', 1: 'props/02_green_virus_bug.png',
};

export function OfficeCanvas({
  frame,
  roles,
  names,
  scapegoatId,
  height = 560,
}: {
  frame: ReplayFrame | null;
  roles: Record<string, string>;
  names: Record<string, string>;
  scapegoatId?: string;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = useT();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const ts = Math.floor(W / MAP_WIDTH);
    ctx.imageSmoothingEnabled = false;

    // 地板
    ctx.fillStyle = '#161b26';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if ((x + y) % 2 === 0) { ctx.fillStyle = '#1b2230'; ctx.fillRect(x * ts, y * ts, ts, ts); }
      }
    }

    // 区域
    ctx.textBaseline = 'top';
    ctx.font = '11px "DotGothic16", monospace';
    for (const z of ZONES) {
      const [zx, zy, zw, zh] = z.rect;
      ctx.fillStyle = ZONE_COLORS[z.id] || '#222';
      ctx.fillRect(zx * ts, zy * ts, zw * ts, zh * ts);
      ctx.strokeStyle = '#0a0b0f';
      ctx.lineWidth = 2;
      ctx.strokeRect(zx * ts + 1, zy * ts + 1, zw * ts - 2, zh * ts - 2);
      ctx.fillStyle = '#adb3b8';
      ctx.fillText(t('zone.' + z.id, z.id), zx * ts + 4, zy * ts + 3);
    }

    if (!frame) return;

    // Bug (机房)
    const server = ZONES.find((z) => z.id === 'serverRoom')!;
    frame.bugs.filter((b) => b.status !== 'resolved').forEach((b, i) => {
      const img = getImg(nativeAsset(BUG_SPRITE[b.severity] || BUG_SPRITE[2]));
      const bx = (server.spot[0] + (i % 3) - 1) * ts;
      const by = (server.spot[1] - 1 + Math.floor(i / 3)) * ts;
      const sz = b.severity >= 4 ? ts * 1.4 : ts;
      if (img.complete) ctx.drawImage(img, bx, by, sz, sz);
      if (b.severity >= 4 && b.status === 'exploded') { ctx.strokeStyle = '#e85838'; ctx.lineWidth = 3; ctx.strokeRect(bx - 2, by - 2, sz + 4, sz + 4); }
    });

    // 老板视锥 + 精灵
    const boss = frame.boss;
    const bx = boss.pos[0] * ts + ts / 2, by = boss.pos[1] * ts + ts / 2;
    ctx.fillStyle = 'rgba(232,88,56,0.15)';
    ctx.beginPath();
    ctx.arc(bx, by, ts * 6, 0, Math.PI * 2);
    ctx.fill();
    const bossImg = getImg(roleAsset('boss'));
    if (bossImg.complete) ctx.drawImage(bossImg, boss.pos[0] * ts, boss.pos[1] * ts - ts * 0.4, ts, ts * 1.4);
    ctx.fillStyle = '#e85838';
    ctx.fillText('👔 BOSS', boss.pos[0] * ts, boss.pos[1] * ts - ts * 0.6);

    // 员工
    for (const w of frame.workers) {
      const role = roles[w.id] || 'engineer';
      const img = getImg(roleAsset(role));
      const px = w.pos[0] * ts, py = w.pos[1] * ts;
      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px + 4, py + ts - 4, ts - 8, 4);
      if (img.complete) ctx.drawImage(img, px, py - ts * 0.35, ts, ts * 1.35);
      // 动作标签
      const label = t('label.' + w.label, w.label);
      ctx.font = '10px "DotGothic16", monospace';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = w.label === 'slacking' ? '#e85838' : w.label === 'fixing' ? '#68b35d' : '#0a0b0f';
      ctx.fillRect(px + ts / 2 - tw / 2 - 3, py - ts * 0.55, tw + 6, 13);
      ctx.fillStyle = '#f5f2e6';
      ctx.fillText(label, px + ts / 2 - tw / 2, py - ts * 0.52);
      // blame 条
      ctx.fillStyle = '#0a0b0f';
      ctx.fillRect(px, py + ts * 0.92, ts, 5);
      ctx.fillStyle = w.blame > 40 ? '#e85838' : '#e8be49';
      ctx.fillRect(px + 1, py + ts * 0.92 + 1, Math.max(0, Math.min(1, w.blame / 100)) * (ts - 2), 3);
      // scapegoat 皇冠
      if (scapegoatId === w.id) {
        ctx.fillStyle = '#e85838';
        ctx.font = '14px "DotGothic16", monospace';
        ctx.fillText('🎯', px + ts / 2 - 8, py - ts * 0.9);
      }
    }
  }, [frame, roles, names, scapegoatId, t]);

  return <canvas ref={ref} className="office-stage" width={MAP_WIDTH * 40} height={height} style={{ aspectRatio: `${MAP_WIDTH * 40} / ${height}` }} />;
}
