# 《AdventureX 抓热点》AI 策略攻略 SKILL
> **怎么用**：把这一整份文件贴给你的编程 AI（Claude Code / Codex / Qoder…），它就能替你写出一份能上榜的《抓热点》策略代码。
> 你也可以只把最后一节「📋 一键任务指令」复制给 AI。

---

## 0. 你在写什么
你在写一个**纯函数策略**，引擎每个 tick（每 0.2 秒）调用一次，传入当前观测 `ctx`，你返回**一个动作** `action`。
- 你可以扮演两种阵营之一，**接口不同**：
  - 🧑‍💻 **选手 Hacker**：偷开热点、在工位 build 项目、躲网管、抢道具、冲奖。
  - 🦺 **工作人员 Staff**：巡逻、探测热点信号、抓开热点的人、封网维稳。
- 语言：**JavaScript**（沙盒为 quickjs 风格）。只需导出一个函数。

```js
// 选手
function decide(ctx) { /* return an action */ }
// 或工作人员
function decideStaff(ctx) { /* return an action */ }
module.exports = { decide };   // 按你的阵营导出对应函数
```

---

## 1. 30 秒游戏规则（必读）
- 现场官方网络很烂 → **默认几乎 build 不动**。
- 选手 **开热点(hotspot ON)** 才有带宽；**但只有「开着热点」且「站在工位端点」时项目进度 `buildProgress` 才增长**。
- 开热点会持续发出 **信号 hotspotSignal**，网管靠信号热力图定位你、走到你身边 `inspect`；**若 inspect 命中你正开着热点 → 被抓**：进度回退、记违规、heat 清零、短暂冷却。
- 所以核心是**开/关热点的节奏博弈**：感知网管靠近就**关热点 + 伪装**（网管扑空还浪费一手）。
- `buildProgress` 满 100% → 进入**属性分配**（创新/完成度/技术/商业/演示五维）→ 评审按本局评委偏好加权算 `projectScore` → 决定名次与 rating。
- 五阶段：kickoff（开幕）→ build（开发，主战场）→ sweep（突击巡查，抓捕高发）→ freeze（封板提交，抢 Demo 大屏）→ judging（评审）。

---

## 2. 硬约束（违反会被判负/进 safe mode）
1. **必须确定性**：禁止 `Math.random()`、`Date.now()`、任何 IO/网络。需要随机就用 `ctx.rngHint`（引擎给的确定性随机数）。
2. **单动作**：每次调用只返回 **1 个动作对象**。
3. **预算**：源码 ≤ 32KB、堆 ≤ 数 MB、单次决策软上限 ~5ms/硬上限 ~15ms；超时多次 → safe mode（被动挨打）。
4. **纯函数**：不要依赖外部可变全局；同样的 `ctx` 必须得到同样的 `action`（保证回放可复现）。
5. 动作不合法（如没到工位就 `build`）会返回错误码并浪费该 tick。

---

## 3. 选手 API（Hacker）

### ctx 字段
```ts
ctx = {
  tick: number, phase: 'kickoff'|'build'|'sweep'|'freeze'|'judging', timeLeftTicks: number,
  me: {
    pos:[x,y], zone: string, battery:0-100, focus:0-100, heat:0-100,
    buildProgress:0-100, hotspotOn: boolean, atWorkstation: boolean,
    skillReady: boolean, cooldownTicks: number, carrying?: 'poop'|'badge'|null,
    inj: number,                 // 已持有的 INJ（娱乐赛）
  },
  staff: [{ pos?:[x,y], facing?:[dx,dy], distance?: number, lookingAtMe?: boolean, jammingZone?: string }],
  workstations: [{ zone, spot:[x,y], occupied: boolean }],
  items: [{ kind:'qoder'|'mattress'|'inj'|'poop'|'redbull'|'badge'|'demoScreen', pos:[x,y] }],
  teammates: [{ id, zone, buildProgress }],
  judgeHint?: { dimension: string, weight: number },   // 评委偏好线索（若拿到纸条）
  rngHint: number,             // 0..1 确定性随机
};
```

### 可用动作（返回其一）
```ts
{ type:'moveTo', zone }              // 寻路到某区域
{ type:'toggleHotspot', on:boolean } // 开/关热点
{ type:'build' }                     // 需 hotspotOn && atWorkstation
{ type:'useSkill' }                  // 触发本职业主动技能（需 skillReady）
{ type:'useItem', kind }             // qoder/redbull/badge/mattress...
{ type:'rest' }                      // 在蓝床垫回电量/精力+隐信号（不涨进度）
{ type:'disguise' }                  // 假装工作/合盖，降低 heat、被 inspect 更可能扑空
{ type:'throwPoop', pos }            // 把💩丢向某格，招网管去嫁祸对手
{ type:'goClaimAirdrop' }            // 走向 INJ 空投点（真实领取是玩家 UI 按钮，策略只负责靠近）
{ type:'allocateAttr', points:{innovation,completeness,techDepth,biz,demoWow} } // 进度满后分配
{ type:'submitDemo' }                // freeze 阶段提交
{ type:'idle' }
```

