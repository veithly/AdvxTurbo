import type { TaskType, Severity } from './types.js';

export interface TaskTemplate {
  type: TaskType;
  titleKey: string;
  complexity: Severity;
  risk: 0 | 1 | 2 | 3 | 4 | 5;
  progressReward: number;
  stabilityImpact: number;
  contributionReward: number;
  energyCost: number;
  requiredZone: string;
  hiddenBugChanceBps: number;
}

// PRD 10.2 任务类型 — 引擎按此模板确定性生成任务图
export const TASK_TEMPLATES: TaskTemplate[] = [
  { type: 'product', titleKey: 'task.spec', complexity: 2, risk: 1, progressReward: 9, stabilityImpact: 0, contributionReward: 10, energyCost: 8, requiredZone: 'meeting', hiddenBugChanceBps: 200 },
  { type: 'code', titleKey: 'task.login', complexity: 3, risk: 3, progressReward: 16, stabilityImpact: -3, contributionReward: 18, energyCost: 16, requiredZone: 'devDesk', hiddenBugChanceBps: 1400 },
  { type: 'code', titleKey: 'task.payment', complexity: 4, risk: 4, progressReward: 20, stabilityImpact: -4, contributionReward: 22, energyCost: 20, requiredZone: 'devDesk', hiddenBugChanceBps: 2000 },
  { type: 'code', titleKey: 'task.api', complexity: 3, risk: 3, progressReward: 15, stabilityImpact: -3, contributionReward: 16, energyCost: 15, requiredZone: 'devDesk', hiddenBugChanceBps: 1300 },
  { type: 'design', titleKey: 'task.ui', complexity: 2, risk: 1, progressReward: 12, stabilityImpact: 0, contributionReward: 13, energyCost: 12, requiredZone: 'designDesk', hiddenBugChanceBps: 400 },
  { type: 'design', titleKey: 'task.motion', complexity: 2, risk: 1, progressReward: 10, stabilityImpact: 0, contributionReward: 11, energyCost: 11, requiredZone: 'designDesk', hiddenBugChanceBps: 300 },
  { type: 'qa', titleKey: 'task.regression', complexity: 3, risk: 1, progressReward: 9, stabilityImpact: 14, contributionReward: 14, energyCost: 14, requiredZone: 'qa', hiddenBugChanceBps: 100 },
  { type: 'qa', titleKey: 'task.smoke', complexity: 2, risk: 0, progressReward: 7, stabilityImpact: 10, contributionReward: 10, energyCost: 10, requiredZone: 'qa', hiddenBugChanceBps: 100 },
  { type: 'ops', titleKey: 'task.deploy', complexity: 3, risk: 3, progressReward: 14, stabilityImpact: 8, contributionReward: 16, energyCost: 16, requiredZone: 'serverRoom', hiddenBugChanceBps: 600 },
  { type: 'ops', titleKey: 'task.monitor', complexity: 2, risk: 1, progressReward: 7, stabilityImpact: 14, contributionReward: 12, energyCost: 10, requiredZone: 'serverRoom', hiddenBugChanceBps: 100 },
  { type: 'docs', titleKey: 'task.release_notes', complexity: 1, risk: 0, progressReward: 6, stabilityImpact: 3, contributionReward: 8, energyCost: 6, requiredZone: 'hr', hiddenBugChanceBps: 0 },
  { type: 'code', titleKey: 'task.integration', complexity: 4, risk: 3, progressReward: 18, stabilityImpact: -2, contributionReward: 20, energyCost: 18, requiredZone: 'devDesk', hiddenBugChanceBps: 1100 },
];

// 依赖：payment/api 依赖 spec；integration 依赖 login+api；deploy 依赖 integration；release_notes 依赖 deploy
export const TASK_DEPENDENCIES: Record<string, string[]> = {
  'task.payment': ['task.spec'],
  'task.api': ['task.spec'],
  'task.integration': ['task.login', 'task.api'],
  'task.deploy': ['task.integration'],
  'task.release_notes': ['task.deploy'],
};
