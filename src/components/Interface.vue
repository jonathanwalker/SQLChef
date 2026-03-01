<template>
    <!-- Root container: full width & flex-grow, dark background -->
    <div class="w-full flex-1 flex flex-col overflow-hidden text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 relative">

        <!-- IF NO FILE AND NO HISTORY ITEM => show uploader -->
        <Uploader v-if="!currentFile && !historyItem" @dragover="handleDragOver" @drop="handleDrop"
            @file-selected="handleFileSelect" />

        <!-- ELSE (FILE SELECTED OR HISTORY ITEM SELECTED) => show main layout -->
        <div v-else class="flex-1 flex overflow-hidden">
            <!-- SIDEBAR -->
            <Sidebar v-if="currentFile" :currentFile="currentFile" :fileExtension="fileExtension"
                :uploadDate="uploadDate" :fileRowCount="fileRowCount" :fileColumns="fileColumns"
                :csvOptions="csvOptions" :jsonOptions="jsonOptions" :importError="importError"
                :isLoadingFile="isLoadingFile" @recreate-table="recreateTable" @file-selected="handleFileSelect"
                @rename-column="handleColumnRename" />

            <!-- MAIN: Query Editor + Results -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <Query :query="query" :isLoading="isLoading" :queryStats="queryStats" :fileRowCount="fileRowCount"
                    @update:query="updateQuery" @run-query="runQuery" @format-query="beautifySQL"
                    @insert-newline="insertNewline" />

                <Results :queryResults="queryResults" :isLoading="isLoading" :isLoadingFile="isLoadingFile"
                    @download-results="downloadResults" />
            </div>
        </div>

        <!-- Hidden file input for replacing files -->
        <input type="file" ref="fileInputReplace" class="hidden" @change="handleFileReplace" />
    </div>
</template>

<script>
import { initDuckDB, executeQuery, resetDuckDB } from "@/services/duckdbService";
import { format as formatSQL } from "sql-formatter";
import Uploader from "./Uploader.vue";
import Sidebar from "./Sidebar.vue";
import Query from "./Query.vue";
import Results from "./Results.vue";

/**
 * Safe JSON stringifier for results (handles BigInt).
 */
function safeStringify(obj) {
    return JSON.stringify(obj, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
    );
}

