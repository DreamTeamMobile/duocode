/**
 * code-executor.ts — Framework-agnostic service for running JS/TS code
 * in a sandboxed Web Worker.
 */

import type { ExecutionResult } from '../stores/executionStore';

const EXECUTABLE_LANGUAGES = new Set(['javascript', 'typescript']);

let worker: Worker | null = null;
let currentReject: ((reason: string) => void) | null = null;

export function isExecutable(language: string): boolean {
  return EXECUTABLE_LANGUAGES.has(language);
}

export function runCode(
  code: string,
  language: string,
  timeout = 10_000,
): Promise<ExecutionResult> {
  // Terminate any in-progress run
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