### 选手决策要点
- **读朝向**：`staff.lookingAtMe && distance<4` → 立刻 `toggleHotspot(false)` 再 `disguise`。
- **产出窗口**：网管远/背对 + 在工位 → `toggleHotspot(true)` 然后连续 `build`。
- **抢 Qoder**：附近有 `qoder` 就 `useItem` 冲刺（build×2~3）。
- **别在厕所空开热点**：只暴露不涨进度。
- **技能择时**：猫的极速冲刺配 Qoder；鹅的信号伪装用在网管靠近时；浣熊私接网线可在安全角落造工位。
- **属性分配看 `judgeHint`**：本局重创新就多点 innovation。
- **娱乐赛**：顺路 `goClaimAirdrop` 领真币，但别为领币把命送了。

---

## 4. 工作人员 API（Staff）

### ctx 字段
```ts
ctx = {
  tick, phase, timeLeftTicks,
  me: { pos, zone, skillReady, cooldownTicks },
  signalMap: [{ zone, strength:0-100, bearing:[dx,dy] }],  // 热点信号热力图（scanSignal 后更准）
  suspects: [{ id, heatBand:'low'|'mid'|'high', lastSeenZone, adjacent: boolean, hotspotLikely: boolean }],
  peers: [{ id, pos, zone }],       // 其他工作人员（协同分区）
  bandwidth: number,               // 现场网络健康
  rngHint: number,
};
```

### 可用动作
```ts
{ type:'patrolTo', zone }
{ type:'scanSignal' }                 // 提升热力图精度/范围（技能，带冷却）
{ type:'rush', workerId }             // 冲向某可疑选手
{ type:'inspect', workerId }          // 相邻时判定：正开热点则抓捕
{ type:'jamNetwork', zone }           // 封网：该区暂时开热点也不涨进度
{ type:'stakeout', zone }             // 蹲点埋伏，隐藏自身，该区开热点必被发现
{ type:'broadcast' }                  // 广播查房：全场 heat 短时上升
{ type:'idle' }
```

### 工作人员决策要点
- 锁 `signalMap` 里 `strength` 最高的区 → `rush` 该区 `hotspotLikely` 的 suspect。
- 相邻可疑者 → `inspect`（命中才抓，别对没开热点的人浪费手）。
- `sweep` 阶段多用 `jamNetwork`/`broadcast` 压制产出；`stakeout` 蹲工位区伏击。
- 和 `peers` 分区，别扎堆。

---

## 5. 角色主动技能（`useSkill` 触发，各带冷却）
| 阵营/职业 | 技能 | 效果 |
|---|---|---|
| 选手·猫 全栈 | 极速冲刺 | 8s 内 build ×2 |
| 选手·水豚 产品 | 假 Demo | freeze 演示分暴涨 |
| 选手·鹅 测试 | 信号伪装 | 6s 信号-50% |
| 选手·浣熊 运维 | 私接网线 | 当前格临时变工位端点 6s |
| 选手·柴犬 设计 | PPT 护体 | 下次被 inspect 30% 免抓 |
| 选手·仓鼠 实习 | 人群隐身 | 5s 不可被锁定 |
| 工作人员 | scanSignal / jamNetwork / stakeout / broadcast | 见上 §4 |

---

## 6. 评分 & 涨分（你优化的目标）
- **选手**：`projectScore = Σ(属性 × 评委权重) − 违规×v − 被抓×c + Demo加成`；名次高 → rating 涨（绿+），被抓多/零产出 → 掉分。
- **工作人员**：抓捕数 + 压制违规带宽 + 维护网络健康 → 金牌网管榜 rating。
- **连胜/冠军👑/隐藏目标**（最速通关/零违规/黑红出圈）会加额外奖励与话题。
- 一句话：**选手=在不被抓的前提下最大化「进工位开热点 build」的有效时长，并把属性点押在评委偏好上**；**网管=用信号最短路径抓到最多正在开热点的人**。

---

## 7. 可直接改的模板策略

