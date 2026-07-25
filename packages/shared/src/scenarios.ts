// ============================================================================
// 游戏模式 / 关卡：不同的输赢条件，让玩法更多元（不只有背锅）
// winCondition 由引擎 audit.ts 实现；此处为纯配置 + i18n 键。
// ============================================================================

export interface GameMode {
  id: string;
  nameKey: string;
  descKey: string;
  emoji: string;
  players: number;
  pve?: boolean;
  /** 胜者判定方式，引擎按此 key 计算冠军与名次 */
  winCondition: 'score' | 'contribution' | 'guardian' | 'stealth' | 'intern' | 'coop';
  /** 冠军专属标题 */
  winnerTitleKey: string;
  /** 覆盖团队成败条件 */
  successOverride?: {
    minimumStability?: number;
    forbidExplosion?: boolean;
    requireShipAction?: boolean;
  };
  /** PvE 或欢乐模式不施加背锅惩罚 */
  noScapegoatPenalty?: boolean;
  /** 提升出现概率的事件（更贴合该关卡的梗） */
  eventBias?: string[];
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'ranked',
    nameKey: 'mode.ranked',
    descKey: 'mode.ranked.desc',
    emoji: '⚡',
    players: 4,
    winCondition: 'score',
    winnerTitleKey: 'title.lastSecondShip',
  },
  {
    id: 'friday_raid',
    nameKey: 'mode.friday_raid',
    descKey: 'mode.friday_raid.desc',
    emoji: '🎉',
    players: 4,
    pve: true,
    winCondition: 'coop',
    winnerTitleKey: 'title.fridayShipped',
    successOverride: { minimumStability: 35 },
    noScapegoatPenalty: true,
    eventBias: ['milk_tea', 'autoscale', 'group_photo'],
  },
];

export function getMode(id: string): GameMode {
  return GAME_MODES.find((m) => m.id === id) || GAME_MODES[0];
}
