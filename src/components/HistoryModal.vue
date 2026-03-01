<template>
    <!-- Backdrop -->
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        @click.self="$emit('close')"
    >
        <!-- Modal -->
        <div class="max-w-xl w-full mx-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col max-h-[80vh]">

            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
                <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Query History</h2>
                <div class="flex items-center gap-1">
                    <button
                        @click="$emit('clear-history')"
                        class="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-red-400 transition-colors duration-150"
                        title="Clear all history"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                    </button>
                    <button
                        @click="$emit('close')"
                        class="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-150"
                        title="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Empty state -->
            <div v-if="!history.length" class="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-gray-400 dark:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p class="text-sm">No query history yet</p>
            </div>

            <!-- History list — newest first -->
            <ul v-else class="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
                <li
                    v-for="(item, index) in reversedHistory"
                    :key="index"
                    class="group flex items-start gap-3 px-5 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-150"
                    @click="$emit('restore', item)"
                >
                    <div class="flex-1 min-w-0">
                        <div class="text-xs text-gray-400 dark:text-gray-500 mb-1">{{ relativeTime(item.timestamp) }}</div>
                        <div class="font-mono text-xs text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">{{ queryPreview(item.query) }}</div>
                    </div>
                    <!-- Delete button -->
                    <button
                        class="shrink-0 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-all duration-150 rounded mt-0.5"
                        title="Remove from history"
                        @click.stop="$emit('delete-item', item)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </li>
            </ul>

        </div>
    </div>
</template>

<script>
export default {
    name: "HistoryModal",
    props: {
        history: { type: Array, default: () => [] },
    },
    emits: ['close', 'restore', 'clear-history', 'delete-item'],
    computed: {
        // Newest first — shallow reverse preserves original object references
        // so indexOf() works correctly in the delete handler
        reversedHistory() {
            return [...this.history].reverse();
        },
    },
    methods: {
        relativeTime(ts) {
            // Legacy entries stored as locale strings — display as-is
            if (typeof ts === 'string') return ts;
            const diff = Date.now() - ts;
            if (diff < 60_000) return 'just now';
            if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
            if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
            if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
            return new Date(ts).toLocaleDateString();
        },
        queryPreview(query) {
            if (!query) return '';
            // Collapse whitespace and show the first meaningful line
            return query.replace(/\s+/g, ' ').trim();
        },
    },
};
</script>
