import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(root, 'node_modules/@duckdb/duckdb-wasm/dist');
const DEST = resolve(root, 'public/duckdb');

const FILES = [
  'duckdb-mvp.wasm',
  'duckdb-eh.wasm',
  'duckdb-browser-mvp.worker.js',
  'duckdb-browser-eh.worker.js',
];

mkdirSync(DEST, { recursive: true });

const integrity = {};

for (const file of FILES) {
  const src = resolve(DIST, file);
  const dst = resolve(DEST, file);
  copyFileSync(src, dst);
  const hash = createHash('sha256').update(readFileSync(src)).digest('base64');
  integrity[file] = `sha256-${hash}`;
  console.log(`  copied ${file}`);
}

writeFileSync(resolve(DEST, 'integrity.json'), JSON.stringify(integrity, null, 2) + '\n');
console.log('  wrote public/duckdb/integrity.json');
