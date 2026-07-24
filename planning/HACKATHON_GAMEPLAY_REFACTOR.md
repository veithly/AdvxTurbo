# 《AdventureX 抓热点》玩法重构报告
> 从《谁来背锅 / Blame Game》→ 黑客松现场非对称对抗。**本报告聚焦玩法**；工程映射见末尾。
> 一句话：**官方网络烂，选手只能偷开热点在工位卷项目冲大奖；工作人员靠信号探测抓开热点的人。** 猫鼠博弈 × vibe coding × 现场梗。

---

## 1. 为什么这个玩法成立（设计支点）

三个"天然矛盾"撑起全部乐趣，缺一不可：

1. **想 build 就必须开热点** —— 但开热点=暴露。收益与风险绑死在同一个动作上。
2. **想涨进度就必须待在工位** —— 但工位是固定、可被蹲守的点位。移动自由 vs 产出绑定。
3. **两个阵营目标对立且都要"读心"** —— 选手读网管的巡逻/朝向，网管读信号热力图。双向信息战。

对比原《背锅》：老板巡逻+摸鱼是"单向躲猫猫"，缺少玩家侧的**主动收益动作**制造张力。本设计把"摸鱼躲老板"升级成"**为了赢必须冒险**"，这才有竞争感与刷榜动力。

---

## 2. 玩法总览

- **场景**：AdventureX 黑客松现场（主舞台 + 赞助商展台 + 一排排工位 + 网管值班室 + 厕所 + 蓝床垫休息区）。
- **两大阵营（非对称）**：
  - 🧑‍💻 **选手 Hackers**（多人，默认 4）：偷开热点、在工位 build、躲抓捕、抢道具、冲项目分。
  - 🦺 **工作人员 Staff**（少数，默认 1–2，可 PvE）：巡逻、探测热点信号、突袭抓人、封网维稳。
- **一局时长**：~55s（复用现有 5Hz、~450 tick）；5 阶段。
- **Agent 原生**：选手与工作人员由玩家提交的**不同策略代码**驱动（两套沙盒 API），也可挂内置 AI。

### 核心循环（选手视角）
```
        ┌────────────────────────────────────────────────┐
        │  移动到工位端点  ──►  开热点(ON)  ──►  build 涨进度  │
        │        ▲                 │  发出信号↑              │
        │        │                 ▼                        │
        │   关热点+伪装  ◄── 感知网管靠近/朝向我 ◄── 读热力图  │
        └────────────────────────────────────────────────┘
   进度满 100% ──► 分配项目属性 ──► 评审 ──► projectScore 排名/冲奖
```
### 核心循环（工作人员视角）
```
   读全场信号热力图 ──► 锁定最强信号/最可疑选手 ──► rush 过去
        ▲                                            │
        │                                            ▼
   scanSignal 提精度 / stakeout 蹲点 ◄── inspect 到位判定：正开热点? ──► 抓捕+违规记分
```

---

## 3. 核心机制详解

### 3.1 开热点：带宽 × 信号 的双刃剑
- 现场 `venueBandwidth` 低（默认 ~15/100），选手默认 build 速率≈0。
- 选手 `toggleHotspot(on)` → 个人带宽拉满；**只有** `hotspot=ON` **且**站在**工位端点**时，`buildProgress += rate`（基础 rate≈整数化每 tick +1，Qoder 期间 ×2~3）。
- 开热点每 tick 累积 `hotspotSignal`（信号强度）：`signal += k`（越久越强），关热点后按 `signal -= decay` 衰减。信号是工作人员的唯一"雷达输入"。
- **heat（被盯上度）**：信号强、离网管近、在明处 → heat 上升；heat 决定被 `inspect` 命中概率与画面预警强度。

