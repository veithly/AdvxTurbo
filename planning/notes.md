# Notes: 《抓热点》重构调研

## A. 现有引擎的稳定接缝（保持不变即可复用整条链路）

**引擎契约 `SimulateInput → MatchReplay`（packages/shared/src/types.ts）**
- 输入 `SimulateInput { matchId, mode, ruleset, finalSeed, seedCommitment, participants: EngineParticipant[] }`
- 输出 `MatchReplay { result: MatchResult, frames: ReplayFrame[], timeline: ReplayEvent[], explanations }`
- 只要保持这个契约，后端 matches/tournaments、回放 API、前端 MatchView、链上锚定、经济结算**全部无需重写**。

**关键运行时/回放结构**
- `ReplayFrame { tick, phase, releaseProgress, stability, techDebt, boss{pos,state}, workers: WorkerFrame[], bugs[], activeEvents[] }` —— OfficeCanvas 靠它渲染。
  - `WorkerFrame { id, pos, label, energy, stress, blame, contribution, suspicion }`
- `Ruleset` 有 `success{requiredProgress,minimumStability,requireShipAction,allowUnresolvedP0}` + `scenario?: RulesetScenario`。
- `RulesetScenario { winCondition, winnerTitleKey, successOverride, noScapegoatPenalty, eventBias }` —— 模式差异化的唯一入口，已被 audit.ts 消费。
- 沙盒视图 `MeContext`(自己) + `OfficeContext`(世界) + `availableActions[]`；策略返回 `AgentAction[]`。这是"agent 写不同逻辑代码"的接口层。
- `MatchPhase = standup|sprint|incident|freeze|audit`（5 阶段，可原地换语义）。
- `RoleId = engineer|pm|qa|sre|designer|intern`（6 职业，各带 skill{type,cooldown}+passive+personality）。

**地图（packages/shared/src/map.ts）**：20×14 tile，10 个 ZONES（rect+spot+taskTypes），`BOSS_PATROL` 巡逻序列，`SPAWN_POINTS`，`buildWalkable()` 确定性 BFS。

**模式配置（scenarios.ts）**：`GameMode[]` + `getMode()`；winCondition 目前有 score/contribution/guardian/stealth/intern/coop，由 audit.ts 的 `modeScoreFor` 实现——**新增 key 即可加新玩法，无需动主循环**。

**已具备且可直接复用的系统**：确定性 5Hz Tick、种子 commit-reveal、回放 frames/timeline、代码渲染 8-bit(pixelart.ts)、目标栏+实时解说+速度控制(MatchView)、随机每局目标(matchGoals.ts)、排行榜/领奖台/连胜、经济 Coffee Points/质押/赛季/市场、Injective 真实钱包交易+锚定、Agent 供应商徽标(ProviderLogo)、i18n(zh/en)、Playwright E2E。

## B. 语义重映射表（换皮，不换骨架）

| 现(Blame Game) | 新(抓热点 Hackathon) |
|---|---|
| standup/sprint/incident/freeze/audit | 开幕 kickoff / 开发 build / 突击巡查 sweep / 封板提交 freeze / 评审 judging |
| releaseProgress（团队进度） | 每选手 buildProgress（个人项目进度） |
| stability（团队稳定） | venueBandwidth（现场官方网络健康）+ 选手 heat（被盯上度） |
| Bug / P0 事故 / custody 甩锅 | hotspotSignal（开热点暴露信号）/ 违规记录 / (甩锅→"丢狗屎嫁祸"轻量版) |
| boss（单体 PvE 巡逻+视锥） | Staff 阵营（多名工作人员，巡逻/信号探测/突袭抓捕） |
| worker energy/stress | 选手 电量/精力（熬夜掉，蓝盒子床垫回） |
| skill hotfix/rollback/... | 选手技能(伪装/瞬移工位/Qoder冲刺)、工作人员技能(信号扫描/封网/蹲点) |
| secretObjective | 选手隐藏目标（拿某奖项/黑红出圈/最速通关） |
| Coffee Points 经济 | 保留（赞助积分/能量饮料点）；INJ token 作为现场道具+奖金池 |

