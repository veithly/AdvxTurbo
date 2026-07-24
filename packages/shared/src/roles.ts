import type { Role, RoleId } from './types.js';

// PRD 14.2 首发六职业 (MVP: engineer/pm/qa/sre; designer/intern 6 人模式)
export const ROLES: Record<RoleId, Role> = {
  engineer: {
    id: 'engineer',
    nameKey: 'role.engineer',
    emoji: '🐱',
    asset: 'characters/01_orange_cat_programmer.png',
    skill: { type: 'hotfix', nameKey: 'skill.hotfix', cooldownTicks: 150 },
    passiveKey: 'passive.engineer',
    personalityKeys: ['tag.firefighter', 'tag.grinder', 'tag.lastsecond'],
    mvp: true,
  },
  pm: {
    id: 'pm',
    nameKey: 'role.pm',
    emoji: '🦫',
    asset: 'characters/02_capybara_product_manager.png',
    skill: { type: 'scopeShift', nameKey: 'skill.scopeShift', cooldownTicks: 175 },
    passiveKey: 'passive.pm',
    personalityKeys: ['tag.controller', 'tag.scopecreep', 'tag.gentleblame'],
    mvp: true,
  },
  qa: {
    id: 'qa',
    nameKey: 'role.qa',
    emoji: '🦢',
    asset: 'characters/03_goose_qa_tester.png',
    skill: { type: 'reproduce', nameKey: 'skill.reproduce', cooldownTicks: 140 },
    passiveKey: 'passive.qa',
    personalityKeys: ['tag.justice', 'tag.commitpolice'],
    mvp: true,
  },
  sre: {
    id: 'sre',
    nameKey: 'role.sre',
    emoji: '🦝',
    asset: 'characters/04_raccoon_devops.png',
    skill: { type: 'emergencyRollback', nameKey: 'skill.emergencyRollback', cooldownTicks: 200 },
    passiveKey: 'passive.sre',
    personalityKeys: ['tag.stable', 'tag.firefighter', 'tag.rollbackworld'],
    mvp: true,
  },
  designer: {
    id: 'designer',
    nameKey: 'role.designer',
    emoji: '🐕',
    asset: 'characters/05_shiba_designer.png',
    skill: { type: 'pptShield', nameKey: 'skill.pptShield', cooldownTicks: 160 },
    passiveKey: 'passive.designer',
    personalityKeys: ['tag.ppt', 'tag.decent', 'tag.stall'],
    mvp: false,
  },
  intern: {
    id: 'intern',
    nameKey: 'role.intern',
    emoji: '🐹',
    asset: 'characters/06_hamster_intern.png',
    skill: { type: 'internInvisibility', nameKey: 'skill.internInvisibility', cooldownTicks: 175 },
    passiveKey: 'passive.intern',
    personalityKeys: ['tag.invisible', 'tag.survive', 'tag.accidentalmvp'],
    mvp: false,
  },
};

export const MVP_ROLES: RoleId[] = ['engineer', 'pm', 'qa', 'sre'];
export const ALL_ROLES: RoleId[] = ['engineer', 'pm', 'qa', 'sre', 'designer', 'intern'];

export const BOSS_ASSET = 'characters/07_bulldog_boss.png';

// PRD 18.4 段位命名
export const RANK_TIERS = [
  { key: 'rank.intern', min: 0 },
  { key: 'rank.staff', min: 800 },
  { key: 'rank.senior', min: 1200 },
  { key: 'rank.scapegoat', min: 1500 },
  { key: 'rank.director', min: 1900 },
  { key: 'rank.vp', min: 2200 },
  { key: 'rank.partner', min: 2500 },
  { key: 'rank.bossRelative', min: 2800 },
];

export function tierForRating(rating: number): string {
  let key = RANK_TIERS[0].key;
  for (const t of RANK_TIERS) if (rating >= t.min) key = t.key;
  return key;
}
