import fs from 'fs';
import path from 'path';

const srcDir = path.resolve(process.cwd(), 'src', 'web', 'public');
const destDir = path.resolve(process.cwd(), 'dist', 'web', 'public');

if (!fs.existsSync(srcDir)) {
  console.warn(`[copy-web-assets] source not found: ${srcDir}`);
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(srcDir, destDir, { recursive: true, force: true });
console.log(`[copy-web-assets] copied ${srcDir} -> ${destDir}`);