## C. 核心创新机制：开热点双刃剑（猫鼠循环）
- 官方网络烂 → 默认 build 速率≈0。
- 选手 `toggleHotspot(on)` → 获得带宽；**仅当 hotspot=ON 且站在工位端点(workstation node) 时** buildProgress 才增长。
- 开热点持续发出 hotspotSignal（强度随时长累积），工作人员可探测方位/强度并前来 `inspect` 抓捕。
- 被抓（inspect 命中正在开热点者）→ 没收热点：进度暂停、清掉一段进度或记违规、heat 归零重来。
- 选手最优解=开/关热点的节奏博弈：感知网管靠近就关热点+`disguise` 伪装工作。空间上"厕所偷开=只暴露不涨进度"，制造取舍。

## D. 现场道具（用户点名 + AdventureX 梗补充）
- **Qoder**：AI 编程神器，使用后一段时间 buildProgress ×2~3（vibe coding 冲刺）；稀缺，赞助商展台刷新。
- **蓝盒子床垫**（AdventureX 蓝床垫）：回电量/精力 + 暂时隐藏热点信号（睡觉伪装）；但躺着不涨进度（机会成本）。
- **INJ token**：现场空投；用于贿赂免疫一次抓捕 / 评审阶段折算奖金池权重 / 买 Qoder 时长；链上经济钩子。
- **狗屎 💩**：踩到减速+发臭(涨自身 heat 招网管)；可捡起丢向对手路径→PvP 嫁祸(把网管引给领先者)。
- 补充：**红牛**(短时电量爆发+加速)、**工牌 badge**(伪装成工作人员，短时不被识别)、**Demo 大屏**(freeze 阶段抢占加演示分)、**评委小纸条**(透露本局奖项偏好)。

## E. 双阵营策略 API（"不同逻辑代码"的落点）
- HackerContext/HackerAction：观测(自身电量/进度/heat、热点开关、附近工位、可见工作人员方向/是否看我、道具、队友)；动作(moveTo/toggleHotspot/build/useItem/rest/disguise/throwPoop/bribe/submitDemo)。
- StaffContext/StaffAction：观测(全场信号热力图、可疑选手、同伴位置)；动作(patrolTo/scanSignal/rush/inspect/jamNetwork/stakeout)。
- 复用 node:vm 沙盒；按 faction 分派不同 context 与 availableActions。MVP 可先"选手 API 全开 + 工作人员内置 AI"，再开放工作人员策略。

## F. 评分/胜负（竞争感 + 冲大奖）
- 选手：buildProgress 满 → **项目属性阶段**：把积累换成属性点分配到 创新/完成度/技术难度/商业/演示 五维；评审按本局随机评委偏好加权算 projectScore；被抓/违规/heat 扣分 → 决定名次+rating。
- 工作人员：抓捕数/压制违规带宽/维护网络健康 → 工作人员榜(金牌网管)。
- 阵营模式(可选)：选手总 projectScore vs 阈值 → 出片成功 / 维稳成功。
- winCondition 新 key：`build`(选手项目分)/`bust`(网管抓捕分)/`award`(属性冲奖)，走 scenarios + audit modeScoreFor 老路子。

## G. 复用/改造/废弃
- 保留：主循环/种子/回放/渲染骨架/MatchView/经济/链上/徽标/i18n/E2E。
- 改造：roles→faction+职业；Bug→signal/违规；boss→Staff 阵营；progress/stability 语义；events/objectives/scenarios/audit 评分；sandbox 双 API；地图 ZONES 换皮为会场。
- 废弃/弱化：责任图 custody 甩锅（可降级为"丢狗屎嫁祸"）、单体老板 PvE（升级多 Staff）。

## Errors / 注意
- 确定性红线：信号扩散、道具、抓捕判定必须整数化 + 固定 tick 内动作顺序，保回放可复现（引擎测试 13 项不能破）。
- 非对称平衡靠数值调参：选手/网管人数比、抓捕惩罚强度、信号衰减速率。
