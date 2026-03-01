<template>
    <!-- Root container: full width & flex-grow, dark background -->
    <div class="w-full flex-1 flex flex-col overflow-hidden text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 relative">

        <!-- IF NO FILE AND NO HISTORY ITEM => show uploader -->
        <Uploader v-if="!currentFile && !historyItem" @drop="handleDrop" @file-selected="handleFileSelect" />

        <!-- ELSE (FILE SELECTED OR HISTORY ITEM SELECTED) => show main layout -->
        <div v-else class="flex-1 flex overflow-hidden">
            <!-- SIDEBAR -->
            <Sidebar v-if="currentFile" :currentFile="currentFile" :fileExtension="fileExtension"
                :uploadDate="uploadDate" :fileRowCount="fileRowCount" :fileColumns="fileColumns"
                :columnTypes="columnTypes" :csvOptions="csvOptions" :jsonOptions="jsonOptions"
                :importError="importError" :isLoadingFile="isLoadingFile"
                @recreate-table="recreateTable" @file-selected="handleFileSelect"
                @rename-column="handleColumnRename" @cast-column="handleColumnCast" />

            <!-- MAIN: Query Editor + Results -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <Query :query="query" :isLoading="isLoading" :queryStats="queryStats" :fileRowCount="fileRowCount"
                    @update:query="updateQuery" @run-query="runQuery" />

                <Results :queryResults="queryResults" :isLoading="isLoading" :isLoadingFile="isLoadingFile"
                    @download-results="downloadResults" />
            </div>
        </div>
    </div>
</template>

<script>
import { initDuckDB, executeQuery, resetDuckDB } from "@/services/duckdbService";
import { format as formatSQL } from "sql-formatter";
import { formatCell } from "@/utils/formatCell";
import Uploader from "./Uploader.vue";
import Sidebar from "./Sidebar.vue";
import Query from "./Query.vue";
import Results from "./Results.vue";

function safeStringify(obj) {
    return JSON.stringify(obj, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
    );
}

