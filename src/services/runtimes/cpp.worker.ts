/**
 * cpp.worker.ts — C/C++ execution via the Compiler Explorer (Godbolt) API.
 *
 * Uses the Godbolt REST API to compile and execute C/C++ code server-side.
 * No WASM binary needed — requires internet (same as WebRTC).
 */

const GODBOLT_API = 'https://godbolt.org/api/compiler';

// GCC 14.2 for C++ and C
const COMPILERS: Record<string, string> = {
  cpp: 'g142',
  c: 'cg142',
};

self.onmessage = async (event: MessageEvent) => {
  const { data } = event;

  if (data.type === 'init') {
    // No runtime to download — compiles server-side via Godbolt.
    // Verify connectivity with a quick test.
    try {
      const response = await fetch(`${GODBOLT_API}/${COMPILERS.cpp}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          source: 'int main() { return 0; }',
          options: {
            userArguments: '-O2',
            compilerOptions: { executorRequest: true },
            filters: { execute: true },
          },
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      self.postMessage({ type: 'ready' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      self.postMessage({ type: 'error', error: `Compiler Explorer unavailable: ${message}` });
    }
    return;
  }

  if (data.type === 'run') {
    const { code, language = 'cpp', timeout = 15000 } = data;
    const start = performance.now();
    const compilerId = COMPILERS[language] || COMPILERS.cpp;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${GODBOLT_API}/${compilerId}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          source: code,
          options: {
            userArguments: '-O2',
            compilerOptions: { executorRequest: true },
            filters: { execute: true },
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - start);

      if (!response.ok) {
        self.postMessage({
          type: 'result',
          stdout: '',
          stderr: `Compiler Explorer returned HTTP ${response.status}`,
          exitCode: 1,
          duration,
        });
        return;
      }

      const result = await response.json();

      // Build errors (compilation failed)
      if (result.buildResult && result.buildResult.code !== 0) {
        const stderr = (result.buildResult.stderr || [])
          .map((e: { text: string }) => e.text.replace(/\x1b\[[0-9;]*m/g, ''))
          .join('\n');
        self.postMessage({
          type: 'result',
          stdout: '',
          stderr: stderr || 'Compilation failed',
          exitCode: 1,
          duration,
        });
        return;
      }

      // Execution result
      const stdout = (result.stdout || [])
        .map((e: { text: string }) => e.text)
        .join('\n');
      const stderr = (result.stderr || [])
        .map((e: { text: string }) => e.text.replace(/\x1b\[[0-9;]*m/g, ''))
        .join('\n');

      self.postMessage({
        type: 'result',
        stdout,
        stderr,
        exitCode: result.code ?? 0,
        duration,
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - start);

      if (error instanceof DOMException && error.name === 'AbortError') {
        self.postMessage({
          type: 'result',
          stdout: '',
          stderr: `[Execution timed out after ${timeout / 1000}s]`,
          exitCode: 1,
          duration,
        });
      } else {
        const message = error instanceof Error ? error.message : String(error);
        self.postMessage({
          type: 'result',
          stdout: '',
          stderr: `Compiler Explorer error: ${message}`,
          exitCode: 1,
          duration,
        });
      }
    }
  }
};
