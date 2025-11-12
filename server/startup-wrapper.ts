// Startup wrapper with better error handling for Electron packaging
/// <reference path="./electron-types.d.ts" />
import path from "path";
import fs from "fs";

// 环境变量加载函数
export async function loadEnvironmentVariables() {
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!isProduction) {
    // 开发环境使用 dotenv
    try {
      const dotenv = await import("dotenv");
      dotenv.config();
      console.log("✓ Loaded .env using dotenv");
      return;
    } catch (err) {
      console.warn("Warning: dotenv not available, loading manually");
    }
  }

  // 生产环境或 dotenv 不可用时手动加载
  const getDirname = () => {
    if (typeof __dirname !== 'undefined') {
      return __dirname;
    }
    return process.cwd();
  };

  const dirname = getDirname();
  const possibleEnvPaths = [
    path.join(process.cwd(), '.env'),
    path.join((process as any).resourcesPath || '', '.env'),
    path.join(dirname, '..', '.env'),
    path.join(dirname, '.env'),
  ];

  let loaded = false;
  for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`Loading .env from: ${envPath}`);
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0 && !process.env[key.trim()]) {
            process.env[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
      loaded = true;
      console.log("✓ Environment variables loaded");
      break;
    }
  }

  if (!loaded) {
    console.warn("⚠ Warning: .env file not found in any expected location");
    console.warn("Searched paths:");
    possibleEnvPaths.forEach(p => console.warn(`  - ${p}`));
  }
}

// 验证必需的环境变量
export function validateEnvironment() {
  const required = ['DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error("✗ Missing required environment variables:");
    missing.forEach(key => console.error(`  - ${key}`));
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log("✓ All required environment variables present");
}

// 诊断信息
export function printDiagnostics() {
  console.log("\n" + "=".repeat(60));
  console.log("Server Startup Diagnostics");
  console.log("=".repeat(60));
  console.log(`Node version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Architecture: ${process.arch}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`PORT: ${process.env.PORT || 'not set'}`);
  console.log(`CWD: ${process.cwd()}`);
  
  const getDirname = () => {
    if (typeof __dirname !== 'undefined') {
      return __dirname;
    }
    return 'unknown';
  };
  
  console.log(`__dirname: ${getDirname()}`);
  console.log(`resourcesPath: ${(process as any).resourcesPath || 'not set'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✓ set' : '✗ not set'}`);
  console.log("=".repeat(60) + "\n");
}
