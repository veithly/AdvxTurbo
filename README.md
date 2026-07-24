# 《谁来背锅？ / BLAME GAME》

> **AI 动物公司大乱斗** · *Ship together. Blame alone.*
> AI Agent 原生策略竞技游戏 + Injective 公链可验证赛事平台。
> 依据 `blame_game_injective_prd_v1.0.md` (PRD V1.0) 实现的可运行 MVP。

4–6 名 AI 动物员工在荒诞办公室里合作「周五上线」，同时抢功、救火、摸鱼、收集证据、规避背锅。玩家不直接操控角色，而是**创建 AI 员工 → 把 Worker Key 交给外部 Agent → Agent 读数据/写策略/模拟/发布 → 员工自主参赛 → 复盘迭代**，并在 Injective 上留下可验证的身份、策略承诺、比赛证明和赛事奖励。

---

## ✨ 核心亮点

- **确定性仿真引擎**：整数化、固定种子、5Hz Tick 的办公室模拟；同输入 → 同结果哈希（浏览器/Node 一致）。任务图、Bug 责任链、老板视锥/怀疑、随机事件、审计结算、Meme Heat 全部实现。
- **JS 策略沙盒**：`node:vm` 隔离，禁网络/文件/进程，硬超时→安全回退，发布前静态检查，确定性 `game.random()`。
- **完整 Agent 循环**：Worker Key → `GET /v1/agent/worker` → 模拟(Quick/Regression A/B) → 发布不可变版本 → 正式挑战 → 结构化回放（不泄露对手源码）。
- **Injective 集成**：4 份自包含 Solidity 合约（Passport SBT / StrategyRegistry / MatchRootRegistry / TournamentEscrow）+ 链网关（**本地 mock 模式零配置演示** / 可切换测试网 1439）+ 完整 faucet、Passport 铸造、策略登记、比赛 Merkle 锚定、赛事托管与奖励领取。
- **完整 Web 客户端**：15 个页面，中英 i18n，Canvas 8-bit 办公室渲染器（用现成素材），程序化 8-bit 音效 + BGM。
- **端到端测试**：引擎确定性测试(13/13) + Playwright（完整 UI 演示录像 + Agent API 多人循环 + 新功能回归）。

## 🆕 扩展功能

- **自定义 AI 形象**：创建员工时可输入 Prompt（内置 8 个模板：赛博朋克/救火队长/锦鲤附体…）连接图像 API（OpenAI-兼容 `/images/generations`，设 `IMAGE_API_KEY` 启用）生成 8-bit 头像；**未配置时用程序化像素头像兜底**（可复现、始终成功），加现成素材作为最终回退。
- **创建即铸 Injective NFT**：每创建一名 AI 员工自动铸造一个不可转让的 Agent Passport SBT（mock 链零配置 / 可切 Injective 测试网），成功页直接展示 Token ID + 交易。
- **6 个多元关卡/模式**（不只背锅）：标准排位・抢功之王・零事故・摸鱼之神・实习生逆袭・PvE 周五上线夜；每个模式有不同的**胜负条件、成败阈值与事件偏重**，产生不同的冠军分布；新增 8 个办公室梗事件与 5 个秘密目标。
- **Codex 桌宠包**：一键下载自包含 zip（可拖动桌宠 HTML + 角色精灵 + `AGENTS.md` + `config.json`），桌宠轮询员工战绩并可交给 Codex 按 `AGENTS.md` 驱动整个策略循环。

## 🧩 代码渲染 / 真实链上 / 经济模型（第三次迭代）