export default {
    name: "Interface",
    components: {
        Uploader,
        Sidebar,
        Query,
        Results,
    },
    props: {
        // If the user selects a history item in the modal,
        // it passes down here to restore the query & results
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
            fileRowCount: null,     // We'll store # of rows returned from the last query
            fileColumns: [],        // We'll store columns from the last query's headers

            isLoading: false,       // True while a query is running
            isLoadingFile: false,   // True while a file is being loaded (or re-parsed)
            importError: null,

            // CSV parse
            csvOptions: {
                delimiter: ",",
                header: true,
                onError: "fail", // 'fail', 'ignore', or 'replace'
                quote: "\"",
                escape: "\"",
                skip: 0,
                comment: "",
            },

            // JSON parse
            jsonOptions: {
                format: "auto",
            },

            // Additional File Details
            uploadTimestamp: null,

            // Flag to indicate DB is ready
            dbInitialized: false,

            // We'll store stats from the last query here (time, rows returned, etc.)
            queryStats: null,
        };
    },
    computed: {
        uploadDate() {
            if (!this.uploadTimestamp) return "N/A";
            const date = new Date(this.uploadTimestamp);
            return date.toLocaleString();
        },
    },
    watch: {
        // If parent sets historyItem, restore that query & results
        historyItem(newVal) {
            if (newVal) {
                this.query = newVal.query;
                this.queryResults = newVal.results;
            }
        },
        // Persist query results & text in localStorage
        queryResults(newVal) {
            localStorage.setItem("sqlchef-last-results", safeStringify(newVal));
        },
        query(newVal) {
            localStorage.setItem("sqlchef-last-query", newVal || "");
        },
    },
    async mounted() {
        try {
            await initDuckDB(); // Pre-initialize DuckDB
            this.dbInitialized = true;
            console.log("DuckDB initialized successfully.");
        } catch (err) {
            console.error("Failed to initialize DuckDB:", err);
            this.importError = "Failed to initialize the database.";
        }

        // Restore last query/results from localStorage
        const savedResults = localStorage.getItem("sqlchef-last-results");
        if (savedResults) {
            try {
                this.queryResults = JSON.parse(savedResults);
            } catch (err) {
                console.warn("Could not parse saved results:", err);
            }
        }
    },
    methods: {
        /**
         * SHIFT+ENTER => newline; ENTER => run query
         */
        insertNewline() {
            const textarea = this.$el.querySelector("textarea");
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                this.query = this.query.slice(0, start) + "\n" + this.query.slice(end);
                this.$nextTick(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + 1;
                });
            }
        },
        updateQuery(newQuery) {
            this.query = newQuery;
        },
        beautifySQL() {
            try {
                this.query = formatSQL(this.query, {
                    language: "sql",
                    uppercase: true,
                });
            } catch (err) {
                console.warn("SQL Beautify failed:", err);
            }
        },

        /* FILE HANDLING */
        handleDragOver(event) {
            // Could add visual feedback if needed
        },
        handleDrop(files) {
            const newFile = files.find((f) => this.isStructuredFile(f));
            if (!newFile) {
                alert("Please drop a valid structured file (CSV, TSV, TXT, JSON, NDJSON, or Parquet).");
                return;
            }
            this.proceedToAnalysis(newFile);
        },
        triggerFileSelectReplace() {
            this.$refs.fileInputReplace.click();
        },
        handleFileSelect(file) {
            if (file && this.isStructuredFile(file)) {
                this.proceedToAnalysis(file);
            } else {
                alert("Invalid file type. Must be CSV, TSV, TXT, JSON, NDJSON, or Parquet.");
            }
        },
        handleFileReplace(event) {
            const file = event.target.files[0];
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

        /**
         * MAIN LOGIC
         * On new file: 1) reset DB, 2) create table, 3) run default query
         */
        async proceedToAnalysis(file) {
            // Show "loading file" spinner
            this.isLoadingFile = true;
            // Clear out old columns/rows
            this.fileColumns = [];
            this.fileRowCount = null;

            // Reset DB to free memory
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

            // Simple default query
            this.query = `SELECT * FROM ${this.quotedTableName} LIMIT 10;`;
            this.beautifySQL();

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
                // Re-run the default query
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
                // Gather CSV options
                const delim = this.csvOptions.delimiter || ",";
                const header = this.csvOptions.header ? "true" : "false";

                let ignoreErrors = "FALSE";
                if (this.csvOptions.onError === "ignore" || this.csvOptions.onError === "replace") {
                    ignoreErrors = "TRUE";
                }

                const quote = this.csvOptions.quote !== undefined ? this.csvOptions.quote : "\"";
                const escape = this.csvOptions.escape !== undefined ? this.csvOptions.escape : "\"";
                const skip = this.csvOptions.skip || 0;
                const commentClause = this.csvOptions.comment
                    ? `comment='${this.csvOptions.comment}'`
                    : "comment=NULL";

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
                    sql = `
                        CREATE OR REPLACE TABLE ${this.quotedTableName} AS
                        SELECT * FROM read_ndjson('${virtualPath}');
                    `;
                } else {
                    sql = `
                        CREATE OR REPLACE TABLE ${this.quotedTableName} AS
                        SELECT * FROM read_json_auto('${virtualPath}');
                    `;
                }
            } else if (ext === "parquet") {
                sql = `
                    CREATE OR REPLACE TABLE ${this.quotedTableName} AS
                    SELECT * FROM read_parquet('${virtualPath}');
                `;
            } else {
                // fallback => read_csv_auto
                sql = `
                    CREATE OR REPLACE TABLE ${this.quotedTableName} AS
                    SELECT * FROM read_csv_auto('${virtualPath}');
                `;
            }

            if (sql) {
                await executeQuery(sql);
            }
        },

        /**
         * Run the current query, storing columns from the result.
         */
        async runQuery() {
            if (!this.dbInitialized) {
                alert("Database is still initializing. Please wait.");
                return;
            }
            if (this.isLoading) {
                console.warn("runQuery() called while already loading. Skipping.");
                return;
            }

            console.log("Starting query:", this.query);
            this.isLoading = true;
            this.queryResults = [];
            this.queryStats = null; // reset stats each run

            const startTime = performance.now();
            this.$nextTick(async () => {
                try {
                    const results = await executeQuery(this.query);
                    // Convert array-of-objects => [headers, rows...]
                    if (results.length) {
                        const headers = Object.keys(results[0]);
                        const rows = results.map((row) => Object.values(row));
                        this.queryResults = [headers, ...rows];

                        // Overwrite fileColumns with these column names
                        this.fileColumns = headers.map((colName) => ({
                            column_name: colName,
                        }));
                    } else {
                        this.queryResults = [];
                        this.fileColumns = [];
                    }
                    const rowCount = results.length;
                    const endTime = performance.now();
                    const durationMs = endTime - startTime;

                    this.fileRowCount = rowCount;
                    this.queryStats = {
                        durationMs,
                        rowsReturned: rowCount,
                    };
                } catch (err) {
                    console.error("Query error:", err);
                    alert(`Query error: ${err.message || err}`);
                } finally {
                    this.isLoading = false;
                    console.log("Query finished, isLoading = false");

                    // Notify parent (App.vue) to record in global history
                    this.$emit("query-ran", {
                        query: this.query,
                        results: this.queryResults,
                    });
                }
            });
        },

        // Download Query Results as CSV
        downloadResults() {
            if (!this.queryResults.length) return;

            const headers = this.queryResults[0];
            const rows = this.queryResults.slice(1);

            const csvContent = [
                headers.join(","), // header row
                ...rows.map((row) =>
                    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
                ),
            ].join("\n");

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", "query_results.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },

        /**
         * Handle rename from Sidebar, receiving { oldName, newName }.
         *  => run ALTER TABLE ... RENAME COLUMN
         *  => re-run the same query to refresh results & columns
         */
        async handleColumnRename({ oldName, newName }) {
            if (!newName || !oldName) return;
            if (newName.trim() === "" || newName === oldName) return;

            try {
                await executeQuery(`
                    ALTER TABLE ${this.quotedTableName}
                    RENAME COLUMN "${oldName.replace(/"/g, '""')}"
                    TO "${newName.replace(/"/g, '""')}";
                `);
                // Re-run the query to show updated column names
                await this.runQuery();
            } catch (err) {
                console.error("Error renaming column:", err);
                alert("Error renaming column: " + err.message);
            }
        },
    },
};
</script>

<style scoped>
button svg {
    width: 20px;
    height: 20px;
}
</style>
