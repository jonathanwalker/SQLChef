<template>
  <div id="app">
    <header class="app-header flex items-center justify-between px-4 py-1.5 bg-gray-800">
      <div class="flex items-center">
        <!-- Link to basePath in data -->
        <a :href="basePath" class="flex items-center text-gray-200">
          <!-- Increased height and width, removed right margin -->
          <img src="/sqlchef-dark.svg" alt="SQL Chef Logo" class="h-10 w-40 -ml-2" />
        </a>
      </div>

      <!-- Right-side Icons/Buttons -->
      <div class="flex items-center space-x-4">
        <!-- DuckDB integrity indicator -->
        <div :title="securityTitle" class="flex items-center cursor-default">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transition-colors"
            :class="dbState === 'verified' ? 'text-green-400' : dbState === 'failed' ? 'text-amber-400' : 'text-gray-500 animate-pulse'"
            viewBox="0 0 24 24" fill="currentColor">
            <!-- verified: shield with checkmark -->
            <path v-if="dbState === 'verified'"
              d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
            <!-- failed: shield with exclamation -->
            <path v-else-if="dbState === 'failed'"
              d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm1 13h-2v-2h2v2zm0-4h-2V7h2v4z" />
            <!-- loading: plain shield -->
            <path v-else d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </svg>
        </div>

        <!-- History Button: standard "History" icon (clock arrow) -->
        <button @click="toggleHistory"
          class="text-blue-400 hover:text-blue-300 flex items-center p-2 border-0 bg-transparent outline-none focus:outline-none active:outline-none"
          title="Query History">
          <svg height="21px" version="1.1" viewBox="0 0 20 21" width="20px" xmlns="http://www.w3.org/2000/svg"
            fill="currentColor" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns"
            xmlns:xlink="http://www.w3.org/1999/xlink">
            <title>History Icon</title>
            <desc>Clock arrow indicating history</desc>
            <defs />
            <g fill="none" fill-rule="evenodd" stroke="none" stroke-width="1">
              <path
                d="M10.5,0 C7,0 3.9,1.9 2.3,4.8 L0,2.5 L0,9 L6.5,9 L3.7,6.2 C5,3.7 7.5,2 10.5,2 C14.6,2 18,5.4 18,9.5 C18,13.6 14.6,17 10.5,17 C7.2,17 4.5,14.9 3.4,12 L1.3,12 C2.4,16 6.1,19 10.5,19 C15.8,19 20,14.7 20,9.5 C20,4.3 15.7,0 10.5,0 Z M9,5 L9,10.1 L13.7,12.9 L14.5,11.6 L10.5,9.2 L10.5,5 L9,5 Z"
                fill="currentColor" />
            </g>
          </svg>
        </button>

        <!-- GitHub Link -->
        <a href="https://github.com/jonathanwalker/SQLChef" class="text-blue-400 hover:text-blue-300 flex items-center">
          <!-- GitHub Icon -->
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205
              11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04
              -3.338.724-4.042-1.61-4.042-1.61 C4.422 17.07 3.633 16.7
              3.633 16.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838
              1.236 1.838 1.236 1.07 1.835 2.807 1.305 3.495.998
              .108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.333
              -5.466-5.93 0-1.31.468-2.38 1.235-3.22-.135-.303
              -.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23
              a11.52 11.52 0 013.003-.404c1.02.005 2.045.138
              3.003.404 2.28-1.552 3.285-1.23 3.285-1.23.645
              1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23
              3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096
              .81 2.21 0 1.596-.015 2.877-.015 3.27 0 .315.21.69
              .825.57C20.565 21.796 24 17.3 24 12c0-6.627-5.373
              -12-12-12z" />
          </svg>
        </a>
      </div>
    </header>

    <!-- Show a global loading overlay if the DB is initializing -->
    <!-- <div v-if="!dbInitialized" class="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
      <div class="bg-gray-800 p-6 rounded-lg flex flex-col items-center">
        <svg class="animate-spin h-10 w-10 text-green-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none"
          viewBox="0 0 24 24" stroke="currentColor">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <p class="text-gray-200 text-lg">Initializing Database, please wait...</p>
      </div>
    </div> -->

    <!-- Main Interface -->
    <Interface ref="interface" :history-item="selectedHistoryItem" @query-ran="onQueryRan" />

    <!-- History Modal -->
    <HistoryModal v-if="showHistory" :history="queryHistory" @close="showHistory = false" @restore="restoreItem"
      @clear-history="clearHistory" />
  </div>
</template>

<script>
import Interface from "./components/Interface.vue";
import HistoryModal from "./components/HistoryModal.vue";
import { initDuckDB } from "@/services/duckdbService";

function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

export default {
  name: "App",
  components: {
    Interface,
    HistoryModal,
  },
  data() {
    return {
      showHistory: false,
      queryHistory: [], // Array of { query, results, timestamp }
      selectedHistoryItem: null, // If user chooses a prior query from History
      dbInitialized: false,
      dbState: 'loading', // 'loading' | 'verified' | 'failed'
      basePath: import.meta.env.BASE_URL,
    };
  },
  async mounted() {
    // Load any saved history from localStorage
    const saved = localStorage.getItem("sqlchef-history");
    if (saved) {
      try {
        this.queryHistory = JSON.parse(saved);
      } catch (err) {
        console.warn("Could not parse saved history:", err);
      }
    }

    try {
      const { verified } = await initDuckDB();
      this.dbInitialized = true;
      this.dbState = verified ? 'verified' : 'failed';
    } catch (err) {
      console.error("Failed to initialize DuckDB in App.vue:", err);
      this.dbState = 'failed';
      alert("Failed to initialize the database. Please refresh the page or try again later.");
    }
  },
  watch: {
    // Whenever queryHistory changes, persist to localStorage
    queryHistory: {
      deep: true,
      handler(newVal) {
        localStorage.setItem("sqlchef-history", safeStringify(newVal));
      },
    },
  },
  computed: {
    securityTitle() {
      if (this.dbState === 'verified') return 'DuckDB running locally — integrity verified';
      if (this.dbState === 'failed') return 'DuckDB loaded locally, but integrity check could not be verified';
      return 'Verifying DuckDB integrity…';
    },
  },
  methods: {
    toggleHistory() {
      this.showHistory = !this.showHistory;
    },
    // Called by Interface.vue after each successful query
    onQueryRan({ query, results }) {
      this.queryHistory.push({
        query,
        results,
        timestamp: new Date().toLocaleString(),
      });
    },
    // When user clicks a query in the history, we restore it
    restoreItem(item) {
      this.selectedHistoryItem = item;
      this.showHistory = false;
    },
    // Handle clearing the history
    clearHistory() {
      this.queryHistory = []; // Clear the history array
      localStorage.removeItem("sqlchef-history"); // Remove from localStorage
    },
  },
};
</script>

<style>
.app-header {
  background-color: #1b1b1b;
  padding: 10px;
  color: #ccc;
  border-bottom: 1px solid #444;
}

.app-header h1 {
  margin: 0;
  font-size: 1.4rem;
}

/* Remove focus outline for buttons to enhance aesthetics */
button:focus {
  outline: none;
}

/* Ensure no borders are added by other styles */
button {
  border: none;
  background: transparent;
}

button:focus {
  outline-offset: 2px;
}

.fixed.inset-0 {
  z-index: 9999;
}
</style>
