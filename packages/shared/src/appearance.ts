import { Rng } from './rng.js';
import type { RoleId } from './types.js';

// ============================================================================
// 自定义形象：内置 8-bit 风格 Prompt 模板 + 兜底（现成素材 / 程序化像素头像）
// 运行时若配置了图像 API 则调用生成，否则使用兜底，保证始终有形象。
// ============================================================================

// 统一 8-bit 风格前缀，保证生成图与游戏调性一致
export const AVATAR_STYLE_BASE =
  '8-bit pixel art avatar, NES/SNES retro game style, hard pixel edges, no anti-aliasing, limited palette, ' +
  'centered head-and-shoulders portrait, thick dark outline, flat shading, plain solid background, 64x64 sprite look';

// 每个职业的基础形象描述（拼进 prompt）
export const ROLE_APPEARANCE: Record<RoleId, string> = {
  engineer: 'an orange tabby cat software engineer wearing glasses and a hoodie, holding a tiny laptop',
  pm: 'a calm capybara product manager in a neat shirt, holding a tablet with charts',
  qa: 'a serious white goose QA tester with a magnifying glass and a clipboard',
  sre: 'a raccoon SRE/devops in a dark ops jacket with a headset, wrench in paw',
  designer: 'a shiba inu designer with a beret and stylus, colorful scarf',
  intern: 'a tiny nervous hamster intern with an oversized badge and coffee cup',
};

// 内置 Prompt 模板（玩家可一键套用再改）— 更多办公室梗
export interface AppearanceTemplate {
  id: string;
  nameKey: string;
  prompt: string;
}

export const APPEARANCE_TEMPLATES: AppearanceTemplate[] = [
  { id: 'crunch', nameKey: 'appr.crunch', prompt: 'exhausted with heavy dark eye-bags, three energy drinks, messy fur, "996" hoodie, ghostly aura' },
  { id: 'cyberpunk', nameKey: 'appr.cyberpunk', prompt: 'cyberpunk neon visor, glowing circuit tattoos, holographic necktie, purple-cyan rim light' },
  { id: 'boss_mode', nameKey: 'appr.boss_mode', prompt: 'sharp business suit, golden tie, tiny crown, smug confident grin, dollar-sign eyes' },
  { id: 'lucky_koi', nameKey: 'appr.lucky_koi', prompt: 'blessed by a lucky koi, golden halo, four-leaf clover pin, sparkles of good fortune' },
  { id: 'firefighter', nameKey: 'appr.firefighter', prompt: 'firefighter helmet, fire extinguisher on back, soot on face, red alert glow, heroic pose' },
  { id: 'zen', nameKey: 'appr.zen', prompt: 'zen monk robe, calm closed eyes, floating meditation, tea cup, soft green aura' },
  { id: 'startup', nameKey: 'appr.startup', prompt: 'hoodie and flip-flops startup founder, pitch deck in hand, hockey-stick growth chart behind' },
  { id: 'detective', nameKey: 'appr.detective', prompt: 'noir detective trench coat and hat, magnifying glass, evidence folder, dramatic shadow' },
];

/** 组装完整生成 prompt：风格基底 + 职业底 + 玩家自定义 */
export function buildAvatarPrompt(role: RoleId, userPrompt?: string): string {
  const parts = [AVATAR_STYLE_BASE, ROLE_APPEARANCE[role]];
  if (userPrompt && userPrompt.trim()) parts.push(userPrompt.trim());
  return parts.join(', ');
}

// 兜底像素头像调色板（取自游戏 palette）
const SKIN = ['#E6B97D', '#D8702B', '#A46F44', '#BE854B', '#ADB3B8', '#F7E6BF'];
const CLOTH = ['#7B53A5', '#3F6C91', '#4B8955', '#C24135', '#30425B', '#E8BE49'];
const BG = ['#253349', '#1E2432', '#30425B', '#2f5244', '#3a2f52'];

/**
 * 程序化 8-bit 头像（左右对称的像素肖像），完全离线可用的兜底形象。
 * 由 seed 决定，稳定可复现。返回 data-URI 形式的 SVG，可直接用于 <img src>。
 */
export function proceduralAvatarSvg(seed: string): string {
  const rng = new Rng('avatar:' + seed);
  const grid = 8; // 8x8 对称
  const cell = 8; // 每格 8px -> 64px
  const skin = SKIN[rng.int(0, SKIN.length - 1)];
  const cloth = CLOTH[rng.int(0, CLOTH.length - 1)];
  const bg = BG[rng.int(0, BG.length - 1)];
  const outline = '#16161D';
  let rects = `<rect width="64" height="64" fill="${bg}"/>`;
  const filled: boolean[][] = [];
  for (let y = 0; y < grid; y++) {
    filled[y] = [];
    for (let x = 0; x < grid / 2; x++) {
      // 顶部两行/边缘更可能留白，中部更可能填充，形成头像轮廓
      const edge = x === 0 || y === 0 || y === grid - 1;
      const p = edge ? 2500 : 6500;
      filled[y][x] = rng.chance(p);
    }
  }
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid / 2; x++) {
      if (!filled[y][x]) continue;
      // 上半部分皮肤色，下半部分衣服色
      const color = y < grid * 0.55 ? skin : cloth;
      for (const gx of [x, grid - 1 - x]) {
        rects += `<rect x="${gx * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${color}" stroke="${outline}" stroke-width="1"/>`;
      }
    }
  }
  // 眼睛（对称）
  const eyeY = Math.floor(grid * 0.35) * cell;
  rects += `<rect x="${2 * cell}" y="${eyeY}" width="${cell}" height="${cell}" fill="${outline}"/>`;
  rects += `<rect x="${5 * cell}" y="${eyeY}" width="${cell}" height="${cell}" fill="${outline}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges">${rects}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
