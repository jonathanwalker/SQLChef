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
let initializing = null; // Flag to track initialization

function arrowTableToObjects(arrowTable) {
  const arrowRows = arrowTable.toArray();
  return arrowRows.map((row) => row.toJSON());
}

/**
 * Initialize DuckDB (if not already).
 */
export async function initDuckDB() {
  // Already connected? Return it
  if (db && connection) {
    return { db, connection };
  }
  // If already initializing, await the same promise
  if (initializing) {
    return initializing;
  }

  // Otherwise, begin the async init
  initializing = (async () => {
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);

    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    // Create a single connection
    connection = await db.connect();

    return { db, connection };
  })();

  // After initialization completes, clear the "initializing" flag
  try {
    const result = await initializing;
    return result;
  } finally {
    initializing = null;
  }
}

/**
 * Execute a SQL query and return rows as an array of objects.
 */
export async function executeQuery(sql) {
  // Ensure DB is ready
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
  // Safely close
  if (connection) {
    try {
      await connection.close();
    } catch (err) {
      console.warn("Error closing DuckDB connection:", err);
    }
    connection = null;
  }
  // Terminate WASM
  if (db) {
    await db.terminate();
    db = null;
  }
}
