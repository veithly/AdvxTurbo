import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../db.js';
import { buildAvatarPrompt, proceduralAvatarSvg, APPEARANCE_TEMPLATES } from '@blame/shared';
import type { RoleId } from '@blame/shared';
import { sha256 } from '../util.js';

export const AVATAR_DIR = path.join(DATA_DIR, 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

// 图像生成 API 配置（OpenAI-compatible /images/generations）。未配置则用兜底。
const IMAGE_API_URL = process.env.IMAGE_API_URL || 'https://api.openai.com/v1';
const IMAGE_API_KEY = process.env.IMAGE_API_KEY || '';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gpt-image-1';

export interface AvatarResult {
  url: string;
  prompt: string;
  mode: 'ai' | 'procedural';
  templates?: typeof APPEARANCE_TEMPLATES;
}

/**
 * 生成自定义形象：
 *  1) 若配置了 IMAGE_API_KEY，用组装后的 8-bit prompt 调图像 API；
 *  2) 失败或未配置 → 程序化像素头像兜底（始终成功、可复现）。
 */
export async function generateAvatar(workerIdOrSeed: string, role: RoleId, userPrompt?: string): Promise<AvatarResult> {
  const fullPrompt = buildAvatarPrompt(role, userPrompt);
  const seed = sha256(workerIdOrSeed + ':' + (userPrompt || '') + ':' + role).slice(0, 16);

  if (IMAGE_API_KEY) {
    try {
      const res = await fetch(`${IMAGE_API_URL}/images/generations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${IMAGE_API_KEY}` },
        body: JSON.stringify({ model: IMAGE_MODEL, prompt: fullPrompt, size: '1024x1024', n: 1, response_format: 'b64_json' }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const b64 = data?.data?.[0]?.b64_json;
        const remoteUrl = data?.data?.[0]?.url;
        if (b64) {
          const file = path.join(AVATAR_DIR, seed + '.png');
          fs.writeFileSync(file, Buffer.from(b64, 'base64'));
          return { url: `/avatars/${seed}.png`, prompt: fullPrompt, mode: 'ai' };
        }
        if (remoteUrl) return { url: remoteUrl, prompt: fullPrompt, mode: 'ai' };
      }
    } catch {
      // 落到兜底
    }
  }

  // 兜底：程序化 8-bit 像素头像，存为 svg 文件（也可直接用 data-URI）
  const svg = decodeURIComponent(proceduralAvatarSvg(seed).replace('data:image/svg+xml;utf8,', ''));
  const file = path.join(AVATAR_DIR, seed + '.svg');
  fs.writeFileSync(file, svg, 'utf8');
  return { url: `/avatars/${seed}.svg`, prompt: fullPrompt, mode: 'procedural' };
}

export function appearanceTemplates() {
  return APPEARANCE_TEMPLATES;
}
