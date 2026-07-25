// 默认策略档案 — 玩家/种子用户初始的沙盒 onIdle 代码 (PRD 20.7)
// 运行时可用: me, coworkers, office, actions, game.random()

export const STRATEGY_BALANCED = `// v1.0 均衡型：稳住上线，救火，达标即发布
function onIdle(me, coworkers, office) {
  // 老板盯着且在摸鱼 -> 装作在工作
  if (office.boss.lookingAtMe && me.worker.currentAction && me.worker.currentAction.label === 'slacking') {
    return actions.fakeWork();
  }
  // 处理严重 Bug
  var p0 = office.bugs.find(function (b) { return b.visible && b.severity >= 3 && b.status !== 'resolved'; });
  if (p0) {
    if (me.skill && me.skill.type === 'hotfix' && me.skill.ready) return actions.useSkill({ bugId: p0.id });
    if (me.worker.energy >= 25) return actions.fix({ bugId: p0.id, debugTag: 'sev3-threshold' });
  }
  // 精力过低 -> 咖啡
  if (me.worker.energy < 25) return actions.coffee();
  // 达标发布
  if (office.publishReady && office.timeLeftTicks <= 90) return actions.ship();
  // 领取影响最高的开放任务
  var task = office.tasks
    .filter(function (t) { return (t.status === 'open' || t.status === 'claimed') && !t.blocked; })
    .sort(function (a, b) { return b.impactScore - a.impactScore; })[0];
  if (task) return actions.work({ taskId: task.id });
  return actions.moveTo({ zone: 'qa' });
}`;

export const STRATEGY_FIREFIGHTER = `// v1.0 救火型：稳定性优先，Bug 一律先处理
function onIdle(me, coworkers, office) {
  if (office.boss.lookingAtMe && me.worker.currentAction && me.worker.currentAction.label === 'slacking') {
    return actions.fakeWork();
  }
  var bug = office.bugs
    .filter(function (b) { return b.visible && b.status !== 'resolved'; })
    .sort(function (a, b) { return b.severity - a.severity; })[0];
  if (bug) {
    if (me.skill && me.skill.ready && (me.skill.type === 'emergencyRollback') && office.stability < 45) {
      return actions.useSkill({});
    }
    if (me.skill && me.skill.ready && me.skill.type === 'hotfix') return actions.useSkill({ bugId: bug.id });
    if (me.worker.energy >= 20) return actions.fix({ bugId: bug.id, debugTag: 'firefight' });
  }
  if (office.stability < 60) {
    var opsTask = office.tasks.find(function (t) { return t.type === 'ops' && (t.status === 'open') && !t.blocked; });
    if (opsTask) return actions.work({ taskId: opsTask.id });
  }
  if (me.worker.energy < 30) return actions.coffee();
  if (office.publishReady) return actions.ship();
  var task = office.tasks.filter(function (t) { return t.status === 'open' && !t.blocked; })
    .sort(function (a, b) { return b.impactScore - a.impactScore; })[0];
  if (task) return actions.work({ taskId: task.id });
  return actions.moveTo({ zone: 'serverRoom' });
}`;

export const STRATEGY_GRINDER = `// v1.0 卷王型：最大化贡献，冲刺任务，很少救火
function onIdle(me, coworkers, office) {
  if (office.boss.lookingAtMe && me.worker.currentAction && me.worker.currentAction.label === 'slacking') {
    return actions.fakeWork();
  }
  // 仅在极端严重时救火
  var crit = office.bugs.find(function (b) { return b.visible && b.severity >= 5 && b.status !== 'resolved'; });
  if (crit && me.worker.energy >= 30) return actions.fix({ bugId: crit.id });
  if (me.worker.energy < 18) return actions.coffee();
  if (office.publishReady && office.timeLeftTicks <= 60) return actions.ship();
  var task = office.tasks
    .filter(function (t) { return t.status === 'open' && !t.blocked; })
    .sort(function (a, b) { return b.impactScore - a.impactScore; })[0];
  if (task) {
    actions.claimTask({ taskId: task.id });
    return actions.work({ taskId: task.id });
  }
  return actions.moveTo({ zone: 'devDesk' });
}`;