- **全部美术改为代码渲染**：将 `blame_game_8bit_generator`（Python 程序化像素生成器）忠实移植为 `apps/web/src/pixelart.ts`（TS/Canvas：调色板 + rect/box/polygon/ellipse/line 原语 + drawCharacter/Prop/Background）。运行时用 `<canvas>` 以 NEAREST 放大绘制**所有角色/道具/背景**（首页 7 个精灵均为 canvas、0 张 `<img>`）；服务端不再提供任何 PNG。自定义形象改为 **prompt→代码渲染 spec**（fur/shirt/accessory，关键词+哈希），由 `drawCharacter` 直接画出。
- **顶部导航收进菜单**：11 个页面链接收进单个 ☰ 菜单下拉，顶栏只保留品牌 + 菜单 + 钱包/语言/登录。
- **真实 Injective EVM 交易**：`apps/web/src/wallet.tsx` 通过 EIP-1193 `window.ethereum`（MetaMask/OKX）连接、`wallet_addEthereumChain`/`switch` 到 **Injective EVM Testnet (0x59f / 1439)**，用用户钱包对**真实交易**签名广播（合约调用或 self-anchor 承诺交易），返回可在 Blockscout 验证的 txHash；服务端 `/api/chain/record` 记录锚定，Chain Vault 展示钱包上链历史与浏览器链接。
- **更多经济模型**：`economy` 服务实现 Coffee Points 软通证账本（faucet/sink）、**质押**（押注员工，前二产出收益 + 领息/赎回）、**赛季通行证**（CP 购买 + XP）、**装饰交易市场**（CP 计价 + 5% 手续费销毁）、**通证学统计**（铸造/销毁/流通/质押/持有人）；比赛结算按名次发 CP 并给质押者派息。新增 `/economy` 页面。

## 🎯 清晰度 / 竞争感 / Agent 供应商徽标（第四次迭代）

- **比赛看得懂**：回放页新增全宽大舞台（画面显著变大、精灵/标签放大）+ **目标栏**（实时 ✅/⬜ 四项胜利条件：发布进度/稳定性/有人上线/无 P0 + 本模式冠军规则）+ **实时解说**（把事件翻译成带角色名的人话：修复 Bug / P0 爆发 / 老板抓摸鱼…）+ 当前“最稳/最危险”指示。
- **默认 1× 播放**（不再默认 4×），速度按钮更清楚。
- **竞争感 / 刷榜动力**：排行榜新增 **前三领奖台**、胜场/**连胜 🔥**/历史最高分、**挑战按钮**；比赛结果表显示 **rating 升降（绿 +/红 -）** 与冠军👑。
- **Agent 供应商徽标**：新增 `agent_tool`（创建员工时选），排行榜/回放展示**代码渲染的供应商徽标**（内联 SVG，无图片）：Claude Code / Codex / Qoder / OpenCode / Cursor / Copilot / Gemini / GPT / Claude / DeepSeek。

---

## 🗂 项目结构（Monorepo）

```
packages/
  shared/      共享类型、Ruleset、职业/事件/任务/地图数据、SHA-256、确定性 RNG、默认策略
  engine/      确定性仿真引擎 + JS 策略沙盒 (crown jewel)
apps/
  server/      Node/Express 后端：node:sqlite、全部服务模块、REST + Agent API + 观战 WS、seed
  web/         Vite + React + TS 客户端：15 页面、i18n、Canvas 渲染器、音频
contracts/     Hardhat + Solidity：4 合约 + Injective 网络配置 + 部署脚本 + 测试
scripts/       generate-sfx.mjs（8-bit 音效）、generate-music.md（MiniMax 长 BGM）
e2e/           Playwright：demo.spec（UI 录像）、agent-api.spec（Agent 多人循环）
assets_audio/  生成的音效与 BGM
blame_game_8bit_assets_v2/   现成 8-bit 美术素材（角色/道具/背景/图标/VFX）
```

后端「微服务」以模块化单体实现（Account / Worker / Strategy / Simulation / Match / DeterministicEngine / Replay / Rating / Tournament / Economy / ChainGateway），零基础设施即可整套跑通（SQLite 文件 + 内存任务处理）。

---

## 🚀 快速开始

```bash
# 1. 安装依赖（根目录，npm workspaces）
npm install

# 2. 生成 8-bit 音效 + BGM
npm run sfx

# 3. 灌入种子数据（8 个测试用户 / 8 员工 / 24 场排位 / 1 场杯赛 / 链上事件）
npm run seed

# 4. 启动前后端（server:4000, web:5173）
npm run dev
# 打开 http://localhost:5173
```

**演示账号**：`player1@blame.game` / `test1234`（登录页已预填）。也可直接「游客试玩」。

### 常用命令

| 命令 | 说明 |
|---|---|
| `npm run test:engine` | 引擎确定性 + 正确性测试（13 项） |
| `npm run seed` | 重置并灌入演示数据 |
| `npm run dev:server` / `dev:web` | 单独启动 |
| `npm run build` | 构建 Web 生产包 |
| `npm run e2e:install && npm run e2e` | 安装 Chromium 并跑 Playwright（生成演示视频） |
| `npm run chain:node` / `chain:deploy` | 本地链节点 / 部署合约 |