### 3.2 工位端点 & 空间博弈
- 地图有 4 个 **工位区（A/B/C/D）**，各含一个 `spot`（工位端点）。**唯一能涨进度的格子**。
- 厕所/走廊也能开热点（照样发信号），但**不涨进度** → "偷偷开着不干活=纯暴露"，逼选手回工位冒险。
- 工位固定 → 网管可 `stakeout` 蹲点；选手需分散/换工位/择时。

### 3.3 抓捕判定与惩罚（确定性、整数化）
- 工作人员 `inspect`（对准某选手，需在其相邻格）：若目标此刻 `hotspot=ON` → **抓捕成功**。
- 惩罚（可配）：进度回退 `-P`（如 -15）、记 1 次 `violation`、`heat` 归零并进入短暂"被警告/冷却"（不能立即再开）。
- **不误伤守规矩的人**：没开热点被 inspect → 无事（甚至网管浪费一次行动）→ 鼓励选手"关热点装乖"的心理战。
- INJ `bribe` 可免疫一次抓捕（"赞助商通行证"），消耗 token。

### 3.4 三条资源（选手）
| 资源 | 掉 | 回 | 作用 |
|---|---|---|---|
| **电量 battery** | 每 tick 缓慢掉，build/热点更快掉 | 蓝床垫、红牛 | 归零则强制休息(掉线) |
| **精力 focus** | 长时间高压掉 | 蓝床垫、咖啡/CP | 低精力 build 速率下降 |
| **heat** | 关热点/进厕所/床垫睡 | 开热点/明处/离网管近 | 决定被抓概率与预警 |

### 3.5 INJ 空投（娱乐赛限定·真实链上水龙头）
- **只在娱乐赛/欢乐场出现**（评委之夜、周五团建等 PvE/casual 模式），**排位赛不出现**——避免真金白银影响天梯公平，也防刷。
- **人人可领·先到先得·领完即止**：地图刷出「空投点」，选手把小人走到点上即解锁「领取」；名额与额度有限，抢完本局不再刷。
- **真的发到你钱包**：token 可配为 **INJ / USDT / 其它 meme 币**；领取复用现有钱包链路（钱包已连→服务端校验名额，链上 nonce/名单防重→真实转账到玩家地址，返回 Blockscout 可验证 txHash）。**领到的币归玩家所有**（现实收益噱头/出圈点）。
- **局内附加价值**：持有 INJ 可折算局内 **1 次贿赂免抓**（`bribe`）或提升评审奖金池权重。
- **关键约束**：真实转账必须玩家钱包签名/服务端出账，**AI 策略不能自动签名**——策略只负责把小人**走到空投点**，实际领取是玩家侧 UI 按钮触发的钱包交易，先到先得由服务端+链上强约束。

---

## 4. 阵营角色与技能

**每个角色都有一个可触发的主动技能**（策略里用 `useSkill()`、手动模式点技能按钮触发），带冷却 `cooldownTicks`，就绪后可打出；被动常驻。技能是打破僵局、制造高光的关键操作。

### 4.1 选手 Hackers（沿用 6 动物职业换皮）
| 职业(动物) | 主动技能（触发效果） | 冷却 | 被动 | 玩法定位 |
|---|---|---|---|---|
| 🐱 全栈(猫) | **极速冲刺**：8s 内 build ×2 | 150t | build 速率略高 | 进度机器，需队友掩护 |
| 🦫 产品(水豚) | **假 Demo**：freeze 阶段演示分暴涨 | 175t | 属性分配更灵活 | 后期冲奖爆发 |
| 🦢 测试(鹅) | **信号伪装**：6s 内信号 -50%，难探测 | 140t | 被抓惩罚减半 | 苟王/潜行 |
| 🦝 运维(浣熊) | **私接网线**：把当前格临时变「工位端点」6s | 200t | 免疫一次封网 | 打破空间限制 |
| 🐕 设计(柴犬) | **PPT 护体**：下次被 inspect 30% 免抓 | 160t | Demo 维度加成 | 心理战/演示流 |
| 🐹 实习生(仓鼠) | **人群隐身**：5s 内不可被锁定 | 175t | heat 增长更慢 | 黑马/低调苟分 |

