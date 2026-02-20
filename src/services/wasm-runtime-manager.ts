/**
 * wasm-runtime-manager.ts — Central orchestrator for WASM language runtimes.
 *
 * Manages persistent Web Workers per language. Each worker loads its runtime
 * once and accepts multiple run messages. Progress is tracked and exposed
 * via the runtimeStore.
 */

import type { ExecutionResult } from '../stores/executionStore';
import { useRuntimeStore } from '../stores/runtimeStore';

// Languages supported via WASM/external runtimes (not native JS)
const WASM_LANGUAGES = new Set(['python', 'c', 'cpp', 'go', 'ruby', 'lua']);

// Worker factory map — uses Vite's `new Worker(new URL(...))` pattern for code splitting
function createWorker(lang: string): Worker {
  switch (lang) {
    case 'python':
      return new Worker(new URL('./runtimes/python.worker.ts', import.meta.url), { type: 'module' });
    case 'c':
    case 'cpp':
      return new Worker(new URL('./runtimes/cpp.worker.ts', import.meta.url), { type: 'module' });
    case 'go':
      return new Worker(new URL('./runtimes/go.worker.ts', import.meta.url), { type: 'module' });
    case 'ruby':
      return new Worker(new URL('./runtimes/ruby.worker.ts', import.meta.url), { type: 'module' });
    case 'lua':
      return new Worker(new URL('./runtimes/lua.worker.ts', import.meta.url), { type: 'module' });
    default:
      throw new Error(`No WASM runtime for language: ${lang}`);
  }
}

// Canonical language key (c and cpp share a worker, but we track them separately)
function workerKey(lang: string): string {
  return lang === 'c' ? 'cpp' : lang;
}

interface WorkerEntry {
  worker: Worker;
  ready: boolean;
  pendingRun: {
    resolve: (result: ExecutionResult) => void;
    reject: (reason: string) => void;
  } | null;
}

const workers = new Map<string, WorkerEntry>();

export function isWasmLanguage(lang: string): boolean {
  return WASM_LANGUAGES.has(lang);
}

/**
 * Start loading the runtime for a language in the background.
 * Safe to call multiple times — no-ops if already loading or ready.
 */
export function preloadRuntime(lang: string): void {
  // Guard: Web Workers not available (e.g. test environment)
  if (typeof Worker === 'undefined') return;

  const key = workerKey(lang);
  const store = useRuntimeStore.getState();
  const info = store.getRuntime(key);

  // Already loading or ready
  if (info.status === 'loading' || info.status === 'ready') return;

  store.setStatus(key, 'loading');
  store.setProgress(key, 0);

  const worker = createWorker(lang);
  const entry: WorkerEntry = { worker, ready: false, pendingRun: null };
  workers.set(key, entry);

  worker.onmessage = (event: MessageEvent) => {
    const { data } = event;
    const store = useRuntimeStore.getState();

    switch (data.type) {
      case 'progress': {
        const pct = data.total > 0 ? Math.round((data.loaded / data.total) * 100) : 0;
        store.setProgress(key, pct);
        break;
      }

      case 'ready':
        entry.ready = true;
        store.setStatus(key, 'ready');
        break;

      case 'result':
        if (entry.pendingRun) {
          entry.pendingRun.resolve({
            stdout: data.stdout ?? '',
            stderr: data.stderr ?? '',
            exitCode: data.exitCode ?? 0,
            duration: data.duration ?? 0,
          });
          entry.pendingRun = null;
        }
        break;

      case 'error':
        if (entry.pendingRun) {
          entry.pendingRun.reject(data.error ?? 'Runtime error');
          entry.pendingRun = null;
        } else {
          // Initialization error
          store.setError(key, data.error ?? 'Failed to load runtime');
        }
        break;
    }
  };

  worker.onerror = (event: ErrorEvent) => {
    const store = useRuntimeStore.getState();
    store.setError(key, event.message || 'Worker error');
    if (entry.pendingRun) {
      entry.pendingRun.reject(event.message || 'Worker error');
      entry.pendingRun = null;
    }
  };

  worker.postMessage({ type: 'init' });
}

/**
 * Execute code using the WASM runtime for the given language.
 * Will preload if not already loaded. Returns a promise with the result.
 */
export function executeWasm(
  lang: string,
  code: string,
  timeout = 10_000,
): Promise<ExecutionResult> {
  const key = workerKey(lang);
  const entry = workers.get(key);

  if (!entry || !entry.ready) {
    return Promise.reject('Runtime not loaded');
  }

  // Cancel any pending run
  if (entry.pendingRun) {
    entry.pendingRun.reject('Superseded by new execution');
  }

  return new Promise<ExecutionResult>((resolve, reject) => {
    entry.pendingRun = { resolve, reject };
    entry.worker.postMessage({ type: 'run', code, language: lang, timeout });
  });
}

/**
 * Stop execution by terminating the worker and re-creating it as ready.
 * This is the nuclear option — the runtime must be re-initialized.
 */
export function stopWasmExecution(lang: string): void {
  const key = workerKey(lang);
  const entry = workers.get(key);
  if (!entry) return;

  if (entry.pendingRun) {
    entry.pendingRun.reject('Execution stopped by user');
    entry.pendingRun = null;
  }

  // Terminate and remove — next execution will trigger preload again
  entry.worker.terminate();
  workers.delete(key);
  useRuntimeStore.getState().setStatus(key, 'idle');
}

/**
 * Get the runtime status for a language (convenience wrapper).
 */
export function getRuntimeStatus(lang: string) {
  return useRuntimeStore.getState().getRuntime(workerKey(lang));
}
