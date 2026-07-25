# BLAME GAME server —— Zeabur / Docker 部署
# 用 node:22：server 依赖 node:sqlite (DatabaseSync)，Node 20 无此内置模块。
# 通过 tsx 直接运行 TS 源码（monorepo 内 @blame/shared、@blame/engine 均为纯源码包）。
#
# 构建上下文必须是仓库根目录（monorepo），而不是 apps/server：
#   docker build -f apps/server/Dockerfile -t blame-server .
# 在 Zeabur 上：把该服务的 Root Directory 设为仓库根，Dockerfile 路径填 apps/server/Dockerfile。
FROM node:22-slim

WORKDIR /app

# 先只复制清单，最大化利用镜像层缓存
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/engine/package.json packages/engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

# 安装整个 workspace 依赖。server 靠 tsx 运行时执行 TS 源码，而 tsx 在根
# devDependencies 中——生产运行必需，故用 --include=dev 强制安装，
# 不能依赖默认行为（NODE_ENV=production 时 npm 会跳过 devDependencies）。
RUN npm ci --include=dev

# 复制运行 server 真正需要的源码与静态资源
COPY packages/shared packages/shared
COPY packages/engine packages/engine
COPY apps/server apps/server
COPY apps/web apps/web
COPY assets_audio assets_audio
COPY blame_game_8bit_assets_v2 blame_game_8bit_assets_v2

# 构建前端静态包。server 的 index.ts 会自动托管 apps/web/dist（存在时），
# 于是单容器同时提供 前端 + /api + /ws，前端走相对路径无需 VITE_API_URL。
RUN npm run build -w @blame/web

# 依赖装完后再切生产模式，避免影响上面的 devDependencies 安装
ENV NODE_ENV=production
ENV PORT=4000
# SQLite 落到持久卷挂载点（见 Zeabur 持久卷配置：挂到 /app/apps/server/data）
ENV BLAME_DB=/app/apps/server/data/blame.db

EXPOSE 4000

# npm start = node --import tsx src/index.ts（见 apps/server/package.json）
CMD ["npm", "start", "-w", "@blame/server"]
