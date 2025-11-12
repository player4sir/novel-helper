/// <reference path="./electron-types.d.ts" />
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";
import { nanoid } from "nanoid";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Dynamically import Vite only in development to avoid bundling it in production
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // 动态导入 vite.config 以避免在 CommonJS 构建时出错
  let viteConfig: any = {};
  try {
    const configModule = await import("../vite.config.js");
    viteConfig = configModule.default || configModule;
  } catch (error) {
    log("Warning: Could not load vite.config, using default configuration");
  }

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // 兼容 ESM 和 CommonJS
      const getDirname = () => {
        if (typeof __dirname !== 'undefined') {
          return __dirname;
        }
        // ES 模块环境：使用 import.meta.url
        if (typeof import.meta !== 'undefined' && import.meta.url) {
          return path.dirname(fileURLToPath(import.meta.url));
        }
        return process.cwd();
      };
      
      const dirname = getDirname();
      const clientTemplate = path.resolve(
        dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // 在 Electron 打包环境中，需要从正确的路径加载静态文件
  // 兼容 ESM 和 CommonJS
  const getDirname = () => {
    if (typeof __dirname !== 'undefined') {
      return __dirname;
    }
    return process.cwd();
  };
  
  const dirname = getDirname();
  
  // 尝试多个可能的路径
  const possiblePaths = [
    path.resolve(dirname, "public"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(dirname, "..", "public"),
    // Electron 打包后的路径
    path.resolve((process as any).resourcesPath || '', "app.asar", "dist", "public"),
    path.resolve((process as any).resourcesPath || '', "app", "dist", "public"),
  ];
  
  let distPath = '';
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      distPath = testPath;
      break;
    }
  }
  
  if (!distPath) {
    log(`Error: Could not find build directory in any of these locations:`);
    possiblePaths.forEach(p => log(`  - ${p}`));
    log(`Current working directory: ${process.cwd()}`);
    log(`dirname: ${dirname}`);
    log(`resourcesPath: ${(process as any).resourcesPath || 'undefined'}`);
    throw new Error(
      `Could not find the build directory, make sure to build the client first`,
    );
  }

  log(`Serving static files from: ${distPath}`);
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