### 7.1 选手（稳健苟分基线）
```js
function decide(ctx) {
  const me = ctx.me, staff = ctx.staff || [];
  const danger = staff.some(s => s.lookingAtMe && (s.distance ?? 99) < 4);

  // 1) 被盯上：关热点 + 伪装
  if (me.hotspotOn && danger) return { type: 'toggleHotspot', on: false };
  if (danger) return { type: 'disguise' };

  // 2) 有 Qoder 就抢
  const qoder = nearest(ctx.items, 'qoder', me.pos);
  if (qoder && dist(qoder.pos, me.pos) <= 2) return { type: 'useItem', kind: 'qoder' };

  // 3) 电量低去床垫
  if (me.battery < 20) { const bed = nearest(ctx.items, 'mattress', me.pos); if (bed) return me.zone === zoneOf(bed) ? { type:'rest' } : { type:'moveTo', zone: zoneOf(bed) }; }

  // 4) 进度满：按评委偏好分配 + 提交
  if (me.buildProgress >= 100) {
    if (ctx.phase !== 'freeze') return { type:'idle' };
    const w = ctx.judgeHint?.dimension || 'completeness';
    const pts = { innovation:1, completeness:1, techDepth:1, biz:1, demoWow:1 }; pts[w] += 5;
    return { type: 'allocateAttr', points: pts };
  }

  // 5) 不在工位就去最近的空工位
  if (!me.atWorkstation) { const ws = nearestFree(ctx.workstations); if (ws) return { type:'moveTo', zone: ws.zone }; }

  // 6) 在工位：安全就开热点狂 build，技能就绪配合冲刺
  if (!me.hotspotOn) return { type: 'toggleHotspot', on: true };
  if (me.skillReady) return { type: 'useSkill' };
  return { type: 'build' };
}

function dist(a,b){ return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]); }
function nearest(items, kind, p){ return (items||[]).filter(i=>i.kind===kind).sort((a,b)=>dist(a.pos,p)-dist(b.pos,p))[0]; }
function nearestFree(ws){ return (ws||[]).filter(w=>!w.occupied)[0]; }
function zoneOf(item){ return item.zone; } // 若道具带 zone
module.exports = { decide };
```

### 7.2 工作人员（信号最短路径抓捕基线）
```js
function decideStaff(ctx) {
  const hot = (ctx.signalMap||[]).slice().sort((a,b)=>b.strength-a.strength)[0];
  const adj = (ctx.suspects||[]).find(s => s.adjacent && s.hotspotLikely);
  if (adj) return { type: 'inspect', workerId: adj.id };

  const target = (ctx.suspects||[]).filter(s => s.heatBand !== 'low')
      .sort((a,b)=> band(b.heatBand)-band(a.heatBand))[0];
  if (target) return { type: 'rush', workerId: target.id };

  if (ctx.phase === 'sweep' && hot) return { type: 'jamNetwork', zone: hot.zone };
  if (ctx.me.skillReady && hot && hot.strength > 60) return { type: 'scanSignal' };
  return { type: 'patrolTo', zone: hot ? hot.zone : 'stageA' };
}
function band(b){ return b==='high'?2 : b==='mid'?1 : 0; }
module.exports = { decide: decideStaff };
```

---

## 8. 常见坑
- 用了 `Math.random()/Date.now()` → 破坏确定性，判负。用 `ctx.rngHint`。
- 一次返回多个动作 / 返回 undefined → 无效。永远返回一个合法动作对象（兜底 `{type:'idle'}`）。
- 一直开着热点不看网管 → 必被抓。**开热点=倒计时**，学会主动关。
- 在厕所/走廊开热点却指望涨进度 → 不涨。回工位。
- 进度满了不分配属性/不提交 → projectScore 很低。记得 freeze 阶段 `allocateAttr` + `submitDemo`。

---

## 9. 📋 一键任务指令（把这段直接发给你的 AI）
```
你是我的《AdventureX 抓热点》策略工程师。请阅读我贴的这份 SKILL，为我写一份 JavaScript 策略：
- 我扮演【选手 / 工作人员】（二选一，默认选手）。
- 目标：选手→在不被网管抓到的前提下最大化「在工位开热点 build」的有效时长，进度满后按 ctx.judgeHint 分配属性并提交；工作人员→用信号热力图最短路径抓到最多正在开热点的人。
- 严格遵守硬约束：确定性（只用 ctx.rngHint，禁 Math.random/Date）、每 tick 返回一个动作对象、源码<32KB、纯函数、任何分支都要有合法兜底 {type:'idle'}。
- 用 §3/§4 的 ctx 字段与动作类型；参考 §7 模板但要更聪明：加入「读网管朝向提前关热点」「Qoder/技能连招」「电量管理」「评委偏好分配」等启发式。
- 输出完整可运行的单文件 module.exports = { decide }，并在关键分支写注释解释意图。
先问我：我扮演哪个阵营、偏好激进冲分还是稳健苟分？然后再给代码。
```
