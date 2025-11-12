// Reference: javascript_database integration blueprint
/// <reference path="./electron-types.d.ts" />
import path from "path";
import { fileURLToPath } from "url";
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import fs from "fs";

// 智能加载 .env 文件
// 兼容 ESM 和 CommonJS
const getFilename = () => {
  // CommonJS 环境
  if (typeof __filename !== 'undefined') {
    return __filename;
  }
  return '';
};

const getDirname = () => {
  // CommonJS 环境
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  return process.cwd();
};

const currentFilename = getFilename();
const currentDirname = getDirname();

// 尝试多个可能的 .env 路径
const envPaths = [
  path.join(currentDirname, '../.env'),           // 开发环境
  path.join(process.cwd(), '.env'),               // 当前工作目录
  path.join(currentDirname, '../../.env'),        // 打包后的位置
  path.join((process as any).resourcesPath || '', '.env'), // Electron resources
  process.env.DOTENV_CONFIG_PATH                  // 从环境变量指定
].filter(Boolean);

let envLoaded = false;

// 手动加载环境变量（兼容所有环境）
for (const envPath of envPaths) {
  if (envPath && fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach((line: string) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0 && !process.env[key.trim()]) {
            process.env[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
      console.log(`✓ Loaded .env from: ${envPath}`);
      envLoaded = true;
      break;
    } catch (err) {
      console.warn(`Failed to load ${envPath}:`, err);
    }
  }
}

if (!envLoaded) {
  console.warn('⚠ No .env file found, using environment variables');
}

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