### 4.2 工作人员 Staff（🦮 保安犬 / 戴工牌的动物，技能同样可触发·带冷却）
| 技能 | 触发效果 | 冷却 |
|---|---|---|
| **信号扫描 scanSignal** | 一段时间内热力图精度/范围↑（看得更准） | 120t |
| **封网 jamNetwork(zone)** | 该区一段时间内即便开热点也不涨进度（逼转移） | 180t |
| **蹲点 stakeout(zone)** | 埋伏隐藏自身位置，选手在该区开热点必被发现 | 160t |
| **广播查房 broadcast** | 全场 heat 短时上升（吓阻），逼选手集体关热点 | 220t |
- 多名工作人员可读同伴位置协同包夹、分区巡逻。

---

## 5. 现场道具系统（用户点名 + AdventureX 梗）
| 道具 | 效果 | 获取/刷新 | 博弈点 |
|---|---|---|---|
| 🟩 **Qoder** | 一段时间 build ×2~3（vibe coding 冲刺） | 赞助商展台稀缺刷新 | 抢 Qoder=抢进度节奏，抢点暴露 |
| 🟦 **蓝盒子床垫** | 回电量/精力 + 暂隐信号（睡觉伪装） | 休息区固定 | 回血 vs 不涨进度的机会成本 |
| 🪙 **INJ 空投** | **娱乐赛限定**·真实链上水龙头：走到空投点→玩家钱包领取真 token(INJ/USDT/meme)，先到先得、领完即止；局内可折算 1 次贿赂免抓 | 娱乐赛空投点，名额有限 | 抢空投 vs 冒险卷进度 |
| 💩 **狗屎** | 踩到减速+涨heat招网管；可捡起丢向对手路径 | 地图随机 | PvP 嫁祸：把网管引给领先者 |
| ⚡ **红牛** | 短时电量爆发+移动加速 | 展台 | 逃命/抢点 |
| 🪪 **工牌 badge** | 短时被识别为"工作人员"，不被当选手抓 | 签到台 | 大摇大摆开热点的窗口 |
| 📽 **Demo 大屏** | freeze 阶段占用→演示分加成 | 提交台，limited | 后期抢占战 |
| 🗒 **评委小纸条** | 透露本局评委偏好(哪维度权重高) | 随机事件 | 指导属性分配 |

---

## 6. 一局节奏（5 阶段，原地复用 MatchPhase）
| 阶段 (原) | 新语义 | 时长占比 | 重点 |
|---|---|---|---|
| standup | **kickoff 开幕** | 5% | 出生舞台、领取隐藏目标、道具首刷 |
| sprint | **build 开发** | 55% | 猫鼠主循环：开热点抢进度 vs 巡逻抓捕 |
| incident | **sweep 突击巡查** | 20% | 网管强化期：scan/封网/查房，抓捕高发；选手高风险高回报 |
| freeze | **封板提交** | 12% | 停止 build，抢 Demo 大屏、submitDemo、分配属性 |
| audit | **judging 评审** | 8% | 评委偏好结算 projectScore、公布名次/冠军/金牌网管 |

---

## 7. 项目属性 & 冲大奖（"进度满→加属性→冲奖"）
1. `buildProgress` 满 100% → 解锁 **属性池**：按累计产出/剩余时间换成 `attrPoints`。
2. 选手把点数分配到五维：**创新 Innovation / 完成度 Completeness / 技术难度 TechDepth / 商业 Biz / 演示 DemoWow**（可被"假Demo""PPT护体""评委纸条"影响）。
3. 评审阶段：本局随机 **评委偏好权重**（如"本届重创新×1.5、重商业×1.2"，由 eventBias/纸条透露）。
4. `projectScore = Σ(attr_i × judgeWeight_i) − violations×v − caughtCount×c + demoBonus`。
5. `projectScore` 决定选手名次 + rating 升降 + 是否拿"最佳项目/最速通关/黑红出圈"等奖（对应隐藏目标）。

