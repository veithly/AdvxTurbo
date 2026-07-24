import { buildAvatarPrompt, promptToCharSpec, APPEARANCE_TEMPLATES } from '@blame/shared';
import type { RoleId } from '@blame/shared';

// 自定义形象 = 代码渲染 spec（fur/shirt/accessory），由前端 8-bit 生成器 drawCharacter 渲染。
// 不再产生任何图片文件；若配置了文本模型可把 prompt 映射为 spec（此处用关键词+哈希规则）。
const IMAGE_API_KEY = process.env.IMAGE_API_KEY || '';

export interface AppearanceResult {
  mode: 'ai' | 'code';
  prompt: string;
  charSpec: { fur?: string; shirt?: string; accessory?: string };
}

export function generateAppearance(seed: string, role: RoleId, userPrompt?: string): AppearanceResult {
  const prompt = buildAvatarPrompt(role, userPrompt);
  const charSpec = promptToCharSpec(userPrompt || '', seed);
  return { mode: IMAGE_API_KEY ? 'ai' : 'code', prompt, charSpec };
}

export function appearanceTemplates() {
  return APPEARANCE_TEMPLATES;
}
