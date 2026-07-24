// PRD 17.3 秘密目标示例
export interface ObjectiveDef {
  type: string;
  nameKey: string;
  target: number;
  value: number; // 0-15
}

export const SECRET_OBJECTIVES: ObjectiveDef[] = [
  { type: 'complete_2_types', nameKey: 'obj.complete_2_types', target: 2, value: 10 },
  { type: 'fix_others_bug', nameKey: 'obj.fix_others_bug', target: 1, value: 12 },
  { type: 'energy_60_end', nameKey: 'obj.energy_60_end', target: 60, value: 8 },
  { type: 'help_two', nameKey: 'obj.help_two', target: 2, value: 10 },
  { type: 'no_forceassign_top3', nameKey: 'obj.no_forceassign_top3', target: 3, value: 13 },
  { type: 'lowest_blame_success', nameKey: 'obj.lowest_blame_success', target: 1, value: 15 },
  { type: 'last15_firefight', nameKey: 'obj.last15_firefight', target: 1, value: 14 },
  { type: 'strong_evidence_correct', nameKey: 'obj.strong_evidence_correct', target: 1, value: 12 },
  { type: 'three_types', nameKey: 'obj.three_types', target: 3, value: 12 },
  { type: 'top_contributor', nameKey: 'obj.top_contributor', target: 1, value: 13 },
  { type: 'pacifist', nameKey: 'obj.pacifist', target: 1, value: 11 },
  { type: 'never_caught', nameKey: 'obj.never_caught', target: 1, value: 12 },
  { type: 'be_the_shipper', nameKey: 'obj.be_the_shipper', target: 1, value: 10 },
];
