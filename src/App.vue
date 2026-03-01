<template>
  <div id="app">
    <header class="flex items-center justify-between px-5 h-11 bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 shrink-0">
      <div class="flex items-center">
        <a :href="basePath" class="flex items-center">
          <img :src="theme === 'dark' ? basePath + 'sqlchef-dark.svg' : basePath + 'sqlchef-light.svg'" alt="SQL Chef Logo" class="h-8 w-auto -ml-1" />
        </a>
      </div>

      <div class="flex items-center gap-1">
        <!-- DuckDB integrity badge + popover -->
        <div ref="securityBadge" class="relative" @click.stop>
          <button
            @click="toggleSecurityPopover"
            :title="dbState === 'failed' ? 'Integrity check FAILED — do not use this session.' : undefined"
            class="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors duration-150"
            :class="{
              'text-emerald-600 bg-emerald-50 dark:text-emerald-500 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-950/80 cursor-pointer': dbState === 'verified',
              'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/50 cursor-pointer': dbState === 'failed',
              'text-gray-400 dark:text-zinc-500 animate-pulse cursor-default': dbState === 'loading',
            }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path v-if="dbState === 'verified'"
                d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              <path v-else-if="dbState === 'failed'"
                d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm1 13h-2v-2h2v2zm0-4h-2V7h2v4z" />
              <path v-else d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
            <span v-if="dbState === 'verified'">Verified</span>
            <span v-else-if="dbState === 'failed'">Tampered!</span>
          </button>

          <!-- Security popover -->
          <div
            v-if="showSecurityPopover"
            class="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl z-50 p-4 text-left"
            :class="dbState === 'failed' ? 'border-red-200 dark:border-red-800' : ''"
          >
            <!-- Caret -->
            <div class="absolute right-4 -top-[7px] w-3 h-3 bg-white dark:bg-zinc-900 border-l border-t rotate-45"
              :class="dbState === 'failed' ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-zinc-700'"></div>

            <!-- FAILED state -->
            <template v-if="dbState === 'failed'">
              <div class="flex items-center gap-2 mb-3">
                <svg class="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm1 13h-2v-2h2v2zm0-4h-2V7h2v4z"/>
                </svg>
                <span class="text-sm font-semibold text-red-600 dark:text-red-400">Integrity Check Failed</span>
              </div>
              <p class="text-xs text-gray-700 dark:text-zinc-300 mb-3 leading-relaxed">
                The DuckDB WASM file did not match its expected fingerprint. This may indicate the file has been tampered with or corrupted in transit.
              </p>
              <div class="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-3">
                <p class="text-xs font-semibold text-red-600 dark:text-red-400">Do not use this session.</p>
                <p class="text-xs text-red-500 dark:text-red-400 mt-0.5">Any query results could be compromised.</p>
              </div>
              <button
                @click="reloadPage"
                class="w-full px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-md transition-colors duration-150"
              >
                Reload page
              </button>
            </template>

            <!-- VERIFIED state -->
            <template v-else>
              <!-- Title + version -->
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <svg class="h-4 w-4 text-emerald-500 dark:text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                  </svg>
                  <span class="text-sm font-semibold text-gray-900 dark:text-zinc-100">DuckDB Verified</span>
                </div>
                <code v-if="duckdbVersion" class="text-xs font-mono text-gray-400 dark:text-zinc-600">v{{ duckdbVersion }}</code>
              </div>

              <!-- Privacy -->
              <p class="text-xs text-gray-600 dark:text-zinc-400 mb-3 leading-relaxed">
                SQL executes entirely in this tab via WebAssembly. Files and queries never leave your device — nothing is sent to any server.
              </p>

              <!-- SHA-256 fingerprint -->
              <div v-if="wasmHash" class="mb-3">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-xs font-medium text-gray-500 dark:text-zinc-400">SHA-256 fingerprint</span>
                  <code class="text-xs font-mono text-gray-400 dark:text-zinc-600">{{ wasmFile }}</code>
                </div>
                <div class="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 rounded-md px-2.5 py-1.5">
                  <code class="text-xs font-mono text-gray-700 dark:text-zinc-300 flex-1 truncate">{{ wasmHash.slice(7) }}</code>
                  <button
                    @click="copyWasmHash"
                    class="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
                    :title="hashCopied ? 'Copied!' : 'Copy hash'"
                  >
                    <svg v-if="!hashCopied" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Trust model -->
              <div class="mb-3">
                <div class="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Trust model</div>
                <p class="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">Expected SHA-256 hashes are compiled into the JS bundle at build time and cannot be altered server-side independently. Every WASM and worker file is verified via <code class="font-mono">WebCrypto</code> before DuckDB initialises — a mismatch aborts loading entirely.</p>
              </div>

              <!-- CDN verification (IDS) -->
              <div class="border-t border-gray-200 dark:border-zinc-700 pt-3 mb-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-medium text-gray-500 dark:text-zinc-400">CDN verification</span>
                  <kbd class="text-xs font-mono text-gray-400 dark:text-zinc-600 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-700">⇧V</kbd>
                </div>

                <!-- Technical metadata -->
                <div class="rounded-md bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700/50 px-2.5 py-2 mb-2 space-y-1 font-mono text-xs">
                  <div class="flex gap-2">
                    <span class="text-gray-400 dark:text-zinc-600 w-8 shrink-0">pkg</span>
                    <span class="text-gray-600 dark:text-zinc-400">@duckdb/duckdb-wasm@{{ duckdbVersion }}</span>
                  </div>
                  <div class="flex gap-2">
                    <span class="text-gray-400 dark:text-zinc-600 w-8 shrink-0">file</span>
                    <span class="text-gray-600 dark:text-zinc-400">{{ wasmFile }}</span>
                  </div>
                  <div class="flex gap-2">
                    <span class="text-gray-400 dark:text-zinc-600 w-8 shrink-0">via</span>
                    <span class="text-gray-600 dark:text-zinc-400">cdn.jsdelivr.net · SHA-256</span>
                  </div>
                </div>

                <!-- Action / result row — full-width so content never wraps -->
                <button
                  v-if="idsState === null || idsState === 'error'"
                  @click="runIdsCheck"
                  class="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700 rounded-md text-xs text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors duration-150"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                  Verify against npm registry
                </button>

                <div v-else-if="idsState === 'checking'" class="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-md text-xs text-gray-500 dark:text-zinc-500">
                  <svg class="animate-spin h-3.5 w-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Fetching duckdb-wasm@{{ duckdbVersion }} from CDN…
                </div>

                <div v-else-if="idsState === 'match'" class="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-md text-xs text-emerald-700 dark:text-emerald-500">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span class="flex-1">Matches npm@{{ duckdbVersion }}</span>
                  <button @click="runIdsCheck" title="Re-check" class="text-emerald-500 dark:text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors text-base leading-none">↺</button>
                </div>

                <div v-else-if="idsState === 'mismatch'" class="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-md text-xs text-red-600 dark:text-red-400">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  Hash mismatch — local file differs from npm
                </div>

                <p v-if="idsState === 'error'" class="mt-1.5 text-xs text-yellow-600 dark:text-yellow-500">{{ idsError }}</p>

                <!-- Hash diff on mismatch -->
                <div v-if="idsState === 'mismatch' && idsPublicHash" class="mt-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-2.5 py-2 space-y-1.5 font-mono text-xs">
                  <div>
                    <div class="text-gray-500 dark:text-zinc-500 mb-0.5">Local (this session)</div>
                    <code class="text-gray-700 dark:text-zinc-300 break-all">{{ wasmHash?.slice(7) }}</code>
                  </div>
                  <div>
                    <div class="text-gray-500 dark:text-zinc-500 mb-0.5">CDN (npm@{{ duckdbVersion }})</div>
                    <code class="text-red-600 dark:text-red-400 break-all">{{ idsPublicHash.slice(7) }}</code>
                  </div>
                </div>
              </div>

              <!-- Build provenance -->
              <div class="border-t border-gray-200 dark:border-zinc-700 pt-3">
                <div class="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">Build provenance</div>
                <p class="text-xs text-gray-600 dark:text-zinc-400 mb-2 leading-relaxed">Built from public source on GitHub Actions with <code class="font-mono">npm ci</code> (pinned deps), deployed directly to GitHub Pages — no intermediate steps or third-party CDNs.</p>
                <div class="flex items-center gap-3">
                  <a href="https://github.com/jonathanwalker/SQLChef" target="_blank" rel="noopener" class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 17.07 3.633 16.7 3.633 16.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.807 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.333-5.466-5.93 0-1.31.468-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.52 11.52 0 013.003-.404c1.02.005 2.045.138 3.003.404 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.21 0 1.596-.015 2.877-.015 3.27 0 .315.21.69.825.57C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Source code
                  </a>
                  <a href="https://github.com/jonathanwalker/SQLChef/actions" target="_blank" rel="noopener" class="text-xs text-blue-600 dark:text-blue-400 hover:underline">Build logs</a>
                </div>
              </div>

              <!-- Developer: simulate tampered WASM -->
              <div class="border-t border-gray-200 dark:border-zinc-700 pt-3 mt-1">
                <div class="text-xs font-medium text-gray-400 dark:text-zinc-600 mb-1.5">Developer</div>
                <button
                  @click="simulateTamper"
                  class="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 transition-colors duration-150"
                >
                  Simulate tampered WASM →
                </button>
                <p class="mt-1.5 text-xs text-gray-400 dark:text-zinc-600 leading-relaxed">Triggers the tamper-detected UI without modifying any files. Reload to reset.</p>
              </div>
            </template>
          </div>
        </div>

        <!-- Theme toggle -->
        <button
          @click="toggleTheme"
          class="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors duration-150 flex items-center"
          :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <!-- Moon icon (show in light mode to switch to dark) -->
          <svg v-if="theme === 'light'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <!-- Sun icon (show in dark mode to switch to light) -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </button>

        <!-- Query History button -->
        <button
          @click="toggleHistory"
          class="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors duration-150 flex items-center"
          title="Query History"
        >
          <svg height="18px" version="1.1" viewBox="0 0 20 21" width="18px" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <g fill="none" fill-rule="evenodd" stroke="none" stroke-width="1">
              <path d="M10.5,0 C7,0 3.9,1.9 2.3,4.8 L0,2.5 L0,9 L6.5,9 L3.7,6.2 C5,3.7 7.5,2 10.5,2 C14.6,2 18,5.4 18,9.5 C18,13.6 14.6,17 10.5,17 C7.2,17 4.5,14.9 3.4,12 L1.3,12 C2.4,16 6.1,19 10.5,19 C15.8,19 20,14.7 20,9.5 C20,4.3 15.7,0 10.5,0 Z M9,5 L9,10.1 L13.7,12.9 L14.5,11.6 L10.5,9.2 L10.5,5 L9,5 Z" fill="currentColor" />
            </g>
          </svg>
        </button>

        <!-- GitHub link -->
        <a
          href="https://github.com/jonathanwalker/SQLChef"
          class="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors duration-150 flex items-center"
          title="View on GitHub"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 17.07 3.633 16.7 3.633 16.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.807 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.333-5.466-5.93 0-1.31.468-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.52 11.52 0 013.003-.404c1.02.005 2.045.138 3.003.404 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.21 0 1.596-.015 2.877-.015 3.27 0 .315.21.69.825.57C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
        </a>
      </div>
    </header>

    <Interface ref="interface" :history-item="selectedHistoryItem" @query-ran="onQueryRan" />

    <!-- Integrity failure overlay — blocks all interaction with the app -->
    <div
      v-if="dbState === 'failed'"
      class="fixed inset-0 z-40 flex items-center justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm"
    >
      <div class="max-w-sm w-full mx-4 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 rounded-2xl shadow-2xl p-8 text-center">
        <div class="flex justify-center mb-4">
          <div class="p-3 bg-red-50 dark:bg-red-950/50 rounded-full">
            <svg class="h-8 w-8 text-red-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm1 13h-2v-2h2v2zm0-4h-2V7h2v4z"/>
            </svg>
          </div>
        </div>
        <h2 class="text-base font-bold text-red-600 dark:text-red-400 mb-2">Integrity Check Failed</h2>
        <p class="text-sm text-gray-600 dark:text-zinc-400 mb-2 leading-relaxed">
          The DuckDB WASM file did not match its expected fingerprint and may have been tampered with.
        </p>
        <p class="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-6">Do not use this session.</p>
        <button
          @click="reloadPage"
          class="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors duration-150"
        >
          Reload page
        </button>
      </div>
    </div>

    <HistoryModal v-if="showHistory" :history="queryHistory" @close="showHistory = false" @restore="restoreItem" @delete-item="deleteHistoryItem" @clear-history="clearHistory" />
  </div>
