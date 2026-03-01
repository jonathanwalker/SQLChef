<template>
    <div class="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-950">

        <!-- Loading state -->
        <div v-if="isLoading" class="flex-1 flex items-center justify-center">
            <div class="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span class="text-sm">Running query...</span>
            </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="!queryResults.length" class="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
            <p class="text-sm">Run a query to see results</p>
        </div>

        <!-- Results table -->
        <template v-else>
            <div class="flex-1 overflow-auto">
                <table class="w-full border-collapse">
                    <thead>
                        <tr>
                            <th
                                v-for="(header, idx) in queryResults[0]"
                                :key="idx"
                                class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap"
                            >
                                {{ header }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="(row, rowIndex) in queryResults.slice(1)"
                            :key="rowIndex"
                            class="hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors duration-150"
                            :class="rowIndex % 2 === 1 ? 'bg-gray-100/50 dark:bg-gray-900/50' : ''"
                        >
                            <td
                                v-for="(cell, cellIndex) in row"
                                :key="cellIndex"
                                class="px-3 py-2 text-sm border-b border-gray-200/50 dark:border-gray-800/50 whitespace-nowrap"
                                :class="cell == null ? 'text-gray-400 dark:text-gray-600 italic' : 'text-gray-700 dark:text-gray-300'"
                            >
                                {{ cell == null ? '—' : formatCell(cell) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Footer bar -->
            <div class="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0">
                <span class="text-xs text-gray-400 dark:text-gray-500">
                    {{ queryResults.length - 1 }} {{ queryResults.length - 1 === 1 ? 'row' : 'rows' }}
                </span>
                <button
                    class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xs rounded-md transition-colors duration-150"
                    @click="$emit('download-results')"
                    title="Export CSV"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Export CSV
                </button>
            </div>
        </template>

    </div>
</template>

<script>
import { formatCell } from '@/utils/formatCell';

export default {
    name: "Results",
    props: {
        queryResults: {
            type: Array,
            required: true,
        },
        isLoading: {
            type: Boolean,
            default: false,
        },
        isLoadingFile: {
            type: Boolean,
            default: false,
        },
    },
    methods: {
        formatCell(cell) {
            return formatCell(cell);
        },
    },
};
</script>
