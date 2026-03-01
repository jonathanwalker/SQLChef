<template>
    <div class="w-full flex-1 flex flex-col overflow-hidden text-gray-800 dark:text-zinc-200 bg-gray-50 dark:bg-zinc-900 relative">

        <!-- TAB BAR — only shown when 2+ sessions -->
        <div v-if="sessions.length > 1" class="flex items-center bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 shrink-0">
            <!-- Scrollable tab strip — keeps + always visible outside -->
            <div class="flex-1 flex overflow-x-auto min-w-0" style="scrollbar-width: none; -ms-overflow-style: none;">
                <div
                    v-for="s in sessions"
                    :key="s.id"
                    role="button"
                    tabindex="0"
                    class="group relative flex items-center gap-1.5 px-3 py-2 shrink-0 text-xs border-b-2 cursor-pointer transition-colors duration-100"
                    style="max-width: 180px; min-width: 80px"
                    :class="s.id === activeSessionId
                        ? 'border-emerald-500 text-gray-900 dark:text-zinc-100 bg-gray-50 dark:bg-zinc-900'
                        : 'border-transparent text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-900'"
                    @click="renamingSessionId !== s.id && switchSession(s.id)"
                    @keydown.enter="switchSession(s.id)"
                >
                    <span class="h-1.5 w-1.5 rounded-full shrink-0" :class="s.file ? extensionDot(s.fileExtension) : 'bg-gray-300 dark:bg-zinc-600'"></span>
                    <!-- Inline rename input -->
                    <input
                        v-if="renamingSessionId === s.id"
                        v-model="renameValue"
                        type="text"
                        class="tab-rename-input flex-1 min-w-0 bg-transparent border-none outline-none text-xs w-24 text-gray-900 dark:text-zinc-100"
                        @click.stop
                        @keydown.enter.stop="finishRename(s.id)"
                        @keydown.esc.stop="renamingSessionId = null"
                        @blur="finishRename(s.id)"
                    />
                    <!-- Label — double-click to rename -->
                    <span v-else class="truncate flex-1" @dblclick.stop="startRename(s)">
                        {{ s.label || (s.file ? s.file.name : 'New Tab') }}
                    </span>
                    <!-- Close button -->
                    <span
                        class="shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center h-3.5 w-3.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-opacity duration-100"
                        @click.stop="closeSession(s.id)"
                        title="Close tab"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </span>
                </div>
            </div>
            <!-- Pinned + button — always reachable even when tabs overflow -->
            <button
                class="flex items-center justify-center h-7 w-7 shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors duration-100 mx-1 my-1"
                @click="addEmptySession"
                title="New tab"
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
            </button>
        </div>

        <!-- Single-tab: labeled new tab button at top-right -->
        <button
            v-if="sessions.length <= 1"
            class="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-gray-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:text-gray-800 dark:hover:text-zinc-100 hover:border-gray-300 dark:hover:border-zinc-500 shadow-sm transition-colors duration-150"
            @click="addEmptySession"
            title="Open a second file in a new tab"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New tab
        </button>

        <!-- Uploader: active session has no file and no results -->
        <Uploader
            v-if="!activeSession || (!activeSession.file && !activeSession.queryResults.length)"
            @drop="handleDrop"
            @file-selected="handleFileSelect"
        />

        <!-- Main layout: file loaded or history results visible -->
        <div v-else class="flex-1 flex overflow-hidden">
            <Sidebar
                v-if="activeSession.file"
                :currentFile="activeSession.file"
                :fileExtension="activeSession.fileExtension"
                :uploadDate="uploadDate"
                :fileRowCount="activeSession.fileRowCount"
                :fileColumns="activeSession.fileColumns"
                :columnTypes="activeSession.columnTypes"
                :csvOptions="activeSession.csvOptions"
                :jsonOptions="activeSession.jsonOptions"
                :importError="activeSession.importError"
                :isLoadingFile="activeSession.isLoadingFile"
                @recreate-table="recreateTable"
                @file-selected="handleFileSelect"
                @rename-column="handleColumnRename"
                @cast-column="handleColumnCast"
            />

            <div class="flex-1 flex flex-col overflow-hidden">
                <Query
                    :query="activeSession.query"
                    :isLoading="activeSession.isLoading"
                    :queryStats="activeSession.queryStats"
                    :fileRowCount="activeSession.fileRowCount"
                    @update:query="updateQuery"
                    @run-query="runQuery"
                />
                <Results
                    :queryResults="activeSession.queryResults"
                    :isLoading="activeSession.isLoading"
                    :isLoadingFile="activeSession.isLoadingFile"
                    @download-results="downloadResults"
                />
            </div>
        </div>

    </div>
