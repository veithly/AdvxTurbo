import { Rng } from './rng.js';

// ============================================================================
// 每局随机目标：从目标池中按 matchId 确定性抽取 3-4 个不同目标（含随机阈值）。
// 全部可由回放帧 + 事件在前端实时判定，无需引擎改动，reload 结果稳定。
// ============================================================================

export interface MatchGoal {
  key: string;
  labelKey: string;
  n?: number; // 阈值（随机选取）
}

const POOL: Array<{ key: string; labelKey: string; thresholds?: number[] }> = [
  { key: 'progress', labelKey: 'goal.progress', thresholds: [85, 95, 100] },
  { key: 'stability', labelKey: 'goal.stability', thresholds: [45, 55, 65] },
  { key: 'shipped', labelKey: 'goal.shipped' },
  { key: 'noP0', labelKey: 'goal.noP0' },
  { key: 'fixes', labelKey: 'goal.fixes', thresholds: [2, 3, 4] },
  { key: 'noCaught', labelKey: 'goal.noCaught' },
  { key: 'noDump', labelKey: 'goal.noDump' },
  { key: 'lowBugs', labelKey: 'goal.lowBugs', thresholds: [1, 2] },
  { key: 'calmBlame', labelKey: 'goal.calmBlame', thresholds: [35, 45, 55] },
];

export function pickMatchGoals(seed: string, n = 4): MatchGoal[] {
  const rng = new Rng('goals:' + (seed || 'x'));
  const pool = POOL.map((g) => g);
  // Fisher-Yates 洗牌（确定性）
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, Math.min(n, pool.length)).map((g) => ({
    key: g.key,
    labelKey: g.labelKey,
    n: g.thresholds ? g.thresholds[rng.int(0, g.thresholds.length - 1)] : undefined,
  }));
}
