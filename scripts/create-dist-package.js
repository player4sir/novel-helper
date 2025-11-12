import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// 确保 dist 目录存在
if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory not found. Run build first.');
  process.exit(1);
}

// 创建一个简单的 package.json 用于 dist 目录
const distPackageJson = {
  "type": "commonjs"
};

fs.writeFileSync(
  path.join(distDir, 'package.json'),
  JSON.stringify(distPackageJson, null, 2)
);

console.log('✓ Created dist/package.json (type: commonjs)');
