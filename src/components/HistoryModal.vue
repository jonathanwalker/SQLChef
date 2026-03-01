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
                    <!-- Clear history -->
                    <button
                        @click="$emit('clear-history')"
                        class="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-red-400 transition-colors duration-150"
                        title="Clear History"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                    </button>
                    <!-- Close -->
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

            <!-- History list -->
            <ul v-else class="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
                <li
                    v-for="(item, index) in history"
                    :key="index"
                    class="px-5 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-150"
                    @click="$emit('restore', item)"
                >
                    <div class="text-xs text-gray-400 dark:text-gray-500 mb-1">{{ item.timestamp }}</div>
                    <div class="font-mono text-xs text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">{{ item.query }}</div>
                </li>
            </ul>

        </div>
    </div>
</template>

<script>
export default {
    name: "HistoryModal",
    props: {
        history: {
            type: Array,
            default: () => []
        }
    },
    methods: {
        truncate(str, maxLen) {
            if (!str) return "";
            return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
        },
    }
};
</script>
