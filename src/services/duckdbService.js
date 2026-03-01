import * as duckdb from "@duckdb/duckdb-wasm";
// Hashes are imported as a static JSON module — Vite bakes them into the JS bundle
// at build time. This means the expected hashes ship alongside the app code and
// cannot be swapped out by a compromised server independently of the bundle itself.
import EXPECTED from "../../public/duckdb/integrity.json";

const BASE = import.meta.env.BASE_URL;

const MANUAL_BUNDLES = {
  mvp: {
    mainModule: `${BASE}duckdb/duckdb-mvp.wasm`,
    mainWorker: `${BASE}duckdb/duckdb-browser-mvp.worker.js`,
  },
  eh: {
    mainModule: `${BASE}duckdb/duckdb-eh.wasm`,
    mainWorker: `${BASE}duckdb/duckdb-browser-eh.worker.js`,
  },
};

let db = null;
let connection = null;
let initializing = null;

// Cached blob URLs survive resetDuckDB() — the files on disk haven't changed,
// so we verify once and reuse the blobs for subsequent inits.
let cachedBlobs = null; // { mainModule, mainWorker, pthreadWorker, wasmHash, wasmFile }

/**
 * Verify an ArrayBuffer against a sha256-<base64> SRI hash.
 * Throws if the hash does not match.
 */
async function verifySRI(buffer, sriHash, label) {
  const expectedBytes = Uint8Array.from(atob(sriHash.slice(7)), (c) =>
    c.charCodeAt(0)
  );
  const actualBytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", buffer)
  );
  const ok =
    actualBytes.length === expectedBytes.length &&
    actualBytes.every((b, i) => b === expectedBytes[i]);
  if (!ok) {
    throw new Error(
      `Integrity check FAILED for ${label}. ` +
        `Expected ${sriHash} but the downloaded file did not match. ` +
        `Do not trust the output of this session.`
    );
  }
}

/**
 * Fetch a file, verify its SHA-256 hash against the build-time manifest,
 * then return a blob: URL pointing to the verified bytes.
 *
 * Using a blob URL means:
 *  - We only download the file once.
 *  - The DuckDB worker receives the bytes we already verified — it cannot
 *    silently swap in a different file.
 *  - No external network request is made; everything stays in this tab.
 */
