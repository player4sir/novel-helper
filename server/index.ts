import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { loadEnvironmentVariables, validateEnvironment, printDiagnostics } from "./startup-wrapper";

const app = express();

// CORS 配置 - 允许移动端访问
app.use(cors({
  origin: process.env.NODE_ENV === "production" 
    ? [
        /\.zeabur\.app$/,  // Zeabur 域名
        /\.pages\.dev$/,  // Cloudflare Pages
        /capacitor:\/\//,  // Capacitor 应用
        /http:\/\/localhost/,  // 本地开发
      ]
    : true,  // 开发环境允许所有来源
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // 加载环境变量
    await loadEnvironmentVariables();
    
    // 打印诊断信息
    printDiagnostics();
    
    // 验证必需的环境变量
    validateEnvironment();
    
    // 测试数据库连接
    const { testDatabaseConnection } = await import("./startup-wrapper");
    await testDatabaseConnection();
    
    // 测试队列连接（内存模式）
    const { testQueueConnection } = await import("./queue-connection");
    await testQueueConnection();
    
    // 初始化核心模板 - DISABLED: Use seed-prompt-templates.ts instead
    // const { initializeCoreTemplates } = await import("./init-core-templates");
    // await initializeCoreTemplates();
    console.log("[Init] Skipping core templates initialization. Run 'npm run seed:templates' to initialize templates.");
  } catch (err) {
    console.error("✗ Startup failed:", err);
    process.exit(1);
  }

  const server = await registerRoutes(app);

  // Start session cleanup job
  const { startSessionCleanupJob } = await import("./jobs/session-cleanup");
  startSessionCleanupJob();
  console.log("[Init] Session cleanup job started");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
