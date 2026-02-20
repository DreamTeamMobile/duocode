/**
 * code-executor.ts — Framework-agnostic service for running code.
 *
 * JS/TS: sandboxed Web Worker (fresh per execution).
 * WASM languages (Python, C/C++, Go, Ruby, Lua): persistent workers via wasm-runtime-manager.
 */

import type { ExecutionResult } from '../stores/executionStore';
import { isWasmLanguage, executeWasm, stopWasmExecution, preloadRuntime } from './wasm-runtime-manager';

const JS_LANGUAGES = new Set(['javascript', 'typescript']);
const WASM_LANGUAGES = new Set(['python', 'c', 'cpp', 'go', 'ruby', 'lua']);

let worker: Worker | null = null;
let currentReject: ((reason: string) => void) | null = null;

export function isExecutable(language: string): boolean {
  return JS_LANGUAGES.has(language) || WASM_LANGUAGES.has(language);
}

export function runCode(
  code: string,
  language: string,
  timeout = 10_000,
): Promise<ExecutionResult> {
  if (isWasmLanguage(language)) {
    return executeWasm(language, code, timeout);
  }

  // JS/TS: fresh worker per execution
  terminateWorker();

  return new Promise<ExecutionResult>((resolve, reject) => {
    currentReject = reject;

    worker = new Worker(
      new URL('./code-executor.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'result') {
        resolve(event.data as ExecutionResult);
        cleanupWorker();
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      reject(event.message || 'Worker error');
      cleanupWorker();
    };

    worker.postMessage({ type: 'run', code, language, timeout });
  });
}

export function stopExecution(): void {
  if (currentReject) {
    currentReject('Execution stopped by user');
  }
  terminateWorker();
}

export { preloadRuntime, isWasmLanguage } from './wasm-runtime-manager';

function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  currentReject = null;
}

function cleanupWorker(): void {
  worker = null;
  currentReject = null;
}