async function fetchVerifyBlob(url, filename, mimeType) {
  const expected = EXPECTED[filename];
  if (!expected) {
    throw new Error(
      `No expected hash found in build manifest for "${filename}". ` +
        `Re-run "npm run copy-duckdb" and rebuild the app.`
    );
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${filename}: HTTP ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  await verifySRI(buffer, expected, filename); // throws on mismatch
  return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
}

/**
 * Select the best bundle for this browser, fetch every file, verify each
 * against the build-time manifest, and return blob: URLs + the WASM hash
 * for display. Results are cached so resetDuckDB() can reinit without
 * re-downloading or re-verifying.
 */
async function buildVerifiedBlobUrls() {
  if (cachedBlobs) return cachedBlobs;

  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  const wasmFile = bundle.mainModule.split("/").pop();   // e.g. duckdb-eh.wasm
  const workerFile = bundle.mainWorker.split("/").pop(); // e.g. duckdb-browser-eh.worker.js

  // Verify the WASM and the worker JS in parallel — both must pass.
  const [mainModuleBlob, mainWorkerBlob] = await Promise.all([
    fetchVerifyBlob(bundle.mainModule, wasmFile, "application/wasm"),
    fetchVerifyBlob(bundle.mainWorker, workerFile, "application/javascript"),
  ]);

  cachedBlobs = {
    mainModule: mainModuleBlob,
    mainWorker: mainWorkerBlob,
    pthreadWorker: bundle.pthreadWorker ?? null,
    wasmHash: EXPECTED[wasmFile], // sha256-<base64> — shown in UI tooltip
    wasmFile: wasmFile,           // e.g. "duckdb-eh.wasm" — used for CDN IDS check
  };
  return cachedBlobs;
}

// Apache Arrow TimeUnit constants (SECOND=0, MILLISECOND=1, MICROSECOND=2, NANOSECOND=3)
const TimeUnit = { SECOND: 0, MILLISECOND: 1, MICROSECOND: 2, NANOSECOND: 3 };

/**
 * Build a per-column converter based on the Arrow schema type, or null if no
 * conversion is needed. This runs once per query, not once per row/cell.
 *
 * Why this matters: DuckDB returns both BIGINT *and* TIMESTAMP columns as JS
 * BigInt. Without schema-level type info we'd have to guess from value ranges,
 * which causes COUNT() results (small integers) to be misidentified as dates.
 * The Arrow schema tells us definitively which columns are timestamps.
 *
 * DuckDB DATE columns come back as plain Int32 (days since epoch) — also not
 * human-readable without conversion.
 */
function buildColumnConverter(field) {
    const typeStr = field.type?.toString() ?? '';

    // Timestamp<MICROSECOND>, Timestamp<SECOND>, etc.
    if (typeStr.startsWith('Timestamp')) {
        const unit = field.type.unit ?? TimeUnit.MICROSECOND;
        return (value) => {
            if (value == null) return null;
            try {
                if (typeof value === 'bigint') {
                    if (unit === TimeUnit.MICROSECOND) return new Date(Number(value / 1000n));
                    if (unit === TimeUnit.NANOSECOND)  return new Date(Number(value / 1_000_000n));
                    // SECOND or MILLISECOND as bigint (unusual but handle it)
                    return new Date(Number(value) * (unit === TimeUnit.SECOND ? 1000 : 1));
                } else {
                    if (unit === TimeUnit.SECOND)      return new Date(value * 1000);
                    if (unit === TimeUnit.MILLISECOND) return new Date(value);
                    return new Date(value);
                }
            } catch { return value; }
        };
    }

    // DateDay (Int32 days since Unix epoch)
    if (typeStr === 'DateDay') {
        return (value) => {
            if (value == null) return null;
            try { return new Date(value * 86_400_000); } catch { return value; }
        };
    }

    // DateMillisecond (rare, but handle it)
    if (typeStr === 'DateMillisecond') {
        return (value) => {
            if (value == null) return null;
            try { return new Date(value); } catch { return value; }
        };
    }

    return null; // no conversion — includes BIGINT, INTEGER, VARCHAR, etc.
}

function arrowTableToObjects(arrowTable) {
    const fields = arrowTable.schema.fields;
    const rows = arrowTable.toArray();

    // Pre-build converters once per query result (not once per cell)
    const converters = fields.map(buildColumnConverter);
    const hasConverters = converters.some(Boolean);

    return rows.map((row) => {
        const obj = row.toJSON();
        if (hasConverters) {
            for (let i = 0; i < fields.length; i++) {
                if (converters[i] !== null) {
                    obj[fields[i].name] = converters[i](obj[fields[i].name]);
                }
            }
        }
        return obj;
    });
}

/**
 * Initialize DuckDB. Verifies the WASM and worker files against hashes that
 * were baked into the app bundle at build time. Throws if any file fails
 * verification — never silently continues with unverified code.
 *
 * Returns { db, connection, wasmHash } where wasmHash is the sha256-<base64>
 * SRI hash of the WASM file that was actually loaded.
 */
export async function initDuckDB() {
  if (db && connection) {
    return { db, connection, wasmHash: cachedBlobs?.wasmHash };
  }
  if (initializing) {
    return initializing;
  }

  initializing = (async () => {
    // This throws on any integrity failure — no silent fallback.
    const blobs = await buildVerifiedBlobUrls();

    const worker = new Worker(blobs.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(blobs.mainModule, blobs.pthreadWorker);
    connection = await db.connect();

    return { db, connection, wasmHash: blobs.wasmHash };
  })();

  try {
    return await initializing;
  } finally {
    initializing = null;
  }
}

/**
 * Execute a SQL query and return rows as an array of objects.
 */
export async function executeQuery(sql) {
  if (!connection) {
    await initDuckDB();
  }
  const arrowTable = await connection.query(sql);
  return arrowTableToObjects(arrowTable);
}

/**
 * Closes the existing connection and terminates DuckDB (frees WASM memory).
 */
export async function closeDuckDB() {
  if (connection) {
    await connection.close();
    connection = null;
  }
  if (db) {
    await db.terminate();
    db = null;
  }
}

/**
 * Returns metadata about the loaded WASM for display and IDS verification.
 */
export function getWasmInfo() {
  return {
    wasmFile: cachedBlobs?.wasmFile ?? null,
    wasmHash: cachedBlobs?.wasmHash ?? null,
    version:  EXPECTED._version ?? null,
  };
}

/**
 * Compute a sha256-<base64> SRI hash for an arbitrary ArrayBuffer.
 * Used by the independent verification (IDS) check in the UI.
 */
export async function computeSHA256SRI(buffer) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `sha256-${btoa(binary)}`;
}

/**
 * Reset DuckDB (close connection + terminate WASM) without re-verifying.
 * The blob URLs are reused — the files on disk haven't changed.
 */
export async function resetDuckDB() {
  if (connection) {
    try {
      await connection.close();
    } catch (err) {
      console.warn("Error closing DuckDB connection:", err);
    }
    connection = null;
  }
  if (db) {
    await db.terminate();
    db = null;
  }
  // cachedBlobs intentionally preserved — verified once, reused on reinit.
}