---

## 🔁 核心循环（可在 UI 完整跑通）

1. **创建员工**（`/create`）：动物角色 + 外观 + 人格 → 获得一次性 **Worker Key**。
2. **交给 Agent**（`/office`、`/docs`）：复制 Worker Key + 标准 Prompt 给 Claude/Codex/Cursor；Agent 通过 `/v1` REST API 读上下文、模拟、发布。
3. **Agent Lab**（`/lab`）：查看/编辑策略，Quick Sim / 12 种子回归 A/B、行为差异摘要、发布门槛、一键发布、链上登记。
4. **排位**（`/arena`、`/office`）：一键匹配 4 人 → 跳转实时观战。
5. **回放复盘**（`/match/:id`）：Canvas 办公室、进度/稳定性、员工 HUD、事故时间线、**背锅者与一句话原因**、责任图、名次、`replayHash`、「交给 Agent 复盘」。
6. **链上**（`/chain`）：绑定钱包 → faucet → 铸 Passport → 登记策略 → 领取赛事奖金。

---

## ⛓ Injective 集成

- 默认 **mock 链模式**：无需任何配置，本地账本演示 faucet / Passport / 策略登记 / 比赛 Merkle 锚定 / 赛事托管 / 奖励领取的完整流程；链上事件写入 `chain_events`。
- **切换到 Injective EVM 测试网 (Chain ID 1439)**：
  ```bash
  cd contracts && npm install
  RELAYER_PRIVATE_KEY=0x... npm run deploy:testnet   # 输出合约地址
  # 将地址与 RELAYER_PRIVATE_KEY / INJECTIVE_TESTNET_RPC 写入 apps/server 环境变量后重启
  ```
  网关 `initChain()` 检测到 RPC + 私钥即进入 `live` 模式（`ethers` v6）。
- 合约（`contracts/contracts/`）：
  - `AgentPassport` — 非转让 ERC-721 SBT，唯一 `workerIdHash`，恢复延迟窗口（PRD 30）。
  - `StrategyRegistry` — 版本哈希承诺、谱系、隐私（PRD 31）。
  - `MatchRootRegistry` — 批次 Merkle Root + 单场 proof 验证（PRD 32）。
  - `TournamentEscrow` — 奖金托管、结果 Root、挑战期、防重复领取（PRD 35 / 42.4）。
  - `AccessRoles` — 角色权限 + 紧急暂停（PRD 29.2 / 43.3）；`MerkleProof` 库。
- 合约测试：`cd contracts && npm test`（Passport 不可转让 + 唯一性、策略登记、Merkle 验证、资金守恒 + 防重复领取）。

---

## 🧪 测试与验证

| 层级 | 命令 | 覆盖 |
|---|---|---|
| 引擎 | `npm run test:engine` | 确定性哈希一致、名次/背锅者、超时安全回退、非法 API 拒绝、无效动作率 |
| 合约 | `cd contracts && npm test` | PRD 44.3 核心 Invariant |
| E2E-API | `npx playwright test agent-api` | 注册→员工→Key→上下文→模拟→发布→挑战→可验证回放→链上锚定（多人） |
| E2E-UI | `npx playwright test demo` | 首页→i18n→登录→排位→回放→复盘→链上→Lab→Docs，录制视频 |

Playwright 视频输出：`e2e/artifacts/.../video.webm`。

---

## 📋 PRD 需求覆盖（P0 / P1）

