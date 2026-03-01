<template>
    <div class="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-zinc-950">

        <!-- Drop Zone -->
        <div
            class="max-w-lg w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-10 cursor-pointer transition-all duration-150"
            :class="isDragging
                ? 'border-blue-500 bg-blue-950/20'
                : 'border-gray-300 dark:border-zinc-700 hover:border-gray-500 bg-gray-50 dark:bg-zinc-900'"
            @dragenter.prevent="dragDepth++"
            @dragleave="dragDepth--"
            @dragover.prevent
            @drop.prevent="onDrop"
            @click="triggerFileSelect"
        >
            <!-- Cloud upload icon -->
            <div class="mb-4 p-3 rounded-xl bg-gray-100 dark:bg-zinc-800">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                </svg>
            </div>

            <h2 class="text-base font-semibold text-gray-800 dark:text-zinc-200 mb-1">Drop a file to get started</h2>
            <p class="text-sm text-gray-400 dark:text-zinc-500 mb-4">or <span class="text-blue-500 dark:text-blue-400 hover:text-blue-400 dark:hover:text-blue-300 transition-colors duration-150">browse files</span></p>

            <!-- Supported format badges -->
            <div class="flex flex-wrap gap-1.5 justify-center">
                <span v-for="fmt in ['CSV', 'TSV', 'JSON', 'NDJSON', 'Parquet', 'TXT']" :key="fmt"
                    class="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border border-gray-300 dark:border-zinc-700">
                    {{ fmt }}
                </span>
            </div>

            <input type="file" ref="fileInput" class="hidden" @change="onFileSelect" />
        </div>

        <!-- URL input -->
        <div class="max-w-lg w-full mt-4 relative">
            <input
                v-model="urlInput"
                ref="urlInput"
                type="text"
                class="w-full px-3 py-2 bg-gray-100 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-700 dark:text-zinc-300 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-600 transition-colors duration-150 pr-8"
                placeholder="Or paste / type a file URL and press Enter..."
                :disabled="isLoadingUrl"
                @paste.prevent="onPaste"
                @keydown.enter="onUrlSubmit"
            />
            <div v-if="isLoadingUrl" class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg class="animate-spin h-4 w-4 text-gray-400 dark:text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
            </div>
        </div>

        <!-- Divider -->
        <div class="max-w-lg w-full mt-6 flex items-center gap-3">
            <div class="flex-1 h-px bg-gray-200 dark:bg-zinc-800"></div>
            <span class="text-xs text-gray-400 dark:text-zinc-600 font-medium uppercase tracking-wider">Try a sample</span>
            <div class="flex-1 h-px bg-gray-200 dark:bg-zinc-800"></div>
        </div>

        <!-- Sample buttons -->
        <div class="flex gap-2 mt-4">
            <button
                v-for="sample in samples"
                :key="sample.name"
                @click="loadSample(sample)"
                :disabled="isLoadingUrl"
                class="px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-md text-sm transition-colors duration-150 disabled:opacity-50"
            >
                {{ sample.name }}
            </button>
        </div>
    </div>
</template>

<script>
function filenameFromUrl(url) {
    try {
        const seg = new URL(url).pathname.split('/').pop();
        return seg && seg.includes('.') ? seg : null;
    } catch {
        return null;
    }
}

export default {
    name: "Uploader",
    data() {
        return {
            urlInput: "",
            dragDepth: 0,
            isLoadingUrl: false,
            samples: [
                { name: "sample.csv",     url: `${import.meta.env.BASE_URL}sample.csv` },
                { name: "sample.json",    url: `${import.meta.env.BASE_URL}sample.json` },
                { name: "sample.parquet", url: `${import.meta.env.BASE_URL}sample.parquet` },
            ],
        };
    },
    computed: {
        isDragging() { return this.dragDepth > 0; },
    },
    methods: {
        onDrop(event) {
            this.dragDepth = 0;
            const files = Array.from(event.dataTransfer.files);
            this.$emit("drop", files);
        },
        triggerFileSelect() { this.$refs.fileInput.click(); },
        onFileSelect(event) {
            const file = event.target.files[0];
            if (file) this.$emit("file-selected", file);
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
        async loadSample(sample) { await this.loadRemoteFile(sample.url); },
        async loadRemoteFile(url) {
            this.isLoadingUrl = true;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Could not fetch file: ${response.status} ${response.statusText}`);
                }
                const blob = await response.blob();
                const name = filenameFromUrl(url) ?? `remote_file.${url.split('.').pop().split('?')[0] || 'txt'}`;
                const file = new File([blob], name, { type: blob.type });
                this.$emit("file-selected", file);
                this.urlInput = "";
            } catch (error) {
                alert("Error loading file:\n" + error.message);
            } finally {
                this.isLoadingUrl = false;
            }
        },
    },
};
</script>
