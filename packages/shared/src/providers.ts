// ============================================================================
// AI Agent 供应商 / 工具（用于排行榜展示玩家用什么 agent 打造策略）
// ============================================================================

export interface AgentProvider {
  id: string;
  name: string;
  short: string; // 徽标短代码
  color: string; // 品牌主色
  accent: string; // 辅助色 / 背景
  kind: 'tool' | 'model';
}

export const AGENT_PROVIDERS: AgentProvider[] = [
  { id: 'claude_code', name: 'Claude Code', short: 'CC', color: '#D97757', accent: '#2A1B12', kind: 'tool' },
  { id: 'codex', name: 'Codex', short: 'CX', color: '#10A37F', accent: '#0B1A16', kind: 'tool' },
  { id: 'qoder', name: 'Qoder', short: 'QD', color: '#7C6CF5', accent: '#1C1830', kind: 'tool' },
  { id: 'opencode', name: 'OpenCode', short: 'OC', color: '#4FB477', accent: '#0E1F16', kind: 'tool' },
  { id: 'cursor', name: 'Cursor', short: 'CU', color: '#E6E6E6', accent: '#141414', kind: 'tool' },
  { id: 'copilot', name: 'Copilot', short: 'CP', color: '#7DD36B', accent: '#12251A', kind: 'tool' },
  { id: 'gemini', name: 'Gemini', short: 'GM', color: '#4285F4', accent: '#101A2E', kind: 'model' },
  { id: 'gpt', name: 'GPT', short: 'GP', color: '#19C37D', accent: '#0B1A14', kind: 'model' },
  { id: 'claude', name: 'Claude', short: 'CL', color: '#D97757', accent: '#2A1B12', kind: 'model' },
  { id: 'deepseek', name: 'DeepSeek', short: 'DS', color: '#4D6BFE', accent: '#101635', kind: 'model' },
  { id: 'doubao', name: '豆包', short: 'DB', color: '#4E82FB', accent: '#0E1730', kind: 'model' },
  { id: 'custom', name: 'Custom', short: '··', color: '#8892A0', accent: '#1A1E24', kind: 'tool' },
];

export const DEFAULT_PROVIDER = 'claude_code';

// 供应商别名 —— agent 在提交策略时自报家门，可能写模型全名或厂商名，统一归一化到 provider id。
const PROVIDER_ALIASES: Record<string, string> = {
  anthropic: 'claude', 'claude-code': 'claude_code', claudecode: 'claude_code',
  openai: 'gpt', 'gpt-4': 'gpt', 'gpt-4o': 'gpt', 'gpt-5': 'gpt', chatgpt: 'gpt', 'o1': 'gpt', 'o3': 'gpt',
  google: 'gemini', bard: 'gemini',
  'github-copilot': 'copilot', githubcopilot: 'copilot',
  bytedance: 'doubao', volcengine: 'doubao', 豆包: 'doubao', doubao: 'doubao', seed: 'doubao',
  '深度求索': 'deepseek',
};

export function getProvider(idOrName?: string): AgentProvider {
  if (!idOrName) return AGENT_PROVIDERS.find((p) => p.id === DEFAULT_PROVIDER)!;
  const k = String(idOrName).trim().toLowerCase();
  const resolved = PROVIDER_ALIASES[k] || k;
  return (
    AGENT_PROVIDERS.find((p) => p.id === resolved) ||
    AGENT_PROVIDERS.find((p) => p.name.toLowerCase() === resolved) ||
    AGENT_PROVIDERS.find((p) => p.id === 'custom')!
  );
}

/** 把 agent 自报的 provider 字符串归一化成一个合法的 provider id（用于写入 worker.agent_tool）。 */
export function normalizeProviderId(idOrName?: string): string {
  return getProvider(idOrName).id;
}
