<template>
    <div class="flex flex-col bg-gray-50 dark:bg-gray-900">
        <!-- Action bar -->
        <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <!-- Run button -->
            <button
                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors duration-150 disabled:opacity-75"
                :disabled="isLoading"
                @click="$emit('run-query')"
                title="Run Query"
            >
                <!-- Spinner when loading -->
                <svg v-if="isLoading" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <!-- Play icon when idle -->
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 3l14 9-14 9V3z" />
                </svg>
                <span>Run</span>
            </button>

            <!-- Format button -->
            <button
                class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-md transition-colors duration-150"
                @click="beautifySQL"
                title="Format Query"
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7H8m0 4h8m-8 4h8M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                </svg>
                <span>Format</span>
            </button>

            <!-- Keyboard hint -->
            <span class="text-xs text-gray-400 dark:text-gray-600 ml-1">&#8984;&#8629;</span>

            <!-- Stats (right-aligned) -->
            <div v-if="queryStats" class="ml-auto flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span>{{ queryStats.rowsReturned || 0 }} rows</span>
                <span class="text-gray-300 dark:text-gray-700">·</span>
                <span>{{ (queryStats.durationMs / 1000).toFixed(3) }}s</span>
                <span v-if="queryStats.bytesScanned" class="text-gray-300 dark:text-gray-700">·</span>
                <span v-if="queryStats.bytesScanned">{{ formatBytes(queryStats.bytesScanned) }}</span>
            </div>
        </div>

        <!-- Textarea -->
        <div class="bg-gray-100 dark:bg-gray-950">
            <textarea
                v-model="localQuery"
                ref="textarea"
                class="w-full p-4 bg-gray-100 dark:bg-gray-950 text-sm font-mono text-gray-900 dark:text-gray-200 leading-relaxed resize-none focus:outline-none min-h-[120px] max-h-[280px] overflow-y-auto"
                placeholder="Write your SQL query here..."
                @keydown.enter.prevent="onKeyDown"
                @keydown.tab.prevent="onTab"
                @input="autoResize"
            ></textarea>
        </div>
    </div>
</template>

<script>
import { format as formatSQL } from "sql-formatter";

export default {
    name: "Query",
    props: {
        query: {
            type: String,
            required: true,
        },
        isLoading: {
            type: Boolean,
            default: false,
        },
        queryStats: {
            type: Object,
            default: null,
        },
        fileRowCount: {
            type: Number,
            default: 0,
        },
    },
    data() {
        return {
            localQuery: this.query,
        };
    },
    watch: {
        query(newQuery) {
            if (newQuery !== this.localQuery) {
                this.localQuery = newQuery;
                this.$nextTick(this.autoResize);
            }
        },
        localQuery(newVal) {
            this.$emit("update:query", newVal);
        },
    },
    mounted() {
        this.autoResize();
    },
    methods: {
        onKeyDown(event) {
            const isRunHotkey = event.shiftKey || event.metaKey || event.ctrlKey;
            if (isRunHotkey) {
                this.$emit("run-query");
            } else {
                const ta = event.target;
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                // Detect leading whitespace of the current line for auto-indent
                const textBefore = this.localQuery.slice(0, start);
                const currentLine = textBefore.split('\n').pop();
                const indent = currentLine.match(/^(\s*)/)[1];

                this.localQuery =
                    this.localQuery.slice(0, start) + "\n" + indent + this.localQuery.slice(end);

                this.$nextTick(() => {
                    ta.selectionStart = ta.selectionEnd = start + 1 + indent.length;
                    this.autoResize();
                });
            }
        },
        onTab(event) {
            const ta = event.target;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const spaces = '  ';
            this.localQuery = this.localQuery.slice(0, start) + spaces + this.localQuery.slice(end);
            this.$nextTick(() => {
                ta.selectionStart = ta.selectionEnd = start + spaces.length;
            });
        },
        autoResize() {
            const ta = this.$refs.textarea;
            if (!ta) return;
            ta.style.height = "auto";
            ta.style.height = ta.scrollHeight + "px";
        },
        beautifySQL() {
            try {
                this.localQuery = formatSQL(this.localQuery, {
                    language: "sql",
                    keywordCase: "upper",
                });
                this.$nextTick(this.autoResize);
            } catch (err) {
                console.warn("SQL Beautify failed:", err);
            }
        },
        formatBytes(bytes) {
            if (!bytes || isNaN(bytes)) return "0 B";
            const units = ["B", "KB", "MB", "GB", "TB"];
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return (bytes / Math.pow(1024, i)).toFixed(2) + " " + units[i];
        },
    },
};
</script>