> 关键：进度只是"入场券"，**属性分配 + 评委偏好**是二次策略层，制造"同样满进度但拿奖不同"的深度与话题。

---

## 8. 胜负与排名（竞争感 + 刷榜）
- **选手榜**：按 projectScore；展示 rating 升降(绿+/红-)、连胜🔥、冠军👑、所用 Agent 供应商徽标(Qoder/Codex/...)。
- **工作人员榜（金牌网管）**：按 抓捕数 + 压制违规带宽 + 网络健康维持；单独 rating。
- **阵营模式（可选团队赛）**：选手阵营总分 ≥ 阈值 → "黑客松出片成功"；否则 Staff "维稳成功"。
- 复用 `RulesetScenario.winCondition` 新增：`build`(选手项目分) / `bust`(网管抓捕分) / `award`(属性冲奖) / `raid`(阵营攻防)。

---

## 9. 关卡/模式（scenarios 扩展，一处配置即上新玩法）
| 模式 | winCondition | 规则要点 | 梗 |
|---|---|---|---|
| **标准黑客松** | build | 4 选手 + 1 网管；均衡 | 常规刷榜 |
| **极限 24h** | build | 电量掉更快、网络更烂、Qoder 更稀缺 | 通宵爆肝 |
| **单排潜行** | stealth→"苟王" | 网管×2，抓捕惩罚重，比谁零违规冲最高分 | 老六局 |
| **网管突击夜** | bust | Staff 视角为主，比谁抓得多；选手为 PvE | 反向抓人 |
| **阵营攻防 5v2** | raid | 5 选手 vs 2 网管，团队总分对抗 | 团队赛 |
| **评委之夜 (PvE)** | award | 无网管，纯拼属性分配+评委偏好 | 欢乐场 |

---

## 10. Agent 策略 API（"扮演不同角色=写不同逻辑代码"）
沙盒复用 node:vm + `MeContext/OfficeContext` 模式，按 `faction` 暴露不同 context 与 `availableActions`。

**选手 API（HackerContext / HackerAction）**
```ts
// 观测
{ me:{ pos, zone, battery, focus, heat, buildProgress, hotspotOn, atWorkstation },
  staff:[{ pos?, facing?, distance?, lookingAtMe? , jamming? }],
  items:[{ kind:'qoder'|'mattress'|'inj'|'poop'|'redbull'|'badge', pos }],
  workstations:[{ zone, spot, occupied }], teammates:[...], phase, judgeHint? }
// 动作
moveTo(zone) | toggleHotspot(on) | build | useItem(kind) | rest | disguise
 | throwPoop(pos) | bribe | submitDemo | allocateAttr({innovation,...})
```
示例策略（伪代码）：
```ts
if (staff.some(s => s.lookingAtMe && s.distance < 4)) return toggleHotspot(false), disguise();
if (!me.atWorkstation) return moveTo(nearestFreeWorkstation());
if (!me.hotspotOn && staffFarEnough()) return toggleHotspot(true);
if (item('qoder').near()) return useItem('qoder');
return build();
```

**工作人员 API（StaffContext / StaffAction）**
```ts
{ signalMap:[{ zone, strength, bearing }], suspects:[{ id, heatBand, lastSeenZone }],
  peers:[{ pos, zone }], bandwidth, phase }
patrolTo(zone) | scanSignal | rush(workerId) | inspect(workerId)
 | jamNetwork(zone) | stakeout(zone) | broadcast
```
示例策略：
```ts
const hot = strongestSignal(signalMap);
if (adjacentToSuspectHotspot()) return inspect(currentSuspect());
if (hot.strength > TH) return rush(nearestSuspectIn(hot.zone));
return phase==='sweep' ? jamNetwork(hot.zone) : patrolTo(nextPatrol());
```
> MVP 落地：**选手 API 全开 + 工作人员内置 AI**（先保证一侧可编程即可跑通刷榜）；二期开放工作人员策略与阵营赛。