export default {
    name: "Interface",
    components: { Uploader, Sidebar, Query, Results },
    props: {
        historyItem: {
            type: Object,
            default: null,
        },
    },
    data() {
        return {
            currentFile: null,
            fileExtension: "",
            tableName: "",
            quotedTableName: "",

            query: "",
            queryResults: [],
            fileRowCount: null,
            fileColumns: [],

            isLoading: false,
            isLoadingFile: false,
            importError: null,

            csvOptions: {
                delimiter: ",",
                header: true,
                onError: "fail",
                quote: "\"",
                escape: "\"",
                skip: 0,
                comment: "",
            },

            jsonOptions: {
                format: "auto",
            },

            uploadTimestamp: null,
            dbInitialized: false,
            queryStats: null,
            columnTypes: {}, // map of column_name → DuckDB type from DESCRIBE
        };
    },
    computed: {
        uploadDate() {
            if (!this.uploadTimestamp) return "N/A";
            return new Date(this.uploadTimestamp).toLocaleString();
        },
    },
    watch: {
        historyItem(newVal) {
            if (newVal) {
                this.query = newVal.query;
                this.queryResults = newVal.results;
            }
        },
        queryResults(newVal) {
            localStorage.setItem("sqlchef-last-results", safeStringify(newVal));
        },
        query(newVal) {
            localStorage.setItem("sqlchef-last-query", newVal || "");
        },
    },
    async mounted() {
        try {
            await initDuckDB();
            this.dbInitialized = true;
        } catch (err) {
            console.error("Failed to initialize DuckDB:", err);
            this.importError = "Failed to initialize the database.";
        }

        const savedQuery = localStorage.getItem("sqlchef-last-query");
        if (savedQuery) this.query = savedQuery;

        const savedResults = localStorage.getItem("sqlchef-last-results");
        if (savedResults) {
            try { this.queryResults = JSON.parse(savedResults); } catch (err) {
                console.warn("Could not parse saved results:", err);
            }
        }
    },
    methods: {
        updateQuery(newQuery) {
            this.query = newQuery;
        },

        /* FILE HANDLING */
        handleDrop(files) {
            const newFile = files.find((f) => this.isStructuredFile(f));
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
            this.isLoadingFile = true;
            this.fileColumns = [];
            this.fileRowCount = null;
            this.columnTypes = {};

            try {
                await resetDuckDB();
                await initDuckDB();
                this.dbInitialized = true;
            } catch (err) {
                console.error("Re-init DB error:", err);
            }

            this.importError = null;
            this.currentFile = file;
            this.uploadTimestamp = Date.now();

            const ext = file.name.split(".").pop().toLowerCase();
            this.fileExtension = ext;

            const baseName = file.name.replace(/\.[^/.]+$/, "");
            this.tableName = baseName;
            this.quotedTableName = `"${baseName.replace(/"/g, '""')}"`;

            this.query = `SELECT * FROM ${this.quotedTableName} LIMIT 10;`;
            // Format the default query using the same options as the Format button
            try {
                this.query = formatSQL(this.query, { language: "sql", keywordCase: "upper" });
            } catch { /* leave unformatted if it fails */ }

            try {
                await this.createTableInDuckDB(file, ext);
                await this.runQuery();
            } catch (err) {
                console.error("Error loading file:", err);
                this.importError = err.message || String(err);
            } finally {
                this.isLoadingFile = false;
            }
        },
        async recreateTable() {
            if (!this.currentFile) return;
            this.importError = null;
            this.isLoadingFile = true;
            try {
                await this.createTableInDuckDB(this.currentFile, this.fileExtension);
                await this.runQuery();
            } catch (err) {
                console.error("Error re-parsing file:", err);
                this.importError = err.message || String(err);
            } finally {
                this.isLoadingFile = false;
            }
        },
        async createTableInDuckDB(file, ext) {
            const { db } = await initDuckDB();
            const buf = await file.arrayBuffer();
            const uint8 = new Uint8Array(buf);
            const virtualPath = "/" + file.name;
            await db.registerFileBuffer(virtualPath, uint8);

            let sql = "";
            if (["csv", "txt", "tsv"].includes(ext)) {
                const delim = this.csvOptions.delimiter || ",";
                const header = this.csvOptions.header ? "true" : "false";
                const ignoreErrors = (this.csvOptions.onError === "ignore" || this.csvOptions.onError === "replace") ? "TRUE" : "FALSE";
                const quote = this.csvOptions.quote !== undefined ? this.csvOptions.quote : "\"";
                const escape = this.csvOptions.escape !== undefined ? this.csvOptions.escape : "\"";
                const skip = this.csvOptions.skip || 0;
                const commentClause = this.csvOptions.comment ? `comment='${this.csvOptions.comment}'` : "comment=NULL";

                sql = `
                    CREATE OR REPLACE TABLE ${this.quotedTableName} AS
                    SELECT * FROM read_csv(
                        '${virtualPath}',
                        delim='${delim}',
                        header=${header},
                        quote='${quote}',
                        escape='${escape}',
                        skip=${skip},
                        ${commentClause},
                        ignore_errors=${ignoreErrors}
                    );
                `;
            } else if (ext === "json" || ext === "ndjson") {
                if (ext === "ndjson" || this.jsonOptions.format === "ndjson") {
                    sql = `CREATE OR REPLACE TABLE ${this.quotedTableName} AS SELECT * FROM read_ndjson('${virtualPath}');`;
                } else {
                    sql = `CREATE OR REPLACE TABLE ${this.quotedTableName} AS SELECT * FROM read_json_auto('${virtualPath}');`;
                }
            } else if (ext === "parquet") {
                sql = `CREATE OR REPLACE TABLE ${this.quotedTableName} AS SELECT * FROM read_parquet('${virtualPath}');`;
            } else {
                sql = `CREATE OR REPLACE TABLE ${this.quotedTableName} AS SELECT * FROM read_csv_auto('${virtualPath}');`;
            }

            if (sql) await executeQuery(sql);

            // Fetch column schema for display in the sidebar
            try {
                const described = await executeQuery(`DESCRIBE ${this.quotedTableName}`);
                this.columnTypes = Object.fromEntries(
                    described.map(r => [r.column_name, r.column_type])
                );
            } catch {
                this.columnTypes = {};
            }
        },

        async runQuery() {
            if (!this.dbInitialized) {
                alert("Database is still initializing. Please wait.");
                return;
            }
            if (this.isLoading) return;
            if (!this.query.trim()) return;

            this.isLoading = true;
            this.queryResults = [];
            this.queryStats = null;

            const startTime = performance.now();
            try {
                const results = await executeQuery(this.query);
                if (results.length) {
                    const headers = Object.keys(results[0]);
                    const rows = results.map((row) => Object.values(row));
                    this.queryResults = [headers, ...rows];
                    this.fileColumns = headers.map((colName) => ({ column_name: colName }));
                } else {
                    this.queryResults = [];
                    this.fileColumns = [];
                }
                const durationMs = performance.now() - startTime;
                this.fileRowCount = results.length;
                this.queryStats = { durationMs, rowsReturned: results.length };

                this.$emit("query-ran", { query: this.query, results: this.queryResults });
            } catch (err) {
                console.error("Query error:", err);
                alert(`Query error: ${err.message || err}`);
            } finally {
                this.isLoading = false;
            }
        },

        downloadResults() {
            if (!this.queryResults.length) return;

            const headers = this.queryResults[0];
            const rows = this.queryResults.slice(1);

            const escape = (val) => {
                const formatted = formatCell(val);
                const str = formatted == null ? "" : String(formatted);
                return `"${str.replace(/"/g, '""')}"`;
            };

            const csvContent = [
                headers.map(escape).join(","),
                ...rows.map((row) => row.map(escape).join(",")),
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
            try {
                await executeQuery(`
                    ALTER TABLE ${this.quotedTableName}
                    ALTER COLUMN "${columnName.replace(/"/g, '""')}"
                    TYPE ${newType};
                `);
                // Refresh schema after cast
                const described = await executeQuery(`DESCRIBE ${this.quotedTableName}`);
                this.columnTypes = Object.fromEntries(
                    described.map(r => [r.column_name, r.column_type])
                );
                await this.runQuery();
            } catch (err) {
                console.error("Error casting column:", err);
                this.importError = `Cannot cast "${columnName}" to ${newType}: ${err.message}`;
            }
        },

        async handleColumnRename({ oldName, newName }) {
            if (!newName || !oldName) return;
            if (newName.trim() === "" || newName === oldName) return;
            try {
                await executeQuery(`
                    ALTER TABLE ${this.quotedTableName}
                    RENAME COLUMN "${oldName.replace(/"/g, '""')}"
                    TO "${newName.replace(/"/g, '""')}";
                `);
                // Keep columnTypes in sync with the rename
                if (this.columnTypes[oldName] !== undefined) {
                    this.columnTypes[newName] = this.columnTypes[oldName];
                    delete this.columnTypes[oldName];
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
