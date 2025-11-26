# 后端专用 Dockerfile - 仅构建和运行 API 服务
# 前端由 Cloudflare Pages 单独部署

FROM node:20-slim

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装所有依赖（包括 devDependencies，因为需要 esbuild、tsx 等构建工具）
RUN npm ci

# 复制源代码
COPY server ./server
COPY shared ./shared
COPY scripts ./scripts
COPY migrations ./migrations
COPY drizzle.config.ts ./
COPY tsconfig.json ./

# 仅构建后端（直接使用 esbuild，不运行 vite build）
RUN npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# 清理 devDependencies（可选，减小镜像体积）
# RUN npm prune --production

# 暴露端口
EXPOSE 5000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=5000

# 启动后端服务
CMD ["node", "dist/index.js"]