---

## 11. 地图：AdventureX 会场（ZONES 换皮，20×14 不变）
| 原 zone | 新语义 | 作用 |
|---|---|---|
| devDesk / designDesk / qa / serverRoom | **工位区 A/B/C/D** | 唯一能涨进度的工位端点 |
| meeting | **主舞台/开幕区** | 选手出生、开幕、领隐藏目标 |
| pantry | **赞助商展台** | Qoder / INJ 空投 / 红牛刷新 |
| restroom | **厕所** | 偷开热点点(涨heat不涨进度)、藏身 |
| hr | **签到/工牌台** | 拿 badge 伪装 |
| release | **提交/Demo 台** | freeze 提交、抢 Demo 大屏 |
| bossOffice | **网管值班室** | Staff 出生/监控中心 |
| （新增点） | **蓝盒子床垫休息区** | 回电量/精力+隐信号 |

`BOSS_PATROL`→Staff 巡逻线；`SPAWN_POINTS`→选手舞台出生；`buildWalkable()` 保留。

---

## 12. 经济与链上（复用现有骨架，换叙事）
- **INJ 空投（娱乐赛限定真实水龙头）**：人人可领、先到先得、真发到钱包（INJ/USDT/meme 可配），复用现有钱包 `sendTx`/服务端出账 + `/api/chain/record`；名额与防重复由服务端+链上强约束；领到归玩家所有。局内可折算贿赂免抓/奖金池权重。**排位赛不出现**。
- **提交上链**：`submitDemo` 时把作品 hash + projectScore 锚定到 Injective testnet → 真实"作品存证"叙事。
- **Coffee Points**：保留为软通证（能量饮料点）；质押改为"押注哪位选手能拿奖"；赛季通行证=黑客松季票。

---

## 13. 竞争感 & 刷榜钩子（直接复用上一轮成果）
- 目标栏：把"随机每局目标"换成**本局评委偏好 + 里程碑**（发进度/零违规/抢到Qoder/无被抓）。
- 实时解说 + 人物头顶气泡：换成"XX 偷偷开热点了！""网管冲向 A 区！""XX 被逮个正着💥""XX 用 Qoder 起飞🚀"。
- 领奖台/连胜/供应商徽标/rating 升降全部保留 → 立刻有排行榜与出圈话题。

---

## 14. 数值与平衡（初始建议 + 确定性红线）
- 初始：`venueBandwidth 15`、build 基础 +1/tick、Qoder ×2.5、开热点 signal +3/tick、关热点 decay -2/tick、inspect 相邻且 hotspotOn 必中、抓捕惩罚 progress-15+violation+heat 清零、选手/网管 4:1。
- **确定性红线（不可破）**：信号扩散、道具、抓捕、评审全部整数化；同 tick 内动作按 seat 顺序结算；固定种子→可复现回放（现有引擎 13 项确定性测试必须继续通过）。
- 平衡旋钮：选手:网管比、抓捕惩罚强度、信号衰减、Qoder 稀缺度、工位数量。

---

## 15. 重构映射与改造清单（按包/文件）
**保留（几乎不动）**：`packages/engine` 主循环/种子/pathfinding、回放 frames/timeline、`apps/web` OfficeCanvas 渲染骨架 + PixelSprite、MatchView(目标栏/解说/速度/结果)、经济/链上/钱包/徽标、i18n、Playwright。
**改造（换语义层）**：
- `shared/types.ts`：`RoleId`→加 `faction:'hacker'|'staff'`；`ReplayFrame` 增 `hotspotOn/heat/buildProgress`（可复用 workers 现有字段：contribution→buildProgress、suspicion→heat、blame→violations）。
- `shared/roles.ts`：技能重定义为选手/网管技能。
- `shared/map.ts`：ZONES 换皮 + 标记 workstation 端点。
- `shared/scenarios.ts` + `engine/audit.ts`：新增 winCondition `build/bust/award/raid` 与评分。
- `shared/events.ts`/`objectives.ts`：AdventureX 梗事件 + 奖项隐藏目标。
- `engine/simulate.ts`：加"开热点/信号/工位判定/抓捕/道具"整数化子系统；boss→多 Staff。
- 沙盒 `MeContext/OfficeContext`→按 faction 分派 Hacker/Staff 双 API。
- `apps/web/pixelart.ts`：新增道具精灵(Qoder/蓝床垫/INJ/💩/红牛/工牌)、Staff 皮肤、会场背景。
**弱化/废弃**：责任图 custody 甩锅（降级为"丢狗屎嫁祸"或删）、单体老板 PvE（升级多 Staff）。

