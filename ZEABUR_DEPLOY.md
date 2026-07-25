# BLAME GAME —— Zeabur 部署手册

本文档指导把《谁来背锅？ / BLAME GAME》部署到 [Zeabur](https://zeabur.com)，
并绑定域名 `advx.shineteens.com`。

代码侧的部署文件已准备好并**实测验证通过**：
- `apps/server/Dockerfile` —— Node 22 + tsx，已验证 `npm ci` 成功、`node:sqlite` 可用、server 能启动并响应
- `apps/web/zbpack.json` —— 前端 Vite 静态构建配置
- `.env.example` —— 环境变量模板

> 为什么用 Zeabur：BlameGame 是 monorepo（web 前端 + Node server + WebSocket 观战 + SQLite + Injective 链上），
> Zeabur 同时支持这几样。首次部署需要你本人在网页登录连 GitHub —— 这几步只能你操作，本文档就是给你的操作清单。

---

## 前置：把代码推到 GitHub

Zeabur 首次部署通过 GitHub 集成拉代码。确保当前分支（含新增的 Dockerfile / zbpack.json / .env.example）已推送：

```bash
cd /Users/rick/Documents/Project/Hackathon/BlameGame
git add apps/server/Dockerfile apps/web/zbpack.json .env.example .dockerignore
git commit -m "Add Zeabur/Docker deploy config"
git push
```

---

## 一、创建项目 + Server 服务

1. 打开 <https://zeabur.com>，用 GitHub 账号登录。
2. **Create Project** → 选一个区域（建议 **Tokyo / 日本**，贴合你的目标）。
3. **Add Service → Deploy from GitHub** → 选中 BlameGame 仓库。
4. Zeabur 会检测到仓库。为 **server 服务** 做如下配置：
   - **Root Directory**：`/`（仓库根 —— Dockerfile 需要 monorepo 全上下文）
   - **Dockerfile Path**：`apps/server/Dockerfile`
   - 服务名改成 `blame-server`
5. **持久卷（关键，否则重启丢档）**：给 `blame-server` 添加一个 Volume：
   - 挂载路径 **Mount Path**：`/app/apps/server/data`
   - SQLite 数据库和对局回放都写在这里；不挂卷则每次重新部署数据清零。

### server 环境变量

在 `blame-server` 服务的 **Variables** 里添加（值见你本地 `.env`，参照 `.env.example`）：

| 变量 | 必填 | 说明 |
|---|---|---|
| `OPENAI_API_KEY` | 是 | OpenAI 兼容接口密钥 |
| `OPENAI_BASE_URL` | 是 | 接口端点，如 `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 是 | 如 `gpt-4o-mini` |
| `PRIVATE_KEY` | 视情况 | 链上写操作私钥；只做只读/演示可留空（server 进只读链模式） |
| `PORT` | 否 | Zeabur 自动注入，无需手填 |

> 合约地址不用配：已写在仓库内 `apps/server/chain-deploy.json`（Injective EVM 测试网，chainId 1439），server 直接读取。

6. server 会自动构建并启动。构建约需 3-5 分钟（首次装 workspace 依赖）。
   构建完成后，在 **Networking → Public** 生成一个 `*.zeabur.app` 临时域名，
   记下它（下面 web 构建要用），先访问确认根路径返回 `BLAME GAME API` JSON。

---

## 二、创建 Web 前端服务

1. 同一项目里 **Add Service → 同一个 GitHub 仓库**（再加一次）。
2. 为 **web 服务** 配置：
   - **Root Directory**：`apps/web`
   - 服务名改成 `blame-web`
   - `apps/web/zbpack.json` 已声明静态构建（`npm run build` → `dist`），Zeabur 会识别为静态站点。
3. **web 构建期环境变量**（Variables）：
   - `VITE_API_URL` = 上一步 server 的公网地址（先填 server 的 `*.zeabur.app`，
     绑定自定义域名后可改为 `https://advx.shineteens.com`）。
   - 前端所有 `/api`、`/audio`、WebSocket 请求都会打到这个地址。

> ⚠️ 注意 monorepo 别名：`apps/web/vite.config.ts` 用 `../../packages/shared/src` 引用共享包。
> Zeabur 从仓库根 clone、只把 `apps/web` 设为 root，构建时 `../../packages` 仍在。
> 若构建报找不到 `@blame/shared`，改用方案 B（见下「排错」）。

---

## 三、绑定域名 advx.shineteens.com

你选择在 Zeabur 侧处理域名。做法：

1. 决定域名指向哪个服务：
   - **推荐**：绑到 `blame-web`（前端），前端再通过 `VITE_API_URL` 调 server。
   - 或前后端统一走一个域名（需要 Zeabur 的路由/网关配置，进阶）。
2. 在目标服务的 **Networking → Custom Domain** 输入 `advx.shineteens.com`。
3. Zeabur 会给出一条 **CNAME 目标**（形如 `xxx.zeabur.app`）。
4. 到 **DNSPod 后台**（shineteens.com 由 DNSPod 托管）添加记录：
   - 主机记录：`advx`
   - 类型：`CNAME`
   - 记录值：Zeabur 给出的那条 `xxx.zeabur.app`
5. 保存后等 DNS 生效（通常几分钟）。Zeabur 会自动签发 HTTPS 证书。
   生效后 `https://advx.shineteens.com` 即可访问。

> `advx.shineteens.com` 目前无任何解析记录，加这一条 CNAME 即可，不影响主域 `shineteens.com`。

---

## 四、部署后验证

- `https://advx.shineteens.com`（或 web 的 zeabur 域名）能打开游戏首页。
- server 根路径返回 `{"name":"BLAME GAME API", ...}`。
- 打开一局对战 → 观战页 WebSocket 能实时推帧（`/ws/match`）。
- 部署后用 CLI 看日志排错（我可以帮你跑）：
  ```bash
  npx zeabur auth login
  npx zeabur deployment log -t=runtime   # 运行时日志
  npx zeabur deployment log -t=build     # 构建日志
  ```

---

## 排错

**web 构建找不到 `@blame/shared`（monorepo 别名问题）**
方案 B：把 web 也改成从仓库根构建 —— Root Directory 设为 `/`，
自定义 build 命令 `npm ci && npm run build -w @blame/web`，输出目录 `apps/web/dist`。

**server 起不来 / tsx 报错**
确认用的是 `apps/server/Dockerfile`（已锁 Node 22，`node:sqlite` 需要）。
系统 Node 18 不行 —— 这也是为什么用 Docker 而非 buildpack。

**数据重启丢失**
检查 `blame-server` 的 Volume 挂载路径是否为 `/app/apps/server/data`。

**费用**
Zeabur 的持久卷 / 自定义域名通常需要付费计划（约 $5/月起，按用量）。
免费额度可先跑通，绑卷和自定义域名时留意是否提示升级。

---

## 已验证的技术事实（部署前实测）

| 验证项 | 结果 |
|---|---|
| `node:sqlite`（server 的 DB 依赖）在 Node 22 容器 | ✓ 建表/插入/查询正常 |
| Dockerfile `npm ci --include=dev`（含 tsx） | ✓ 安装成功 |
| server 本地 tsx 启动 | ✓ 2 秒就绪，根路径 + /api/config 均 200 |
| 链上配置读取 chain-deploy.json | ✓ 返回 Injective testnet chainId 1439 |
| WebSocket 观战端点 `/ws/match` | ✓ 端点存在 |
| 全仓库 Git 冲突标记扫描 | ✓ 干净 |
