import type { EventCard } from './types.js';

// PRD 16.2 首发事件清单 (effect 键由引擎实现)
export const EVENT_DECK: EventCard[] = [
  { id: 'scope_change', nameKey: 'event.scope_change', intensity: 'high', weight: 8, windowPhases: ['sprint', 'incident'], exclusiveTags: ['scope'], durationTicks: 20, effect: 'scopeChange' },
  { id: 'prod_alert', nameKey: 'event.prod_alert', intensity: 'high', weight: 10, windowPhases: ['sprint', 'incident'], exclusiveTags: ['incident'], durationTicks: 40, effect: 'prodAlert' },
  { id: 'wifi_down', nameKey: 'event.wifi_down', intensity: 'medium', weight: 6, windowPhases: ['sprint', 'incident'], exclusiveTags: [], durationTicks: 40, effect: 'wifiDown' },
  { id: 'milk_tea', nameKey: 'event.milk_tea', intensity: 'medium', weight: 6, windowPhases: ['sprint'], exclusiveTags: [], durationTicks: 30, effect: 'milkTea' },
  { id: 'standup_meeting', nameKey: 'event.standup_meeting', intensity: 'medium', weight: 5, windowPhases: ['sprint'], exclusiveTags: ['meeting'], durationTicks: 30, effect: 'standupMeeting' },
  { id: 'boss_group', nameKey: 'event.boss_group', intensity: 'medium', weight: 6, windowPhases: ['sprint', 'incident'], exclusiveTags: [], durationTicks: 15, effect: 'bossGroup' },
  { id: 'hr_check', nameKey: 'event.hr_check', intensity: 'medium', weight: 4, windowPhases: ['sprint', 'incident'], exclusiveTags: [], durationTicks: 25, effect: 'hrCheck' },
  { id: 'db_readonly', nameKey: 'event.db_readonly', intensity: 'high', weight: 6, windowPhases: ['incident'], exclusiveTags: [], durationTicks: 40, effect: 'dbReadonly' },
  { id: 'coffee_broken', nameKey: 'event.coffee_broken', intensity: 'low', weight: 4, windowPhases: ['sprint', 'incident'], exclusiveTags: [], durationTicks: 50, effect: 'coffeeBroken' },
  { id: 'client_demo', nameKey: 'event.client_demo', intensity: 'high', weight: 5, windowPhases: ['incident'], exclusiveTags: [], durationTicks: 30, effect: 'clientDemo' },
  { id: 'at_all', nameKey: 'event.at_all', intensity: 'low', weight: 5, windowPhases: ['sprint', 'incident'], exclusiveTags: [], durationTicks: 10, effect: 'atAll' },
  { id: 'new_jira', nameKey: 'event.new_jira', intensity: 'low', weight: 6, windowPhases: ['sprint'], exclusiveTags: [], durationTicks: 10, effect: 'newJira' },
  { id: 'boss_phone', nameKey: 'event.boss_phone', intensity: 'low', weight: 6, windowPhases: ['sprint', 'incident'], exclusiveTags: [], durationTicks: 25, effect: 'bossPhone' },
  { id: 'security_audit', nameKey: 'event.security_audit', intensity: 'high', weight: 4, windowPhases: ['incident', 'freeze'], exclusiveTags: [], durationTicks: 30, effect: 'securityAudit' },
  { id: 'friday_6pm', nameKey: 'event.friday_6pm', intensity: 'high', weight: 5, windowPhases: ['incident'], exclusiveTags: [], durationTicks: 40, effect: 'friday6pm' },
  { id: 'core_leave', nameKey: 'event.core_leave', intensity: 'medium', weight: 4, windowPhases: ['sprint', 'incident'], exclusiveTags: [], durationTicks: 30, effect: 'coreLeave' },
  { id: 'revert_design', nameKey: 'event.revert_design', intensity: 'medium', weight: 4, windowPhases: ['sprint', 'incident'], exclusiveTags: [], durationTicks: 15, effect: 'revertDesign' },
  { id: 'autoscale', nameKey: 'event.autoscale', intensity: 'low', weight: 4, windowPhases: ['incident'], exclusiveTags: [], durationTicks: 20, effect: 'autoscale' },
  { id: 'group_photo', nameKey: 'event.group_photo', intensity: 'medium', weight: 3, windowPhases: ['sprint'], exclusiveTags: [], durationTicks: 12, effect: 'groupPhoto' },
  { id: 'merge_conflict', nameKey: 'event.merge_conflict', intensity: 'medium', weight: 5, windowPhases: ['sprint', 'incident'], exclusiveTags: [], durationTicks: 20, effect: 'mergeConflict' },
  { id: 'intern_rumor', nameKey: 'event.intern_rumor', intensity: 'medium', weight: 4, windowPhases: ['sprint', 'incident'], exclusiveTags: [], durationTicks: 15, effect: 'internRumor' },
  { id: 'elevator', nameKey: 'event.elevator', intensity: 'low', weight: 4, windowPhases: ['freeze'], exclusiveTags: [], durationTicks: 40, effect: 'elevator' },
  { id: 'finance_chase', nameKey: 'event.finance_chase', intensity: 'low', weight: 4, windowPhases: ['sprint', 'incident'], exclusiveTags: [], durationTicks: 20, effect: 'financeChase' },
];

export function eventDeckHashInput(): string {
  return EVENT_DECK.map((e) => `${e.id}:${e.weight}:${e.effect}`).join('|');
}
