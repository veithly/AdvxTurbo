import React, { useEffect, useRef } from 'react';
import { ZONES, MAP_WIDTH, MAP_HEIGHT } from '@blame/shared';
import type { ReplayFrame, Severity, BugStatus } from '@blame/shared';
import { useT } from './i18n/index.js';
import { characterCanvas, propCanvas, type CharSpec } from './pixelart.js';

const ZONE_COLORS: Record<string, string> = {
  devDesk: '#2b3b52', designDesk: '#3a2f52', qa: '#2f5244', meeting: '#4a3a24',
  pantry: '#523f24', restroom: '#24404f', hr: '#3f3a52', release: '#524524',
  serverRoom: '#522b2b', bossOffice: '#3a2438',
};

// 每个区域的装饰道具（代码渲染），让房间不再是一块纯色
const ZONE_PROPS: Record<string, string[]> = {
  devDesk: ['ppt'], designDesk: ['ticket'], qa: ['ticket'], meeting: ['ppt', 'coffee'],
  pantry: ['coffee'], hr: ['ppt'], release: ['ticket'], serverRoom: ['server'], bossOffice: ['ppt'],
};

// 工位区：只有在这里开热点才能涨项目进度
const WORKSTATION_ZONES = new Set(['devDesk', 'designDesk', 'qa', 'serverRoom']);

// 每个区域的家具（多件铺满，不再单调）
const ZONE_FURNITURE: Record<string, string[]> = {
  devDesk: ['desk', 'monitor', 'chair', 'desk', 'monitor', 'chair'],
  designDesk: ['desk', 'monitor', 'chair', 'desk', 'monitor', 'chair'],
  qa: ['desk', 'monitor', 'chair', 'desk', 'monitor', 'chair'],
  serverRoom: ['server', 'desk', 'monitor', 'chair', 'server', 'chair'],
  meeting: ['ppt', 'chair', 'chair', 'plant'],
  pantry: ['coffee', 'plant', 'coffee'],
  hr: ['ticket', 'ppt', 'chair'],
  release: ['ppt', 'monitor', 'chair'],
  restroom: ['plant'],
  bossOffice: ['monitor', 'desk', 'chair'],
};

const ROLE_POOL = ['engineer', 'pm', 'qa', 'sre', 'designer', 'intern'];
function hashId(id: string): number { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h; }

function bugProp(severity: number, status: BugStatus): string {
  if (status === 'hidden') return 'hidden_bug';
  if (severity >= 4) return 'red_bug';
  if (severity === 3) return 'purple_bug';
  return 'green_bug';
}