</template>

<script>
import Interface from "./components/Interface.vue";
import HistoryModal from "./components/HistoryModal.vue";
import { initDuckDB, getWasmInfo, computeSHA256SRI } from "@/services/duckdbService";

function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

export default {
  name: "App",
  components: { Interface, HistoryModal },
  data() {
    return {
      showHistory: false,
      showSecurityPopover: false,
      hashCopied: false,
      queryHistory: [],
      selectedHistoryItem: null,
      dbInitialized: false,
      dbState: 'loading',
      wasmHash: null,
      wasmFile: null,
      duckdbVersion: null,
      idsState: null,   // null | 'checking' | 'match' | 'mismatch' | 'error'
      idsPublicHash: null,
      idsError: null,
      basePath: import.meta.env.BASE_URL,
      theme: localStorage.getItem('sqlchef-theme') || 'light',
    };
  },
  async mounted() {
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onGlobalKeydown);
    this.applyTheme(this.theme);
    const saved = localStorage.getItem("sqlchef-history");
    if (saved) {
      try { this.queryHistory = JSON.parse(saved); } catch (err) { console.warn("Could not parse saved history:", err); }
    }
    try {
      const { wasmHash } = await initDuckDB();
      this.dbInitialized = true;
      this.dbState = 'verified';
      this.wasmHash = wasmHash;
      const info = getWasmInfo();
      this.wasmFile = info.wasmFile;
      this.duckdbVersion = info.version;
    } catch (err) {
      console.error("Failed to initialize DuckDB in App.vue:", err);
      this.dbState = 'failed';
      alert("DuckDB integrity check failed — the WASM file did not match the expected hash.\n\nDo not use this session. Please reload and report this issue if the problem persists.");
    }
  },
  beforeUnmount() {
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onGlobalKeydown);
  },
  watch: {
    queryHistory: {
      deep: true,
      handler(newVal) { localStorage.setItem("sqlchef-history", safeStringify(newVal)); },
    },
  },
  methods: {
    onDocumentClick() {
      this.showSecurityPopover = false;
    },
    onGlobalKeydown(e) {
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.shiftKey && e.key.toLowerCase() === 'v' && this.dbState === 'verified') {
        e.preventDefault();
        this.showSecurityPopover = true;
        this.idsState = null;
        this.idsPublicHash = null;
        this.idsError = null;
        this.$nextTick(() => this.runIdsCheck());
      }
    },
    copyWasmHash() {
      if (!this.wasmHash) return;
      navigator.clipboard.writeText(this.wasmHash.slice(7)).then(() => {
        this.hashCopied = true;
        setTimeout(() => { this.hashCopied = false; }, 2000);
      });
    },
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('sqlchef-theme', this.theme);
      this.applyTheme(this.theme);
    },
    applyTheme(theme) {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    },
    toggleHistory() { this.showHistory = !this.showHistory; },
    onQueryRan({ query, results }) {
      this.queryHistory.push({ query, results, timestamp: Date.now() });
    },
    restoreItem(item) { this.selectedHistoryItem = item; this.showHistory = false; },
    deleteHistoryItem(item) {
      const idx = this.queryHistory.indexOf(item);
      if (idx !== -1) this.queryHistory.splice(idx, 1);
    },
    clearHistory() { this.queryHistory = []; localStorage.removeItem("sqlchef-history"); },
    reloadPage() { window.location.reload(); },
    toggleSecurityPopover() {
      if (this.dbState === 'loading') return;
      this.showSecurityPopover = !this.showSecurityPopover;
      // Reset IDS state each time the popover opens so the user gets a fresh check
      if (this.showSecurityPopover) {
        this.idsState = null;
        this.idsPublicHash = null;
        this.idsError = null;
      }
    },
    simulateTamper() {
      this.showSecurityPopover = false;
      this.dbState = 'failed';
    },
    async runIdsCheck() {
      this.idsState = 'checking';
      this.idsPublicHash = null;
      this.idsError = null;
      try {
        const { wasmFile, wasmHash, version } = getWasmInfo();
        if (!wasmFile || !wasmHash || !version) {
          throw new Error('WASM info not available — has DuckDB finished loading?');
        }
        const cdnUrl = `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${version}/dist/${wasmFile}`;
        const res = await fetch(cdnUrl);
        if (!res.ok) throw new Error(`CDN fetch failed: HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        const publicHash = await computeSHA256SRI(buffer);
        this.idsPublicHash = publicHash;
        this.idsState = publicHash === wasmHash ? 'match' : 'mismatch';
      } catch (err) {
        console.error('IDS check error:', err);
        this.idsState = 'error';
        this.idsError = err.message;
      }
    },
  },
};
</script>

<style>
.fixed.inset-0 { z-index: 9999; }
</style>