---

## 16. 分阶段落地路线
- **M1 可玩核（1 侧可编程）**：开热点/工位/信号/抓捕 + build 进度 + 内置 AI 网管 + 回放渲染换皮。→ 立刻能看猫鼠对抗。
- **M2 冲奖层**：属性分配 + 评委偏好 + projectScore + 选手榜/rating。
- **M3 道具层**：Qoder/蓝床垫/INJ/狗屎/红牛/工牌/大屏/纸条。
- **M4 双阵营可编程 + 模式**：Staff 策略 API、阵营攻防 5v2、网管突击夜、评委之夜。
- **M5 链上/经济**：作品 hash 上链、INJ 奖金池、押注拿奖、季票。

---

## 17. 风险 & 开放问题
1. **非对称平衡**：选手太苟→网管无聊；网管太强→选手无产出。需大量调参 + 或先 PvE。
2. **确定性**：新子系统多，任一浮点/无序遍历都会破回放；必须整数化 + 固定顺序 + 补充确定性测试。
3. **沙盒双 API 工作量**：二期再开放 Staff 编程，MVP 先内置。
4. **"狗屎/贿赂"观感**：需把握玩梗尺度，做成幽默而非低俗；INJ 贿赂要与真实链上叙事自洽。
5. **AdventureX 授权/品牌**：现场名称/赞助商梗（Qoder、蓝床垫）仅作致敬皮肤，避免商标风险。

---

## 18. 一局示例剧本（让玩法可感）
> kickoff：4 只动物选手在主舞台出生，各领隐藏目标（猫=拿"最速通关"）。1 只保安犬网管进值班室。
> build：猫冲到 A 区工位开热点狂 build，信号飙升；网管热力图 A 区变红，`rush` 过去。猫在网管进门前一 tick `toggleHotspot(false)+disguise`，网管 `inspect` 扑空、浪费一手。水豚趁机在 C 区抢到 **Qoder** 进度起飞🚀。仓鼠在厕所偷开热点被自己踩到 **狗屎**💩，heat 爆表，被逮个正着💥进度回退。
> sweep：网管 `broadcast` 查房，全场被迫关热点；柴犬用 **PPT 护体** 硬开被 inspect 也免抓。
> freeze：猫进度满，分配属性全压"技术难度+完成度"；水豚抢到 **Demo 大屏** 演示分暴涨；本局评委纸条透露"重创新"。
> judging：水豚创新高、演示高 → projectScore 第一夺冠👑、rating +26；猫技术高但创新一般拿"最速通关"奖；网管抓到 2 人登顶金牌网管榜。观众在排行榜看到各自的 Agent 徽标(Qoder/Codex)与连胜🔥。

---

**结论**：无需重写引擎，**换的是"领域语义层"而非骨架**。开热点双刃剑 + 工位空间博弈 + 属性冲奖三层结构，把原来单向的躲猫猫升级为"为赢必须冒险"的双向信息战，天然带竞争感与刷榜/出圈话题，且与 Qoder / INJ / AdventureX 现场梗深度绑定。建议按 M1→M5 迭代，先做出"能看的猫鼠对抗"再叠冲奖与道具。