export function OfficeCanvas({
  frame,
  roles,
  names,
  specs,
  bubbles,
  bossBubble,
  scapegoatId,
  height = 640,
}: {
  frame: ReplayFrame | null;
  roles: Record<string, string>;
  names: Record<string, string>;
  specs?: Record<string, Partial<CharSpec>>;
  bubbles?: Record<string, string>;
  bossBubble?: string;
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

    // 收集气泡，最后统一绘制（保证浮在所有精灵之上）
    const bubbleQueue: Array<{ cx: number; baseY: number; text: string; boss?: boolean }> = [];
    const drawBubble = (cx: number, baseY: number, text: string, boss = false) => {
      if (!text) return;
      ctx.font = 'bold 15px "DotGothic16", monospace';
      const tw = Math.min(ctx.measureText(text).width, ts * 4.2);
      const padX = 7, bw = tw + padX * 2, bh = 24;
      let bx = cx - bw / 2;
      let by = baseY - bh;
      if (by < 3) by = 3;
      bx = Math.max(3, Math.min(W - bw - 3, bx));
      // 气泡体
      ctx.fillStyle = boss ? '#ffe1d6' : '#f7f2e8';
      ctx.strokeStyle = '#171922';
      ctx.lineWidth = 2;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
      // 小尾巴
      ctx.beginPath();
      ctx.moveTo(cx - 6, by + bh - 1);
      ctx.lineTo(cx + 6, by + bh - 1);
      ctx.lineTo(cx, by + bh + 7);
      ctx.closePath();
      ctx.fillStyle = boss ? '#ffe1d6' : '#f7f2e8';
      ctx.fill();
      ctx.stroke();
      // 文本
      ctx.fillStyle = boss ? '#8a2b1a' : '#171922';
      ctx.textBaseline = 'top';
      ctx.fillText(text, bx + padX, by + 5);
    };

    // 地板（代码绘制）
    ctx.fillStyle = '#161b26';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if ((x + y) % 2 === 0) { ctx.fillStyle = '#1b2230'; ctx.fillRect(x * ts, y * ts, ts, ts); }
      }
    }

    // 区域（代码绘制的顶视办公室）
    ctx.textBaseline = 'top';
    ctx.font = '13px "DotGothic16", monospace';
    for (const z of ZONES) {
      const [zx, zy, zw, zh] = z.rect;
      ctx.fillStyle = ZONE_COLORS[z.id] || '#222';
      ctx.fillRect(zx * ts, zy * ts, zw * ts, zh * ts);
      // 顶部高光增加立体感
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(zx * ts + 2, zy * ts + 2, zw * ts - 4, 4);
      ctx.strokeStyle = '#0a0b0f';
      ctx.lineWidth = 2;
      ctx.strokeRect(zx * ts + 1, zy * ts + 1, zw * ts - 2, zh * ts - 2);
      // 工位区高亮（可 build 的地方）
      if (WORKSTATION_ZONES.has(z.id)) {
        ctx.strokeStyle = '#5AD2E6'; ctx.lineWidth = 3;
        ctx.strokeRect(zx * ts + 3, zy * ts + 3, zw * ts - 6, zh * ts - 6);
      }
      // 家具（多件铺满，不再单调）：工位区摆桌椅显示器，其它区摆绿植等
      const furn = ZONE_FURNITURE[z.id] || [];
      const per = Math.max(1, zw - 1);
      furn.forEach((pn, k) => {
        const sp = propCanvas(pn);
        const s = Math.round(ts * 0.9);
        const gx = (zx + 1 + (k % per)) * ts - s / 2;
        const gy = (zy + 1 + Math.floor(k / per) * 1.5) * ts;
        if (gy + s > (zy + zh + 1) * ts) return;
        ctx.drawImage(sp, gx, gy, s, s);
      });
      ctx.fillStyle = '#c7ccd1';
      ctx.fillText((WORKSTATION_ZONES.has(z.id) ? '📶 ' : '') + t('zone.' + z.id, z.id), zx * ts + 5, zy * ts + 5);
    }

    if (!frame) return;

    // Bug（代码渲染的道具精灵，画在机房）
    const server = ZONES.find((z) => z.id === 'serverRoom')!;
    frame.bugs.filter((b) => b.status !== 'resolved').forEach((b, i) => {
      const sprite = propCanvas(bugProp(b.severity as Severity, b.status));
      const bx = (server.spot[0] + (i % 3) - 1) * ts;
      const by = (server.spot[1] - 1 + Math.floor(i / 3)) * ts;
      const sz = b.severity >= 4 ? ts * 1.4 : ts;
      ctx.drawImage(sprite, bx, by, sz, sz);
      if (b.severity >= 4 && b.status === 'exploded') { ctx.strokeStyle = '#e85838'; ctx.lineWidth = 3; ctx.strokeRect(bx - 2, by - 2, sz + 4, sz + 4); }
    });

    // 角色分层渲染：先画地面效果（工作人员视锥 + 热点信号环），再画精灵
    const roleFor = (w: { id: string; label: string }) => roles[w.id] || (w.label === 'staff' ? 'boss' : ROLE_POOL[hashId(w.id) % 6]);
    // PASS A：地面效果
    for (const w of frame.workers) {
      const cx = w.pos[0] * ts + ts / 2, cy = w.pos[1] * ts + ts / 2;
      if (w.label === 'staff') {
        ctx.fillStyle = 'rgba(232,88,56,0.10)';
        ctx.beginPath(); ctx.arc(cx, cy, ts * 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(232,88,56,0.4)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, ts * 2.4, 0, Math.PI * 2); ctx.stroke();
      } else if (w.label === 'hotspot' || w.label === 'building') {
        const rr = ts * (0.6 + (w.suspicion / 100) * 0.8);
        ctx.strokeStyle = w.label === 'building' ? 'rgba(90,210,230,0.85)' : 'rgba(245,197,66,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, rr * 0.6, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // PASS B：精灵 + 状态
    for (const w of frame.workers) {
      const px = w.pos[0] * ts, py = w.pos[1] * ts;
      const isStaff = w.label === 'staff';
      const dq = w.label === 'dq';
      const sprite = characterCanvas(roleFor(w), isStaff ? undefined : specs?.[w.id]);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + 3, py + ts - 3, ts - 6, 3);
      const sw = isStaff ? ts * 1.3 : ts * 1.15, sh = isStaff ? ts * 1.6 : ts * 1.4;
      if (dq) ctx.globalAlpha = 0.45;
      ctx.drawImage(sprite, px - (sw - ts) / 2, py - (sh - ts) * 0.55, sw, sh);
      ctx.globalAlpha = 1;
      if (isStaff) {
        ctx.font = 'bold 12px "DotGothic16", monospace'; ctx.fillStyle = '#e85838';
        ctx.fillText('🦺', px + ts * 0.28, py - ts * 0.42);
      } else if (dq) {
        ctx.strokeStyle = '#e85838'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(px + 2, py - ts * 0.3); ctx.lineTo(px + ts - 2, py + ts * 0.7);
        ctx.moveTo(px + ts - 2, py - ts * 0.3); ctx.lineTo(px + 2, py + ts * 0.7);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#0a0b0f'; ctx.fillRect(px, py + ts * 0.92, ts, 5);
        ctx.fillStyle = '#5AD2E6'; ctx.fillRect(px + 1, py + ts * 0.92 + 1, Math.max(0, Math.min(1, w.contribution / 100)) * (ts - 2), 3);
        if (scapegoatId === w.id) { ctx.font = '16px "DotGothic16", monospace'; ctx.fillText('🎯', px - 4, py + ts * 0.1); }
      }
      const text = bubbles?.[w.id];
      if (text) bubbleQueue.push({ cx: px + ts / 2, baseY: py - ts * 0.5, text, boss: isStaff });
    }

    // 统一绘制气泡（浮在最上层）
    for (const b of bubbleQueue) drawBubble(b.cx, b.baseY, b.text, b.boss);
  }, [frame, roles, names, specs, bubbles, bossBubble, scapegoatId, t]);

  return <canvas ref={ref} className="office-stage" width={MAP_WIDTH * 48} height={height} style={{ aspectRatio: `${MAP_WIDTH * 48} / ${height}` }} />;
}
