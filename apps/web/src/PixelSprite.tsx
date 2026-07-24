import React, { useEffect, useRef } from 'react';
import { characterCanvas, propCanvas, backgroundCanvas, type CharSpec } from './pixelart.js';

// 代码渲染的 8-bit 精灵：把离屏原生画布 NEAREST 放大绘制到显示画布（不使用任何 PNG）。
export function PixelSprite({
  kind = 'character',
  role,
  name,
  spec,
  size = 64,
  className = '',
  title,
}: {
  kind?: 'character' | 'prop' | 'background';
  role?: string;
  name?: string;
  spec?: Partial<CharSpec>;
  size?: number;
  className?: string;
  title?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const specKey = JSON.stringify(spec || {});

  const nativeW = kind === 'background' ? 160 : 50;
  const nativeH = kind === 'background' ? 90 : kind === 'prop' ? 50 : 48;
  const w = size;
  const h = Math.round((size * nativeH) / nativeW);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    let src: HTMLCanvasElement;
    if (kind === 'prop') src = propCanvas(name || 'red_bug');
    else if (kind === 'background') src = backgroundCanvas(name || 'open_office');
    else src = characterCanvas(role || name || 'engineer', spec);
    ctx.drawImage(src, 0, 0, cv.width, cv.height);
  }, [kind, role, name, specKey, w, h]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      title={title}
      className={'sprite ' + className}
      style={{ width: w, height: h, imageRendering: 'pixelated', display: 'block' }}
    />
  );
}
