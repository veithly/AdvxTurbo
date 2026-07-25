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

# 安装整个 workspace 依赖（server 靠 tsx 运行时解析本地包，无需预编译）
RUN npm ci

# 复制运行 server 真正需要的源码与静态资源
COPY packages/shared packages/shared
COPY packages/engine packages/engine
COPY apps/server apps/server
COPY assets_audio assets_audio
COPY blame_game_8bit_assets_v2 blame_game_8bit_assets_v2

ENV NODE_ENV=production
ENV PORT=4000
# SQLite 落到持久卷挂载点（见 Zeabur 持久卷配置：挂到 /app/apps/server/data）
ENV BLAME_DB=/app/apps/server/data/blame.db

EXPOSE 4000

# npm start = node --import tsx src/index.ts（见 apps/server/package.json）
CMD ["npm", "start", "-w", "@blame/server"]
