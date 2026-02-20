/**
 * python.worker.ts — Pyodide-based Python execution in a Web Worker.
 *
 * Uses the pyodide npm package which loads the WASM binary from CDN.
 * Intercepts fetch to track download progress of the .wasm file.
 */

import type { loadPyodide as LoadPyodideType } from 'pyodide';

type PyodideInterface = Awaited<ReturnType<typeof LoadPyodideType>>;

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';

let pyodide: PyodideInterface | null = null;

// Intercept fetch to track .wasm download progress
const originalFetch = globalThis.fetch;
globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (url.endsWith('.wasm')) {
    const response = await originalFetch(input, init);
    const contentLength = Number(response.headers.get('content-length')) || 0;

    if (!response.body || contentLength === 0) {
      return response;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      self.postMessage({ type: 'progress', loaded, total: contentLength });
    }

    // Reconstruct response from chunks
    const body = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  return originalFetch(input, init);
};

self.onmessage = async (event: MessageEvent) => {
  const { data } = event;

  if (data.type === 'init') {
    try {
      const { loadPyodide } = await import('pyodide');
      pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });
      self.postMessage({ type: 'ready' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      self.postMessage({ type: 'error', error: `Failed to load Python runtime: ${message}` });
    }
    return;
  }

  if (data.type === 'run') {
    if (!pyodide) {
      self.postMessage({ type: 'error', error: 'Python runtime not initialized' });
      return;
    }

    const { code, timeout = 10000 } = data;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    pyodide.setStdout({ batched: (text: string) => stdoutLines.push(text) });
    pyodide.setStderr({ batched: (text: string) => stderrLines.push(text) });

    const start = performance.now();

    // Timeout guard
    const timeoutId = setTimeout(() => {
      const duration = Math.round(performance.now() - start);
      self.postMessage({
        type: 'result',
        stdout: stdoutLines.join('\n'),
        stderr: stderrLines.join('\n') + `\n[Execution timed out after ${timeout / 1000}s]`,
        exitCode: 1,
        duration,
      });
    }, timeout);

    try {
      await pyodide.runPythonAsync(code);
      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - start);

      self.postMessage({
        type: 'result',
        stdout: stdoutLines.join('\n'),
        stderr: stderrLines.join('\n'),
        exitCode: 0,
        duration,
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - start);
      const message = error instanceof Error ? error.message : String(error);

      self.postMessage({
        type: 'result',
        stdout: stdoutLines.join('\n'),
        stderr: stderrLines.join('\n') + (stderrLines.length ? '\n' : '') + message,
        exitCode: 1,
        duration,
      });
    }
  }
};
