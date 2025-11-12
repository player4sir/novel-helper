# 使用 Node.js 20 LTS
FROM node:20-slim

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装所有依赖（包括 devDependencies，因为需要构建）
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 不删除 devDependencies，因为生产环境的 vite.ts 需要它们
# 如果需要减小镜像体积，可以使用多阶段构建

# 暴露端口（ClawCloud Run 会自动映射）
EXPOSE 5000

# 设置环境变量
ENV NODE_ENV=production

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:5000/api/projects', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "dist/index.js"]
