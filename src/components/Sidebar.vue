<template>
    <aside class="hidden md:flex md:flex-col w-60 shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 h-full overflow-hidden">

        <!-- File Header -->
        <div class="px-3 pt-3 pb-2 border-b border-gray-200 dark:border-zinc-800 shrink-0">
            <div class="flex items-center gap-2 min-w-0">
                <span class="flex-1 truncate text-sm font-medium text-gray-800 dark:text-zinc-200" :title="currentFile.name">
                    {{ currentFile.name }}
                </span>
                <span class="shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
                    :class="{
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400': ['csv','tsv','txt'].includes(fileExtension),
                        'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400': fileExtension === 'json' || fileExtension === 'ndjson',
                        'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400': fileExtension === 'parquet',
                        'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400': !['csv','tsv','txt','json','ndjson','parquet'].includes(fileExtension),
                    }">
                    {{ fileExtension }}
                </span>
            </div>
            <div class="mt-1 flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500">
                <span v-if="fileRowCount">{{ fileRowCount.toLocaleString() }} rows</span>
                <span v-if="fileRowCount && currentFile.size" class="text-gray-300 dark:text-zinc-700">·</span>
                <span>{{ formatFileSize(currentFile.size) }}</span>
            </div>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto">

            <!-- Columns Section -->
            <div class="px-3 py-3">
                <h3 class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Columns</h3>

                <!-- Spinner while loading -->
                <div v-if="isLoadingFile" class="flex items-center gap-2 py-2">
                    <svg class="animate-spin h-4 w-4 text-emerald-400 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span class="text-xs text-emerald-400">Loading columns...</span>
                </div>

                <!-- Column list -->
                <ul v-else class="space-y-0.5">
                    <li
                        v-for="(col, index) in localColumns"
                        :key="index"
                        class="group flex items-center py-1.5 px-2 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-150"
                    >
                        <!-- Editing state -->
                        <div v-if="col.isEditing" class="flex-1">
                            <input
                                v-model="col.editValue"
                                type="text"
                                class="w-full bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded px-1.5 py-0.5 text-xs text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500"
                                @keyup.enter="finishEdit(index)"
                                @blur="finishEdit(index)"
                            />
                        </div>
                        <!-- Display state -->
                        <div v-else class="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden"
                            :title="columnTypes[col.column_name] ? `${col.column_name} — ${columnTypes[col.column_name]}` : col.column_name">
                            <span class="truncate text-xs text-gray-700 dark:text-zinc-300">{{ col.column_name }}</span>
                            <template v-if="columnTypes[col.column_name]">
                                <!-- Inline cast select -->
                                <select
                                    v-if="castingIndex === index"
                                    data-cast-select
                                    class="shrink-0 text-xs font-mono bg-gray-100 dark:bg-zinc-800 border border-gray-400 dark:border-zinc-600 rounded px-1 py-0 ml-auto text-gray-700 dark:text-zinc-200 focus:outline-none cursor-pointer"
                                    @change="onCastChange(index, col.column_name, $event.target.value)"
                                    @blur="castingIndex = null"
                                    @keydown.esc="castingIndex = null"
                                >
                                    <option value="" disabled selected>Cast to…</option>
                                    <option v-for="t in castTypes" :key="t" :value="t">{{ t }}</option>
                                </select>
                                <!-- Type badge — click to cast -->
                                <span
                                    v-else
                                    class="shrink-0 text-xs font-mono text-gray-400 dark:text-zinc-500 ml-auto cursor-pointer hover:text-gray-600 dark:hover:text-zinc-400 transition-colors duration-100"
                                    :title="`${columnTypes[col.column_name]} — click to cast`"
                                    @click.stop="startCast(index)"
                                >
                                    {{ abbreviateType(columnTypes[col.column_name]) }}
                                </span>
                            </template>
                        </div>
                        <!-- Pencil icon -->
                        <span
                            v-if="!col.isEditing"
                            class="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 ml-1 shrink-0 transition-opacity duration-150 cursor-pointer p-0.5"
                            @click="startEdit(index)"
                            title="Rename column"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-3.5 w-3.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                        </span>
                    </li>
                </ul>
            </div>

            <!-- Divider -->
            <div class="mx-3 h-px bg-gray-200 dark:bg-zinc-800"></div>

            <!-- Parse Options -->
            <div class="px-3 py-3">

                <!-- Import error banner -->
                <div v-if="importError" class="mb-3 p-2 bg-red-950/60 border border-red-800/60 text-red-300 rounded-md text-xs">
                    <strong class="block mb-0.5">Import Error</strong>
                    {{ importError }}
                    <p class="text-red-400 mt-1">Adjust parse options and click Re-Parse.</p>
                </div>

                <!-- CSV Options -->
                <div v-if="['csv', 'txt', 'tsv'].includes(fileExtension)">
                    <h3 class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">CSV Options</h3>

                    <label class="block mb-2">
                        <span class="text-xs text-gray-500 dark:text-zinc-400">Delimiter</span>
                        <input type="text" v-model="csvOptions.delimiter"
                            class="w-full mt-1 px-2 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-600 transition-colors duration-150"
                            placeholder="e.g. , or \t" />
                    </label>

                    <label class="flex items-center gap-2 mb-2 text-xs text-gray-500 dark:text-zinc-400 cursor-pointer">
                        <input type="checkbox" v-model="csvOptions.header" class="rounded" />
                        Has Header
                    </label>

                    <!-- Advanced toggle -->
                    <span
                        class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 cursor-pointer transition-colors duration-150 mb-1"
                        @click="showAdvancedCsv = !showAdvancedCsv"
                        role="button"
                        tabindex="0"
                        @keydown.enter="showAdvancedCsv = !showAdvancedCsv"
                    >
                        <span class="inline-block transition-transform duration-200" :class="showAdvancedCsv ? 'rotate-90' : 'rotate-0'">&#9654;</span>
                        Advanced
                    </span>

                    <transition name="fade">
                        <div v-if="showAdvancedCsv" class="space-y-2 mt-2">
                            <label class="block">
                                <span class="text-xs text-gray-500 dark:text-zinc-400">On Parse Error</span>
                                <select v-model="csvOptions.onError"
                                    class="w-full mt-1 px-2 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-800 dark:text-zinc-200 focus:outline-none transition-colors duration-150">
                                    <option value="fail">Fail</option>
                                    <option value="ignore">Ignore</option>
                                    <option value="replace">Replace</option>
                                </select>
                                <p class="text-xs text-gray-400 dark:text-zinc-600 mt-1">"Ignore" or "Replace" skips invalid rows</p>
                            </label>
                            <label class="block">
                                <span class="text-xs text-gray-500 dark:text-zinc-400">Quote Character</span>
                                <input type="text" v-model="csvOptions.quote"
                                    class="w-full mt-1 px-2 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-800 dark:text-zinc-200 focus:outline-none transition-colors duration-150"
                                    placeholder='"' />
                            </label>
                            <label class="block">
                                <span class="text-xs text-gray-500 dark:text-zinc-400">Escape Character</span>
                                <input type="text" v-model="csvOptions.escape"
                                    class="w-full mt-1 px-2 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-800 dark:text-zinc-200 focus:outline-none transition-colors duration-150"
                                    placeholder='"' />
                            </label>
                            <label class="block">
                                <span class="text-xs text-gray-500 dark:text-zinc-400">Skip Lines</span>
                                <input type="number" v-model.number="csvOptions.skip"
                                    class="w-full mt-1 px-2 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-800 dark:text-zinc-200 focus:outline-none transition-colors duration-150"
                                    min="0" />
                            </label>
                            <label class="block">
                                <span class="text-xs text-gray-500 dark:text-zinc-400">Comment Char</span>
                                <input type="text" v-model="csvOptions.comment"
                                    class="w-full mt-1 px-2 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-800 dark:text-zinc-200 focus:outline-none transition-colors duration-150"
                                    placeholder="#" />
                            </label>
                        </div>
                    </transition>

                    <button
                        class="mt-3 w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-sm font-medium rounded-md transition-colors duration-150"
                        @click="$emit('recreate-table')">
                        Re-Parse
                    </button>
                </div>

                <!-- JSON / NDJSON Options -->
                <div v-else-if="fileExtension === 'json' || fileExtension === 'ndjson'">
                    <h3 class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">JSON Options</h3>
                    <label class="block mb-2">
                        <span class="text-xs text-gray-500 dark:text-zinc-400">Format</span>
                        <select v-model="jsonOptions.format"
                            class="w-full mt-1 px-2 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-800 dark:text-zinc-200 focus:outline-none transition-colors duration-150">
                            <option value="auto">Auto (read_json_auto)</option>
                            <option value="ndjson">NDJSON (read_ndjson)</option>
                        </select>
                    </label>
                    <button
                        class="mt-2 w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors duration-150"
                        @click="$emit('recreate-table')">
                        Re-Parse
                    </button>
                </div>

            </div>
        </div>

        <!-- Footer: compact re-upload zone -->
        <div class="shrink-0 border-t border-gray-200 dark:border-zinc-800 px-3 py-3 space-y-2">
            <div
                class="h-16 border border-dashed rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors duration-150"
                :class="isDropping
                    ? 'border-blue-500 bg-blue-950/20'
                    : 'border-gray-300 dark:border-zinc-700 hover:border-gray-500 bg-gray-100/40 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-800'"
                @dragenter.prevent="dropDepth++"
                @dragleave="dropDepth--"
                @dragover.prevent
                @drop.prevent="onDrop"
                @click="triggerFileSelect"
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <span class="text-xs text-gray-400 dark:text-zinc-500">Drop or click to replace file</span>
                <input type="file" ref="fileInputReplace" class="hidden" @change="handleFileReplace" />
            </div>

            <div class="relative">
                <input
                    v-model="urlInput"
                    ref="urlInputEl"
                    type="text"
                    class="w-full px-2 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md text-xs text-gray-500 dark:text-zinc-400 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-600 transition-colors duration-150 pr-6"
                    placeholder="Paste or type a URL and press Enter..."
                    :disabled="isLoadingUrl"
                    @paste.prevent="onPaste"
                    @keydown.enter="onUrlSubmit"
                />
                <div v-if="isLoadingUrl" class="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg class="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                </div>
            </div>
        </div>
    </aside>
