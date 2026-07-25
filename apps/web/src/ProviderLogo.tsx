import React from 'react';
import { getProvider } from '@blame/shared';

// 代码渲染的 Agent 供应商徽标（内联 SVG，不使用任何图片文件）。
// 每个供应商一个可识别的几何标记 + 品牌色；无匹配时回退到短代码。
function Glyph({ id, c }: { id: string; c: string }) {
  const s = { fill: 'none', stroke: c, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'claude_code':
    case 'claude':
      // Anthropic 放射星芒
      return <g stroke={c} strokeWidth={2.2} strokeLinecap="round">{[0, 45, 90, 135].map((a) => { const r = 7; const x = 12 + r * Math.cos((a * Math.PI) / 180); const y = 12 + r * Math.sin((a * Math.PI) / 180); return <line key={a} x1={24 - x} y1={24 - y} x2={x} y2={y} />; })}</g>;
    case 'codex':
    case 'gpt':
      // OpenAI 风格六边形环
      return <polygon points="12,4 19,8 19,16 12,20 5,16 5,8" {...s} />;
    case 'qoder':
      // Q：圆 + 尾
      return <g {...s}><circle cx="11" cy="11" r="6.5" /><line x1="13" y1="14" x2="18" y2="19" /></g>;
    case 'opencode':
      // </>
      return <g {...s}><polyline points="9,7 4,12 9,17" /><polyline points="15,7 20,12 15,17" /><line x1="13" y1="6" x2="11" y2="18" /></g>;
    case 'cursor':
      // 光标三角
      return <polygon points="6,4 6,20 11,15 15,20 17,18 13,13 19,13" fill={c} stroke={c} strokeWidth={1.2} strokeLinejoin="round" />;
    case 'copilot':
      // 护目镜双点
      return <g {...s}><rect x="4" y="9" width="16" height="7" rx="3.5" /><circle cx="9" cy="12.5" r="1.6" fill={c} stroke="none" /><circle cx="15" cy="12.5" r="1.6" fill={c} stroke="none" /></g>;
    case 'gemini':
      // 四角星火花
      return <path d="M12 3 C13 8 16 11 21 12 C16 13 13 16 12 21 C11 16 8 13 3 12 C8 11 11 8 12 3 Z" fill={c} stroke="none" />;
    case 'deepseek':
      // 波浪曲线
      return <path d="M4 15 C7 9 11 9 12 12 C13 15 17 15 20 9" {...s} />;
    case 'doubao':
      // 豆包：小豆子（圆身 + 顶芽）
      return <g {...s}><ellipse cx="12" cy="14" rx="6" ry="5.5" /><path d="M12 8.5 C12 5.5 14.5 4.5 16 5 C15.5 7 14 8.5 12 8.5 Z" fill={c} stroke="none" /></g>;
    default:
      return null;
  }
}

export function ProviderLogo({ id, size = 24, showName = false }: { id?: string; size?: number; showName?: boolean }) {
  const p = getProvider(id);
  const hasGlyph = !['custom'].includes(p.id);
  const badge = (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ borderRadius: 5, background: p.accent, border: `1.5px solid ${p.color}`, flexShrink: 0 }} role="img" aria-label={p.name}>
      {hasGlyph ? <Glyph id={p.id} c={p.color} /> : <text x="12" y="16" textAnchor="middle" fontSize="9" fontFamily="monospace" fill={p.color}>{p.short}</text>}
    </svg>
  );
  if (!showName) return badge;
  return (
    <span className="row" style={{ gap: 6, margin: 0, alignItems: 'center' }} title={p.name}>
      {badge}
      <span className="small" style={{ color: p.color, fontWeight: 700 }}>{p.name}</span>
    </span>
  );
}
