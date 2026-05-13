/**
 * Remove Git merge conflict markers, keeping the HEAD side of each conflict.
 * Skips node_modules and .git.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

function shouldScanFile(name) {
  return (
    name.endsWith('.js') ||
    name.endsWith('.jsx') ||
    name.endsWith('.mjs') ||
    name.endsWith('.css') ||
    name.endsWith('.json') ||
    name === '.env'
  );
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && shouldScanFile(ent.name)) out.push(p);
  }
}

const re = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n[\s\S]*?>>>>>>> [^\r\n]+\r?\n?/g;

const files = [];
walk(root, files);

let changed = 0;
for (const p of files) {
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('<<<<<<< HEAD')) continue;
  const next = s.replace(re, (_, head) => head.replace(/^\uFEFF/gm, ''));
  if (next !== s) {
    fs.writeFileSync(p, next, 'utf8');
    changed++;
    console.log('resolved:', path.relative(root, p));
  }
}

console.log('done, files updated:', changed);
