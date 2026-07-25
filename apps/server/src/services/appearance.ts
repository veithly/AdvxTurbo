import { buildAvatarPrompt, promptToCharSpec, APPEARANCE_TEMPLATES } from '@blame/shared';
import type { RoleId } from '@blame/shared';

// 自定义形象 = 代码渲染 spec（fur/shirt/accessory），由前端 8-bit 生成器 drawCharacter 渲染。
// 若配置了 OpenAI/Agnes 兼容模型（.env），则用 LLM 把描述转成 charSpec；失败回退到关键词+哈希规则。
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.IMAGE_API_KEY || '';
const OPENAI_BASE = (process.env.OPENAI_BASE_URL || '').replace(/\/$/, '');
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export interface AppearanceResult {
  mode: 'ai' | 'code';
  prompt: string;
  charSpec: { fur?: string; shirt?: string; accessory?: string };
}

const HEX = (v: unknown) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined);
const ACCS = ['none', 'glasses', 'tie', 'hat', 'headphones', 'cap', 'laptop', 'coffee', 'clipboard', 'wrench', 'magnifier', 'backpack'];
const SPECIES_OK = ['cat', 'capybara', 'goose', 'raccoon', 'shiba', 'hamster', 'bulldog'];

// 用 LLM（OpenAI 兼容接口）把描述转成 8-bit charSpec（含物种）；任何异常/无密钥返回 null
async function aiCharSpec(userPrompt: string): Promise<{ species?: string; fur?: string; shirt?: string; accessory?: string } | null> {
  if (!OPENAI_KEY || !OPENAI_BASE || !userPrompt.trim()) return null;
  try {
    const r = await fetch(OPENAI_BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + OPENAI_KEY },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.7,
        max_tokens: 2000,
        messages: [
          { role: 'user', content: 'Design an 8-bit pixel animal hackathon-contestant avatar for this description: "' + userPrompt + '". Output ONLY compact JSON {"species":"cat|capybara|goose|raccoon|shiba|hamster|bulldog","fur":"#RRGGBB","shirt":"#RRGGBB","accessory":"none|glasses|tie|hat|headphones|cap|laptop|coffee|clipboard|wrench|magnifier|backpack"} — pick the species AND a hand-held/wearable accessory that best match the description; no prose, no code fence.' },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    const msg = j?.choices?.[0]?.message || {};
    const txt: string = msg.content || msg.reasoning_content || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const spec = JSON.parse(m[0]);
    const out: { species?: string; fur?: string; shirt?: string; accessory?: string } = {};
    if (typeof spec.species === 'string' && SPECIES_OK.includes(spec.species)) out.species = spec.species;
    if (HEX(spec.fur)) out.fur = spec.fur;
    if (HEX(spec.shirt)) out.shirt = spec.shirt;
    if (typeof spec.accessory === 'string' && ACCS.includes(spec.accessory) && spec.accessory !== 'none') out.accessory = spec.accessory;
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export async function generateAppearance(seed: string, role: RoleId, userPrompt?: string): Promise<AppearanceResult> {
  const prompt = buildAvatarPrompt(role, userPrompt);
  const base = promptToCharSpec(userPrompt || '', seed);
  const ai = await aiCharSpec(userPrompt || '');
  if (ai) return { mode: 'ai', prompt, charSpec: { ...base, ...ai } }; // LLM 结果覆盖程序化缺省
  return { mode: 'code', prompt, charSpec: base };
}

export function appearanceTemplates() {
  return APPEARANCE_TEMPLATES;
}
