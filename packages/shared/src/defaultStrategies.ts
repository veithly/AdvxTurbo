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

export const DEFAULT_STRATEGY = STRATEGY_BALANCED;

export const STRATEGY_LIBRARY: Record<string, { nameKey: string; code: string }> = {
  balanced: { nameKey: 'strategy.balanced', code: STRATEGY_BALANCED },
  firefighter: { nameKey: 'strategy.firefighter', code: STRATEGY_FIREFIGHTER },
  grinder: { nameKey: 'strategy.grinder', code: STRATEGY_GRINDER },
  politician: { nameKey: 'strategy.politician', code: STRATEGY_POLITICIAN },
};
