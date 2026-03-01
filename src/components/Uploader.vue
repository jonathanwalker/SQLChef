<template>
    <div class="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-950">

        <!-- Drop Zone -->
        <div
            class="max-w-lg w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-10 cursor-pointer transition-all duration-150"
            :class="isDragging
                ? 'border-blue-500 bg-blue-950/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-500 bg-gray-50 dark:bg-gray-900'"
            @dragenter.prevent="dragDepth++"
            @dragleave="dragDepth--"
            @dragover.prevent="onDragOver"
            @drop.prevent="onDrop"
            @click="triggerFileSelect"
        >
            <!-- Cloud upload icon -->
            <div class="mb-4 p-3 rounded-xl bg-gray-100 dark:bg-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                </svg>
            </div>

            <h2 class="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">Drop a file to get started</h2>
            <p class="text-sm text-gray-400 dark:text-gray-500 mb-4">or <span class="text-blue-400 hover:text-blue-300 transition-colors duration-150">browse files</span></p>

            <!-- Supported format badges -->
            <div class="flex flex-wrap gap-1.5 justify-center">
                <span v-for="fmt in ['CSV', 'TSV', 'JSON', 'NDJSON', 'Parquet', 'TXT']" :key="fmt"
                    class="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700">
                    {{ fmt }}
                </span>
            </div>

            <input type="file" ref="fileInput" class="hidden" @change="onFileSelect" />
        </div>

        <!-- URL paste input -->
        <div class="max-w-lg w-full mt-4">
            <input
                ref="urlInput"
                type="text"
                class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors duration-150"
                placeholder="Or paste a file URL..."
                @paste.prevent="onPaste"
            />
        </div>

        <!-- Divider -->
        <div class="max-w-lg w-full mt-6 flex items-center gap-3">
            <div class="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
            <span class="text-xs text-gray-400 dark:text-gray-600 font-medium uppercase tracking-wider">Try a sample</span>
            <div class="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
        </div>

        <!-- Sample buttons -->
        <div class="flex gap-2 mt-4">
            <button
                v-for="sample in samples"
                :key="sample.name"
                @click="loadSample(sample)"
                class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm transition-colors duration-150"
            >
                {{ sample.name }}
            </button>
        </div>
    </div>
</template>

<script>
export default {
    name: "Uploader",
    data() {
        return {
            fileUrl: "",
            dragDepth: 0,
            basePath: import.meta.env.BASE_URL,
            samples: [
                { name: "sample.csv", url: `${import.meta.env.BASE_URL}sample.csv` },
                { name: "sample.json", url: `${import.meta.env.BASE_URL}sample.json` },
                { name: "sample.parquet", url: `${import.meta.env.BASE_URL}sample.parquet` },
            ],
        };
    },
    computed: {
        isDragging() {
            return this.dragDepth > 0;
        },
    },
    methods: {
        onDragOver(event) { this.$emit("dragover", event); },
        onDrop(event) {
            this.dragDepth = 0;
            const files = Array.from(event.dataTransfer.files);
            this.$emit("drop", files);
        },
        triggerFileSelect() { this.$refs.fileInput.click(); },
        onFileSelect(event) {
            const file = event.target.files[0];
            if (file) { this.$emit("file-selected", file); }
        },
        async onPaste(e) {
            e.preventDefault();
            const pastedText = e.clipboardData?.getData("text");
            if (!pastedText) return;
            this.fileUrl = pastedText.trim();
            await this.loadRemoteFile(this.fileUrl);
        },
        async loadSample(sample) { await this.loadRemoteFile(sample.url); },
        async loadRemoteFile(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) { throw new Error(`Could not fetch file:\n ${response.status} ${response.statusText}`); }
                const blob = await response.blob();
                let ext = "txt";
                if (url.includes(".")) { ext = url.split(".").pop().split("?")[0] || "txt"; }
                const filename = `remote_file.${ext}`;
                const file = new File([blob], filename, { type: blob.type });
                this.$emit("file-selected", file);
                this.fileUrl = "";
                if (this.$refs.urlInput) { this.$refs.urlInput.value = ""; }
            } catch (error) {
                alert("Error loading file:\n" + error.message);
            }
        },
    },
};
</script>
