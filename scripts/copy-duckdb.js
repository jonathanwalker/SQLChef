import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(root, 'node_modules/@duckdb/duckdb-wasm/dist');
const DEST = resolve(root, 'public/duckdb');

// Read the exact installed version so the app can later verify against the matching CDN release.
const { version: duckdbVersion } = JSON.parse(
  readFileSync(resolve(root, 'node_modules/@duckdb/duckdb-wasm/package.json'), 'utf-8')
);

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

// _version is used at runtime to build the CDN URL for independent IDS verification.
const integrityWithMeta = { _version: duckdbVersion, ...integrity };
writeFileSync(resolve(DEST, 'integrity.json'), JSON.stringify(integrityWithMeta, null, 2) + '\n');
console.log(`  wrote public/duckdb/integrity.json (duckdb-wasm@${duckdbVersion})`);
