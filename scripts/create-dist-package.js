
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const distPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    author: packageJson.author,
    license: packageJson.license,
    main: 'index.js',
    type: 'commonjs',
    dependencies: packageJson.dependencies,
};

fs.writeFileSync(
    path.join(distDir, 'package.json'),
    JSON.stringify(distPackageJson, null, 2)
);

console.log('Created dist/package.json');