</template>

<script>
export default {
    name: "Sidebar",
    props: {
        currentFile: { type: Object, required: true },
        fileExtension: { type: String, required: true },
        uploadDate: { type: String, required: true },
        fileRowCount: { type: [Number, String], default: null },
        fileColumns: { type: Array, required: true },
        columnTypes: { type: Object, default: () => ({}) },
        csvOptions: { type: Object, required: true },
        jsonOptions: { type: Object, required: true },
        importError: { type: String, default: null },
        isLoadingFile: { type: Boolean, default: false },
    },
    data() {
        return {
            urlInput: "",
            isLoadingUrl: false,
            dropDepth: 0,
            showAdvancedCsv: false,
            localColumns: [],
            castingIndex: null,
            castTypes: ['VARCHAR', 'INTEGER', 'BIGINT', 'DOUBLE', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'JSON', 'BLOB'],
        };
    },
    computed: {
        isDropping() { return this.dropDepth > 0; },
    },
    watch: {
        fileColumns: {
            immediate: true,
            handler(newCols) {
                this.localColumns = newCols.map((c) => ({
                    ...c,
                    isEditing: false,
                    editValue: c.column_name,
                }));
            },
        },
    },
    methods: {
        abbreviateType(type) {
            if (!type) return '';
            const upper = type.toUpperCase();
            const map = {
                'VARCHAR': 'str', 'TEXT': 'str', 'CHAR': 'str', 'STRING': 'str',
                'INTEGER': 'int', 'INT': 'int', 'INT4': 'int', 'SIGNED': 'int',
                'BIGINT': 'bigint', 'INT8': 'bigint', 'LONG': 'bigint', 'HUGEINT': 'hugeint',
                'SMALLINT': 'int16', 'TINYINT': 'int8', 'UBIGINT': 'uint64',
                'UINTEGER': 'uint32', 'USMALLINT': 'uint16', 'UTINYINT': 'uint8',
                'DOUBLE': 'float64', 'FLOAT': 'float32', 'REAL': 'float32', 'DECIMAL': 'decimal',
                'BOOLEAN': 'bool', 'BOOL': 'bool',
                'DATE': 'date',
                'TIMESTAMP': 'timestamp', 'TIMESTAMP WITH TIME ZONE': 'timestamptz',
                'TIMESTAMP_S': 'timestamp', 'TIMESTAMP_MS': 'timestamp', 'TIMESTAMP_NS': 'timestamp',
                'TIME': 'time', 'INTERVAL': 'interval',
                'BLOB': 'blob', 'BYTEA': 'blob',
                'UUID': 'uuid', 'JSON': 'json',
            };
            // Try exact match first, then strip type parameters for things like DECIMAL(10,2)
            return map[upper] || map[upper.replace(/\(.*\)$/, '').trim()] || type.toLowerCase().replace(/\(.*\)$/, '');
        },
        formatFileSize(bytes) {
            if (bytes === 0) return "0 Bytes";
            const k = 1024;
            const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
        },
        onDrop(event) {
            this.dropDepth = 0;
            const files = Array.from(event.dataTransfer.files);
            const newFile = files.find((f) => this.isStructuredFile(f));
            if (!newFile) {
                alert("Please drop a valid structured file (CSV, TSV, TXT, JSON, NDJSON, or Parquet).");
                return;
            }
            this.$emit("file-selected", newFile);
        },
        triggerFileSelect() {
            this.$refs.fileInputReplace.click();
        },
        handleFileReplace(event) {
            const file = event.target.files[0];
            if (file && this.isStructuredFile(file)) {
                this.$emit("file-selected", file);
            } else {
                alert("Invalid file type. Must be CSV, TSV, TXT, JSON, NDJSON, or Parquet.");
            }
        },
        isStructuredFile(file) {
            const ext = file.name.split(".").pop().toLowerCase();
            return ["csv", "tsv", "txt", "json", "ndjson", "parquet"].includes(ext);
        },
        onPaste(e) {
            const text = e.clipboardData?.getData("text")?.trim();
            if (text) {
                this.urlInput = text;
                this.loadRemoteFile(text);
            }
        },
        onUrlSubmit() {
            const url = this.urlInput.trim();
            if (url) this.loadRemoteFile(url);
        },
        async loadRemoteFile(url) {
            this.isLoadingUrl = true;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
                }
                const blob = await response.blob();
                let name;
                try {
                    const seg = new URL(url).pathname.split('/').pop();
                    name = (seg && seg.includes('.')) ? seg : null;
                } catch { name = null; }
                name = name ?? `remote_file.${url.split('.').pop().split('?')[0] || 'txt'}`;
                const file = new File([blob], name, { type: blob.type });
                this.$emit("file-selected", file);
                this.urlInput = "";
            } catch (error) {
                alert("Error loading file from URL:\n" + error.message);
            } finally {
                this.isLoadingUrl = false;
            }
        },
        startEdit(index) {
            this.castingIndex = null;
            this.localColumns.forEach((c) => (c.isEditing = false));
            this.localColumns[index].isEditing = true;
        },
        startCast(index) {
            this.localColumns.forEach((c) => (c.isEditing = false));
            this.castingIndex = index;
            this.$nextTick(() => {
                const el = this.$el.querySelector('[data-cast-select]');
                if (el) el.focus();
            });
        },
        onCastChange(index, columnName, newType) {
            this.castingIndex = null;
            if (newType) {
                this.$emit('cast-column', { columnName, newType });
            }
        },
        finishEdit(index) {
            const col = this.localColumns[index];
            if (!col.isEditing) return;

            col.isEditing = false;
            const oldName = col.column_name;
            const newName = col.editValue.trim();
            if (!newName || newName === oldName) {
                col.editValue = oldName;
                return;
            }
            this.$emit("rename-column", { oldName, newName });
        },
    },
};
</script>