export const STRATEGY_POLITICIAN = `// v1.0 甩锅型：证据+社交，保住自己
function onIdle(me, coworkers, office) {
  if (office.boss.lookingAtMe) return actions.fakeWork();
  var bug = office.bugs.find(function (b) { return b.visible && b.severity >= 4 && b.status !== 'resolved'; });
  // 收集证据（review 会生成证据）
  if (bug && me.worker.zone === 'qa') return actions.review({ bugId: bug.id });
  if (bug && me.worker.energy >= 25 && office.timeLeftTicks < 120) return actions.fix({ bugId: bug.id });
  if (me.worker.stress > 60) return actions.moveTo({ zone: 'restroom' });
  if (me.worker.energy < 30) return actions.coffee();
  if (office.publishReady) return actions.ship();
  var task = office.tasks.filter(function (t) { return t.status === 'open' && !t.blocked && t.type !== 'code'; })
    .sort(function (a, b) { return b.impactScore - a.impactScore; })[0];
  if (task) return actions.work({ taskId: task.id });
  return actions.moveTo({ zone: 'qa' });
}`;

export const STRATEGY_HOTSPOT = `// v1.0 节奏大师：端点偷热点 build ⇄ 回精力 ⇄ 攒灵感，躲工作人员
function onIdle(me, coworkers, office) {
  var w = me.worker, v = office.venue;
  // 1) 保命第一：工作人员距离≤2 且自己开着热点 → 撤到安全区（离开端点热点自动关）
  var danger = office.staff.some(function (s) { return s.distanceToMe <= 2; });
  if (danger && w.hotspotOn) return actions.moveTo({ zone: v.restroom, debugTag: 'flee-staff' });
  // 2) 达标就提交：自动走到提交台（release）完成 ship
  if (office.publishReady && office.timeLeftTicks <= 120) return actions.ship({ debugTag: 'submit' });
  // 3) 精力循环：太累去酒店排队补满；累去蓝盒子小睡
  if (w.energy < 22 && w.hotelCooldownTicks === 0) return actions.moveTo({ zone: v.hotel, debugTag: 'hotel-refill' });
  if (w.energy < 40) return actions.moveTo({ zone: v.rest, debugTag: 'blue-box-nap' });
  // 4) 灵感不够：展台白嫖 Qoder(冷却好了就领) / 否则 workshop⇄食堂
  if (w.inspiration < 45) {
    if (w.sponsorCooldownTicks === 0) return actions.moveTo({ zone: v.sponsor, debugTag: 'sponsor-swag' });
    return actions.moveTo({ zone: (office.tick % 100) < 50 ? v.workshop : v.canteen, debugTag: 'inspiration' });
  }
  // 5) 挑热点最稀的端点去 build（站进端点且精力>8 会自动开热点）
  var best = v.endpoints[0], heat = 1e9;
  for (var i = 0; i < v.endpoints.length; i++) {
    var h = office.endpointHeat[v.endpoints[i]] || 0;
    if (h < heat) { heat = h; best = v.endpoints[i]; }
  }
  if (w.zone !== best) return actions.moveTo({ zone: best, debugTag: 'quiet-endpoint' });
  return actions.idle({ debugTag: 'building' });
}`;

export const DEFAULT_STRATEGY = STRATEGY_HOTSPOT;

export const STRATEGY_LIBRARY: Record<string, { nameKey: string; code: string }> = {
  hotspot: { nameKey: 'strategy.hotspot', code: STRATEGY_HOTSPOT },
  balanced: { nameKey: 'strategy.balanced', code: STRATEGY_BALANCED },
  firefighter: { nameKey: 'strategy.firefighter', code: STRATEGY_FIREFIGHTER },
  grinder: { nameKey: 'strategy.grinder', code: STRATEGY_GRINDER },
  politician: { nameKey: 'strategy.politician', code: STRATEGY_POLITICIAN },
};
