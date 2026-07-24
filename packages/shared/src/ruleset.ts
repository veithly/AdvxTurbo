import type { Ruleset } from './types.js';

// PRD 65 示例 Ruleset 配置 (activeTicks 450 = 90s @ 5Hz, auditTicks 50 = 10s)
export const DEFAULT_RULESET: Ruleset = {
  schemaVersion: '1.0',
  rulesetId: 'ranked-2026-07-1',
  mode: 'ranked',
  players: 4,
  tickMs: 200,
  activeTicks: 450,
  auditTicks: 50,
  success: {
    requiredProgress: 100,
    minimumStability: 40,
    requireShipAction: true,
    allowUnresolvedP0: false,
  },
  resources: {
    initialStability: 80,
    initialEnergy: 80,
    initialStress: 10,
    initialReputation: 50,
    initialBlame: 5,
  },
  sandbox: {
    sourceBytesMax: 65536,
    heapBytesMax: 16777216,
    softDecisionMs: 5,
    hardDecisionMs: 10,
    hardTimeoutsBeforeSafeMode: 3,
  },
  eventDeckHash: '0x0',
  mapHash: '0x0',
  scoreFormulaVersion: 'score-1.0',
  responsibilityFormulaVersion: 'responsibility-1.0',
  ratingFormulaVersion: 'openskill-1.0',
};

export const ENGINE_VERSION = 'engine-0.9.3';
export const RUNTIME_API_VERSION = '1.0';
export const RULESET_VERSION = '2026.07.1';

// 阶段边界 (tick)
export function phaseAt(tick: number, r: Ruleset): import('./types.js').MatchPhase {
  if (tick < 40) return 'standup'; // 0-8s
  if (tick < 275) return 'sprint'; // 8-55s
  if (tick < 390) return 'incident'; // 55-78s
  if (tick < r.activeTicks) return 'freeze'; // 78-90s
  return 'audit';
}
