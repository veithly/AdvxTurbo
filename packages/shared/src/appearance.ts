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

// 形象色板（取自 8-bit 生成器 palette）
const FURS = ['#F28C28', '#E99B37', '#8B929B', '#A66F45', '#C98B57', '#B18A68', '#5DBB63', '#8E5AC8', '#5AD2E6', '#F5C542'];
const SHIRTS = ['#172231', '#1F4C73', '#1B2635', '#252B35', '#2367A6', '#8E5AC8', '#E84B3C', '#5DBB63', '#39414D', '#5AD2E6'];
const ACCS = ['laptop', 'coffee', 'clipboard', 'wrench', 'magnifier', 'backpack', 'tie'];

// prompt 关键词 -> 代码渲染 spec 覆盖（与内置模板对应）
const KW: Array<[RegExp, AvatarSpecOverride]> = [
  [/cyber|neon|赛博/i, { shirt: '#5AD2E6', fur: '#8E5AC8', accessory: 'laptop' }],
  [/boss|老板|suit|crown|tie/i, { shirt: '#1E2228', accessory: 'tie' }],
  [/fire|救火|extinguisher|chief/i, { shirt: '#E84B3C', accessory: 'wrench' }],
  [/koi|lucky|锦鲤|gold|halo/i, { fur: '#F5C542', accessory: 'coffee' }],
  [/zen|佛|monk|calm/i, { shirt: '#5DBB63', accessory: 'coffee' }],
  [/crunch|996|eye-bag|黑眼圈|tired/i, { shirt: '#39414D', fur: '#8B929B' }],
  [/startup|创业|hoodie/i, { shirt: '#F28C28', accessory: 'backpack' }],
  [/detect|侦探|noir|magnif/i, { shirt: '#1F4C73', accessory: 'magnifier' }],
];

export interface AvatarSpecOverride {
  fur?: string;
  shirt?: string;
  accessory?: string;
}

/**
 * 由 prompt + seed 生成代码渲染形象 spec（关键词优先，否则哈希取色）。
 * 前端用 8-bit 生成器的 drawCharacter 渲染，不产生任何图片文件。
 */
export function promptToCharSpec(prompt: string, seed: string): AvatarSpecOverride {
  const spec: AvatarSpecOverride = {};
  for (const [re, ov] of KW) if (re.test(prompt || '')) Object.assign(spec, ov);
  const rng = new Rng('spec:' + seed + ':' + (prompt || ''));
  if (!spec.fur) spec.fur = FURS[rng.int(0, FURS.length - 1)];
  if (!spec.shirt) spec.shirt = SHIRTS[rng.int(0, SHIRTS.length - 1)];
  if (!spec.accessory && prompt) spec.accessory = ACCS[rng.int(0, ACCS.length - 1)];
  return spec;
}