</template>

<script>
import { initDuckDB, executeQuery } from "@/services/duckdbService";
import { format as formatSQL } from "sql-formatter";
import { formatCell } from "@/utils/formatCell";
import Uploader from "./Uploader.vue";
import Sidebar from "./Sidebar.vue";
import Query from "./Query.vue";
import Results from "./Results.vue";

let sessionCounter = 0;
function makeSession() {
    return {
        id: ++sessionCounter,
        label: null,
        file: null,
        fileExtension: "",
        tableName: "",
        quotedTableName: "",
        query: "",
        queryResults: [],
        fileRowCount: null,
        fileColumns: [],
        csvOptions: { delimiter: ",", header: true, onError: "fail", quote: "\"", escape: "\"", skip: 0, comment: "" },
        jsonOptions: { format: "auto" },
        importError: null,
        queryStats: null,
        columnTypes: {},
        uploadTimestamp: null,
        isLoading: false,
        isLoadingFile: false,
    };
}

export default {
    name: "Interface",
    components: { Uploader, Sidebar, Query, Results },
    props: {
        historyItem: { type: Object, default: null },
    },
    data() {
        return {
            sessions: [],
            activeSessionId: null,
            dbInitialized: false,
            renamingSessionId: null,
            renameValue: '',
        };
    },
    computed: {
        activeSession() {
            return this.sessions.find(s => s.id === this.activeSessionId) || null;
        },
        uploadDate() {
            if (!this.activeSession?.uploadTimestamp) return "N/A";
            return new Date(this.activeSession.uploadTimestamp).toLocaleString();
        },
    },
    watch: {
        historyItem(newVal) {
            if (newVal) {
                if (!this.activeSession) this.addEmptySession();
                this.activeSession.query = newVal.query;
                this.activeSession.queryResults = newVal.results;
            }
        },
    },
    async mounted() {
        this.addEmptySession();

        try {
            await initDuckDB();
            this.dbInitialized = true;
        } catch (err) {
            console.error("Failed to initialize DuckDB:", err);
            this.activeSession.importError = "Failed to initialize the database.";
        }

    },
    methods: {
        /* SESSION MANAGEMENT */
        makeEmptySession() {
            return makeSession();
        },
        addEmptySession() {
            const s = makeSession();
            this.sessions.push(s);
            this.activeSessionId = s.id;
            return s;
        },
        switchSession(id) {
            this.activeSessionId = id;
        },
        async closeSession(id) {
            const idx = this.sessions.findIndex(s => s.id === id);
            if (idx === -1) return;

            const session = this.sessions[idx];

            // Drop the DuckDB table for this session
            if (session.quotedTableName) {
                try { await executeQuery(`DROP TABLE IF EXISTS ${session.quotedTableName}`); } catch { /* ignore */ }
            }

            // Switch active to an adjacent session before removing
            if (this.activeSessionId === id) {
                const neighbor = this.sessions[idx - 1] || this.sessions[idx + 1];
                this.activeSessionId = neighbor ? neighbor.id : null;
            }

            this.sessions.splice(idx, 1);

            // Always keep at least one tab — create a fresh empty one if needed
            if (this.sessions.length === 0) {
                this.addEmptySession();
            }
        },

        extensionDot(ext) {
            const map = {
                csv: 'bg-emerald-400', tsv: 'bg-emerald-400', txt: 'bg-emerald-400',
                json: 'bg-blue-400', ndjson: 'bg-blue-400',
                parquet: 'bg-purple-400',
            };
            return map[ext] || 'bg-gray-400';
        },

        startRename(session) {
            if (session.id !== this.activeSessionId) this.switchSession(session.id);
            this.renameValue = session.label || (session.file ? session.file.name : 'New Tab');
            this.renamingSessionId = session.id;
            this.$nextTick(() => {
                const input = this.$el.querySelector('.tab-rename-input');
                if (input) { input.focus(); input.select(); }
            });
        },
        finishRename(id) {
            if (this.renamingSessionId !== id) return;
            const session = this.sessions.find(s => s.id === id);
            if (session) session.label = this.renameValue.trim() || null;
            this.renamingSessionId = null;
        },

        updateQuery(newQuery) {
            if (this.activeSession) this.activeSession.query = newQuery;
        },

        /* FILE HANDLING */
        handleDrop(files) {
            const newFile = files.find(f => this.isStructuredFile(f));
            if (!newFile) {
                alert("Please drop a valid structured file (CSV, TSV, TXT, JSON, NDJSON, or Parquet).");
                return;
            }
            this.proceedToAnalysis(newFile);
        },
        handleFileSelect(file) {
            if (file && this.isStructuredFile(file)) {
                this.proceedToAnalysis(file);
            } else {
                alert("Invalid file type. Must be CSV, TSV, TXT, JSON, NDJSON, or Parquet.");
            }
        },
        isStructuredFile(file) {
            const ext = file.name.split(".").pop().toLowerCase();
            return ["csv", "tsv", "txt", "json", "ndjson", "parquet"].includes(ext);
        },

        async proceedToAnalysis(file) {
            // Always fill the current active session (never resets other sessions)
            if (!this.activeSession) this.addEmptySession();
            const session = this.activeSession;

            session.isLoadingFile = true;
            session.fileColumns = [];
            session.fileRowCount = null;
            session.columnTypes = {};
            session.importError = null;

            // Drop old table for this session before replacing it
            if (session.quotedTableName) {
                try { await executeQuery(`DROP TABLE IF EXISTS ${session.quotedTableName}`); } catch { /* ignore */ }
            }

            if (!this.dbInitialized) {
                try {
                    await initDuckDB();
                    this.dbInitialized = true;
                } catch (err) {
                    console.error("DB init error:", err);
                }
            }

            session.file = file;
            session.uploadTimestamp = Date.now();

            const ext = file.name.split(".").pop().toLowerCase();
            session.fileExtension = ext;

            const baseName = file.name.replace(/\.[^/.]+$/, "");
            session.tableName = baseName;
            session.quotedTableName = `"${baseName.replace(/"/g, '""')}"`;

            session.query = `SELECT * FROM ${session.quotedTableName} LIMIT 10;`;
            try {
                session.query = formatSQL(session.query, { language: "sql", keywordCase: "upper" });
            } catch { /* leave unformatted */ }

            try {
                await this.createTableInDuckDB(file, ext);
                await this.runQuery();
            } catch (err) {
                console.error("Error loading file:", err);
                session.importError = err.message || String(err);
            } finally {
                session.isLoadingFile = false;
            }
        },

        async recreateTable() {
            const session = this.activeSession;
            if (!session?.file) return;
            session.importError = null;
            session.isLoadingFile = true;
            try {
                await this.createTableInDuckDB(session.file, session.fileExtension);
                await this.runQuery();
            } catch (err) {
                console.error("Error re-parsing file:", err);
                session.importError = err.message || String(err);
            } finally {
                session.isLoadingFile = false;
            }
        },

        async createTableInDuckDB(file, ext) {
            const session = this.activeSession;
            const { db } = await initDuckDB();
            const buf = await file.arrayBuffer();
            const uint8 = new Uint8Array(buf);
            const virtualPath = "/" + file.name;
            await db.registerFileBuffer(virtualPath, uint8);

            let sql = "";
            if (["csv", "txt", "tsv"].includes(ext)) {
                const { delimiter, header, onError, quote, escape, skip, comment } = session.csvOptions;
                const delim = delimiter || ",";
                const headerVal = header ? "true" : "false";
                const ignoreErrors = (onError === "ignore" || onError === "replace") ? "TRUE" : "FALSE";
                const quoteVal = quote !== undefined ? quote : "\"";
                const escapeVal = escape !== undefined ? escape : "\"";
                const skipVal = skip || 0;
                const commentClause = comment ? `comment='${comment}'` : "comment=NULL";
                sql = `
                    CREATE OR REPLACE TABLE ${session.quotedTableName} AS
                    SELECT * FROM read_csv(
                        '${virtualPath}',
                        delim='${delim}',
                        header=${headerVal},
                        quote='${quoteVal}',
                        escape='${escapeVal}',
                        skip=${skipVal},
                        ${commentClause},
                        ignore_errors=${ignoreErrors}
                    );
                `;
            } else if (ext === "json" || ext === "ndjson") {
                if (ext === "ndjson" || session.jsonOptions.format === "ndjson") {
                    sql = `CREATE OR REPLACE TABLE ${session.quotedTableName} AS SELECT * FROM read_ndjson('${virtualPath}');`;
                } else {
                    sql = `CREATE OR REPLACE TABLE ${session.quotedTableName} AS SELECT * FROM read_json_auto('${virtualPath}');`;
                }
            } else if (ext === "parquet") {
                sql = `CREATE OR REPLACE TABLE ${session.quotedTableName} AS SELECT * FROM read_parquet('${virtualPath}');`;
            } else {
                sql = `CREATE OR REPLACE TABLE ${session.quotedTableName} AS SELECT * FROM read_csv_auto('${virtualPath}');`;
            }

            if (sql) await executeQuery(sql);

            try {
                const described = await executeQuery(`DESCRIBE ${session.quotedTableName}`);
                session.columnTypes = Object.fromEntries(
                    described.map(r => [r.column_name, r.column_type])
                );
            } catch {
                session.columnTypes = {};
            }
        },

        async runQuery() {
            const session = this.activeSession;
            if (!session) return;
            if (!this.dbInitialized) {
                alert("Database is still initializing. Please wait.");
                return;
            }
            if (session.isLoading) return;
            if (!session.query.trim()) return;

            session.isLoading = true;
            session.queryResults = [];
            session.queryStats = null;

            const startTime = performance.now();
            try {
                const results = await executeQuery(session.query);
                if (results.length) {
                    const headers = Object.keys(results[0]);
                    const rows = results.map(row => Object.values(row));
                    session.queryResults = [headers, ...rows];
                    session.fileColumns = headers.map(colName => ({ column_name: colName }));
                } else {
                    session.queryResults = [];
                    session.fileColumns = [];
                }
                const durationMs = performance.now() - startTime;
                session.fileRowCount = results.length;
                session.queryStats = { durationMs, rowsReturned: results.length };

                this.$emit("query-ran", { query: session.query, results: session.queryResults });
            } catch (err) {
                console.error("Query error:", err);
                alert(`Query error: ${err.message || err}`);
            } finally {
                session.isLoading = false;
            }
        },

        downloadResults() {
            const session = this.activeSession;
            if (!session?.queryResults.length) return;

            const headers = session.queryResults[0];
            const rows = session.queryResults.slice(1);

            const escape = (val) => {
                const formatted = formatCell(val);
                const str = formatted == null ? "" : String(formatted);
                return `"${str.replace(/"/g, '""')}"`;
            };

            const csvContent = [
                headers.map(escape).join(","),
                ...rows.map(row => row.map(escape).join(",")),
            ].join("\n");

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", "query_results.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },

        async handleColumnCast({ columnName, newType }) {
            const session = this.activeSession;
            try {
                await executeQuery(`
                    ALTER TABLE ${session.quotedTableName}
                    ALTER COLUMN "${columnName.replace(/"/g, '""')}"
                    TYPE ${newType};
                `);
                const described = await executeQuery(`DESCRIBE ${session.quotedTableName}`);
                session.columnTypes = Object.fromEntries(
                    described.map(r => [r.column_name, r.column_type])
                );
                await this.runQuery();
            } catch (err) {
                console.error("Error casting column:", err);
                session.importError = `Cannot cast "${columnName}" to ${newType}: ${err.message}`;
            }
        },

        async handleColumnRename({ oldName, newName }) {
            const session = this.activeSession;
            if (!newName || !oldName) return;
            if (newName.trim() === "" || newName === oldName) return;
            try {
                await executeQuery(`
                    ALTER TABLE ${session.quotedTableName}
                    RENAME COLUMN "${oldName.replace(/"/g, '""')}"
                    TO "${newName.replace(/"/g, '""')}";
                `);
                if (session.columnTypes[oldName] !== undefined) {
                    session.columnTypes[newName] = session.columnTypes[oldName];
                    delete session.columnTypes[oldName];
                }
                await this.runQuery();
            } catch (err) {
                console.error("Error renaming column:", err);
                alert("Error renaming column: " + err.message);
            }
        },
    },
};
</script>
