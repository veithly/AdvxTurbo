import React, { useEffect, useRef, useState } from 'react';
import { ZONES, MAP_WIDTH, MAP_HEIGHT } from '@blame/shared';
import type { ReplayFrame, Severity, BugStatus } from '@blame/shared';
import { useT } from './i18n/index.js';
import { characterCanvas, propCanvas, type CharSpec } from './pixelart.js';

// 每个区域渲染真实的详细房间背景图（图中所示的 8-bit 房间）
const BG_SRC: Record<string, string> = {
  devDesk: '/bg/open_office.png', designDesk: '/bg/open_office.png', qa: '/bg/open_office.png', serverRoom: '/bg/endpoint_d.png',
  meeting: '/bg/blue_rest.png', pantry: '/bg/sponsor.png', restroom: '/bg/restroom.png', hr: '/bg/meeting_room.png',
  release: '/bg/submit.png', bossOffice: '/bg/workshop.png',
};
const bgCache: Record<string, HTMLImageElement> = {};
function bgImage(zoneId: string): HTMLImageElement | null {
  const src = BG_SRC[zoneId];
  if (!src) return null;
  let img = bgCache[src];
  if (!img) { img = new Image(); img.src = src; bgCache[src] = img; }
  return img.complete && img.naturalWidth ? img : null;
}

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
  ownIds,
  height = 640,
}: {
  frame: ReplayFrame | null;
  roles: Record<string, string>;
  names: Record<string, string>;
  specs?: Record<string, Partial<CharSpec>>;
  bubbles?: Record<string, string>;
  bossBubble?: string;
  scapegoatId?: string;
  ownIds?: Set<string>;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = useT();
  const [, setBgTick] = useState(0);
  // 浮动提示：检测相邻帧的灵感/精力提升 → 头顶飘 "+灵感/+精力"
  const prevStatsRef = useRef<Record<string, { e: number; i: number }>>({});
  const floatsRef = useRef<Array<{ id: number; x: number; y: number; text: string; color: string; born: number }>>([]);
  const floatIdRef = useRef(0);
  useEffect(() => {
    Object.values(BG_SRC).forEach((src) => {
      let im = bgCache[src];
      if (!im) { im = new Image(); im.src = src; bgCache[src] = im; }
      if (!im.complete) im.onload = () => setBgTick((x) => x + 1);
    });
  }, []);

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
      const img = bgImage(z.id);
      if (img) { ctx.drawImage(img, zx * ts, zy * ts, zw * ts, zh * ts); }
      else { ctx.fillStyle = ZONE_COLORS[z.id] || '#222'; ctx.fillRect(zx * ts, zy * ts, zw * ts, zh * ts); }
      ctx.strokeStyle = '#0a0b0f';
      ctx.lineWidth = 2;
      ctx.strokeRect(zx * ts + 1, zy * ts + 1, zw * ts - 2, zh * ts - 2);
      // 端点（可 build 的地方）青色高亮
      if (WORKSTATION_ZONES.has(z.id)) {
        ctx.strokeStyle = '#5AD2E6'; ctx.lineWidth = 3;
        ctx.strokeRect(zx * ts + 2, zy * ts + 2, zw * ts - 4, zh * ts - 4);
      }
      // 区域名标签（深色底衷便于在详细背景上阅读）
      const lbl = (WORKSTATION_ZONES.has(z.id) ? '📶 ' : '') + t('zone.' + z.id, z.id);
      ctx.font = 'bold 12px "DotGothic16", monospace';
      ctx.textBaseline = 'top';
      const tw = ctx.measureText(lbl).width;
      ctx.fillStyle = 'rgba(10,11,15,0.72)'; ctx.fillRect(zx * ts + 3, zy * ts + 3, tw + 8, 16);
      ctx.fillStyle = '#e8f0f5'; ctx.fillText(lbl, zx * ts + 6, zy * ts + 5);
    }

    if (!frame) return;

    // 检测本帧的灵感/精力提升，生成头顶浮动提示
    const prevStats = prevStatsRef.current;
    const nextStats: Record<string, { e: number; i: number }> = {};
    for (const w of frame.workers) {
      if (w.label === 'staff' || w.label === 'dq') continue;
      const insp = (w as any).inspiration || 0;
      const pr = prevStats[w.id];
      if (pr) {
        const di = insp - pr.i, de = w.energy - pr.e;
        if (di >= 2) floatsRef.current.push({ id: ++floatIdRef.current, x: w.pos[0], y: w.pos[1], text: '+\u7075\u611f ' + Math.round(di), color: '#A36ECE', born: frame.tick });
        else if (de >= 3) floatsRef.current.push({ id: ++floatIdRef.current, x: w.pos[0], y: w.pos[1], text: '+\u7cbe\u529b ' + Math.round(de), color: '#E8BE49', born: frame.tick });
      }
      nextStats[w.id] = { e: w.energy, i: insp };
    }
    prevStatsRef.current = nextStats;
    floatsRef.current = floatsRef.current.filter((f) => frame.tick - f.born >= 0 && frame.tick - f.born <= 6);

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

    // 展位刷新道具：在赞助商展台上显示道具（Qoder额度/开发板/机器人/3D打印），每 ~8s 刷新高亮一个
    const pantryRect = ZONES.find((z) => z.id === 'pantry')?.rect;
    if (pantryRect) {
      const [zx, zy] = pantryRect;
      const emojis = ['⚡', '🔌', '🤖', '🖨️'];
      const fresh = Math.floor(frame.tick / 40) % emojis.length;
      ctx.textAlign = 'center';
      emojis.forEach((emo, k) => {
        const gx = (zx + 0.6 + k) * ts, gy = (zy + 1.15) * ts, s = ts * 0.8;
        if (k === fresh) { ctx.fillStyle = 'rgba(245,197,66,0.4)'; ctx.beginPath(); ctx.arc(gx + s / 2, gy + s / 2, s * 0.72, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(10,11,15,0.6)'; ctx.fillRect(gx, gy, s, s);
        ctx.font = '16px "DotGothic16", monospace'; ctx.fillText(emo, gx + s / 2, gy + s * 0.72);
      });
      ctx.textAlign = 'left';
    }

    // 热点覆盖范围（工作人员只知“这一带有热点”，不知道具体是谁）：开热点处一圈信号
    for (const w of frame.workers) {
      if (w.label !== 'building' && w.label !== 'hotspot') continue;
      const cx = w.pos[0] * ts + ts / 2, cy = w.pos[1] * ts + ts / 2, rr = ts * 2.2;
      const g = ctx.createRadialGradient(cx, cy, ts * 0.3, cx, cy, rr);
      g.addColorStop(0, 'rgba(245,197,66,0.26)'); g.addColorStop(1, 'rgba(245,197,66,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
    }

    // 角色渲染（工作人员靠近时才可见）
    const roleFor = (w: { id: string; label: string }) => roles[w.id] || (w.label === 'staff' ? 'boss' : ROLE_POOL[hashId(w.id) % 6]);
    const builderPts = frame.workers.filter((w) => w.label !== 'staff' && w.label !== 'dq').map((w) => w.pos);
    const STAFF_FOG = 4; // 工作人员与选手曼哈顿距离 ≤ 4 时才显示位置
    const staffVisible = (pos: [number, number]) => builderPts.some((p) => Math.abs(p[0] - pos[0]) + Math.abs(p[1] - pos[1]) <= STAFF_FOG);
    // 精灵 + 状态
    for (const w of frame.workers) {
      const isStaff = w.label === 'staff';
      if (isStaff && !staffVisible(w.pos)) continue; // 迷雾：远处的工作人员隐藏
      const px = w.pos[0] * ts, py = w.pos[1] * ts;
      const dq = w.label === 'dq';
      const sprite = characterCanvas(roleFor(w), specs?.[w.id]); // 工作人员若有志愿者 spec 也生效（志愿者到场执勤）
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
        // 头顶三条状态：build(青) / 精力(黄) / 灵感(紫)
        const bw = ts - 8, bx = px + 4;
        const insp = (w as any).inspiration || 0;
        const rows: Array<[number, string]> = [[w.contribution, '#5AD2E6'], [w.energy, '#E8BE49'], [insp, '#A36ECE']];
        rows.forEach((r, ri) => {
          const yy = py - 24 + ri * 4;
          ctx.fillStyle = 'rgba(10,11,15,0.85)'; ctx.fillRect(bx - 1, yy - 1, bw + 2, 4);
          ctx.fillStyle = r[1]; ctx.fillRect(bx, yy, Math.max(0, Math.min(1, r[0] / 100)) * bw, 2);
        });
        if (scapegoatId === w.id) { ctx.font = '16px "DotGothic16", monospace'; ctx.fillText('🎯', px - 4, py + ts * 0.1); }
        // 开热点标识（观众可见）
        if (w.label === 'building' || w.label === 'hotspot') { ctx.font = 'bold 13px "DotGothic16", monospace'; ctx.textAlign = 'center'; ctx.fillText('📶', px + ts / 2, py - 30); ctx.textAlign = 'left'; }
        // 圈出自己的角色
        if (ownIds && ownIds.has(w.id)) {
          ctx.strokeStyle = '#68B35D'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.ellipse(px + ts / 2, py + ts * 0.9, ts * 0.52, ts * 0.24, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#68B35D'; ctx.font = 'bold 10px "DotGothic16", monospace'; ctx.textAlign = 'center'; ctx.fillText('YOU', px + ts / 2, py + ts * 1.2); ctx.textAlign = 'left';
        }
      }
      const text = bubbles?.[w.id];
      if (text) bubbleQueue.push({ cx: px + ts / 2, baseY: py - ts * 0.5, text, boss: isStaff });
    }

    // 浮动提示（+灵感/+精力）：随时间上升淡出
    ctx.textAlign = 'center';
    for (const f of floatsRef.current) {
      const age = frame.tick - f.born;
      const fx = f.x * ts + ts / 2, fy = f.y * ts - 8 - age * 4;
      ctx.globalAlpha = Math.max(0, 1 - age / 6);
      ctx.font = 'bold 12px "DotGothic16", monospace';
      ctx.fillStyle = '#0a0b0f'; ctx.fillText(f.text, fx + 1, fy + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, fx, fy);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';

    // 统一绘制气泡（浮在最上层）
    for (const b of bubbleQueue) drawBubble(b.cx, b.baseY, b.text, b.boss);
  }, [frame, roles, names, specs, bubbles, bossBubble, scapegoatId, ownIds, t, setBgTick]);

  return <canvas ref={ref} className="office-stage" width={MAP_WIDTH * 48} height={height} style={{ aspectRatio: `${MAP_WIDTH * 48} / ${height}` }} />;
}
