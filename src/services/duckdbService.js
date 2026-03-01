import * as duckdb from "@duckdb/duckdb-wasm";

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
let verified = false;
let verificationDone = false;

async function verifySRI(buffer, sriHash) {
  const expected = Uint8Array.from(atob(sriHash.slice(7)), (c) =>
    c.charCodeAt(0)
  );
  const actual = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  return (
    actual.length === expected.length && actual.every((b, i) => b === expected[i])
  );
}

async function checkIntegrity() {
  if (verificationDone) return verified;
  verificationDone = true;
  try {
    const res = await fetch(`${BASE}duckdb/integrity.json`);
    if (!res.ok) return false;
    const manifest = await res.json();
    for (const file of [
      "duckdb-browser-mvp.worker.js",
      "duckdb-browser-eh.worker.js",
    ]) {
      const expected = manifest[file];
      if (!expected) return false;
      const fileRes = await fetch(`${BASE}duckdb/${file}`);
      if (!fileRes.ok) return false;
      if (!(await verifySRI(await fileRes.arrayBuffer(), expected)))
        return false;
    }
    return true;
  } catch (err) {
    console.warn("DuckDB integrity check error:", err);
    return false;
  }
}

function arrowTableToObjects(arrowTable) {
  const arrowRows = arrowTable.toArray();
  return arrowRows.map((row) => row.toJSON());
}

/**
 * Initialize DuckDB (if not already). Returns { db, connection, verified }
 * where verified indicates whether the worker files passed the SRI integrity check.
 */
export async function initDuckDB() {
  if (db && connection) {
    return { db, connection, verified };
  }
  if (initializing) {
    return initializing;
  }

  initializing = (async () => {
    verified = await checkIntegrity();

    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    connection = await db.connect();

    return { db, connection, verified };
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
 * Closes the existing connection and terminates DuckDB
 * (frees the WASM memory).
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
 * Reset DuckDB entirely by closing any open connection
 * and terminating the WASM instance. Use this before
 * re-initializing when loading a new large file.
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
  // verificationDone / verified intentionally preserved — files haven't changed
}