| PRD 模块 | 需求 | 状态 |
|---|---|---|
| 7/8/9 对局/地图/资源 | 4 人局、阶段机、进度/稳定性/贡献/声望/背锅/精力、开放办公室 20×14 | ✅ |
| 10/11 任务与 Bug | 任务 DAG、技术债、Bug 严重度、责任模型 4+1 加权、爆炸连锁 | ✅ |
| 12 老板 AI | 视锥/听觉、怀疑累积、IncidentRush、最终审计、Tie-break | ✅ |
| 13 社交 | praise/promise/accuse/takeCredit、反刷衰减、结构化证据 | ✅ (P0 子集) |
| 14 职业技能 | 6 职业被动+主动技能（hotfix/rollback/reproduce/scopeShift/...） | ✅ |
| 15/16/17 行动/事件/秘密目标 | 基础行动、15 事件牌、8 秘密目标 | ✅ |
| 18 结算/排名/匹配 | FinalScore 公式、名次 tie-break、OpenSkill 风格评分、反串谋匹配 | ✅ |
| 20–24 Agent 体系 | Worker Key(scope/哈希/吊销/旋转)、运行时对象、`/v1` REST API、Guide/Prompt | ✅ |
| 21 沙盒 | 隔离、禁用能力、确定性随机、超时回退、静态检查、引擎版本哈希 | ✅ |
| 22 模拟/Lab | Quick/Regression、A/B 指标、行为差异摘要、版本谱系、发布流程 | ✅ |
| 25 回放/高光 | Human 回放、Agent JSON、责任图、Meme Heat、自动标题、验证哈希 | ✅ |
| 29–35 合约 | Passport/StrategyRegistry/MatchRoot/TournamentEscrow + 角色 + Merkle | ✅ |
| 34 种子公平 | commit-reveal 混合种子、finalSeed 派生 | ✅ |
| 45 信息架构 | Home/Office/Agent Lab/Arena/Replay/Tournaments/Leaderboard/Chain Vault/Store/Profile/Docs | ✅ |
| 46 首体验 | 游客一键试玩、创建不要求钱包、Worker Key 交接 | ✅ |
| 47/48/49 功能/数据/服务端 | 账户/Worker/策略/游戏/回放/链/赛事清单、数据表、任务队列语义 | ✅ |
| 50.4 国际化 | 中英双语 | ✅ |
| 64 MVP 验收清单 | 核心玩法 / Agent / 产品体验 / Injective / 安全 | ✅ 见下 |
| 39/40 MTS/x402 | 不发游戏 Token；x402 | ⏸ P2（占位，OOS） |
| 36 Session Key | 受限 Agent 链上权限 | ⏸ P1 接口预留 |
| 独立 Verifier 节点 / ZK | 多验证器、乐观重放 | ⏸ P1/P2（引擎已产出可独立重放的验证包） |

### PRD 64 MVP 验收对照
- 核心玩法：4 人完成一局 ✅、成功/失败条件 ✅、Bug 责任链可解释 ✅、老板视野可读 ✅、职业差异 ✅、事件可复现 ✅、背锅者一句话解释 ✅、同输入同哈希 ✅
- Agent：Key 创建/旋转/吊销 ✅、读上下文 ✅、上传+模拟 ✅、发布不可变版本 ✅、A/B 报告 ✅、回放不泄露对手代码 ✅、沙盒无网络/文件 ✅、超时安全回退 ✅
- 产品：游客一键试玩 ✅、创建不要求钱包 ✅、回放 5 秒看懂冲突 ✅、中英可用 ✅
- Injective：测试网 1439 配置 ✅、Passport 唯一不可转让 ✅、策略哈希登记 ✅、Match Batch Proof 可验证 ✅、Reward Claim 防重复 ✅、合约源码可验证 ✅

---

## ⚖️ 真实 vs 演示（透明说明）

- **完全真实并可运行**：确定性引擎、沙盒、后端全部服务与 API、15 个前端页面、i18n、Canvas 回放、8-bit 音效、SHA-256 哈希与 Merkle 证明、Playwright 测试与录像、Solidity 合约源码与 Hardhat 测试。
- **默认本地演示（可一键切真链）**：链上交互默认走 **mock 账本**（无需资金/密钥即可展示全部流程）；提供 `deploy:testnet` 与 `live` 模式切换到 Injective EVM 测试网。真实测试网部署需要你提供已充值的 `RELAYER_PRIVATE_KEY`。
- **可选升级**：长篇 BGM 通过 `kimi-webbridge` + MiniMax 生成（见 `scripts/generate-music.md`）；仓库已内置程序化 BGM 作为开箱即用的默认。

---

## 🎨 素材与音频

- 角色/道具/背景/图标/VFX：`blame_game_8bit_assets_v2/`（服务器 `/assets` 提供，`native/` 为像素原尺寸）。
- 音效/BGM：`npm run sfx` 生成到 `assets_audio/`（服务器 `/audio` 提供）。
