/**
 * go.worker.ts — Go execution via the Go Playground API.
 *
 * Uses the official Go Playground compile endpoint (play.golang.org/compile)
 * which has full CORS support. No WASM binary needed — requires internet.
 */

const GO_PLAYGROUND_URL = 'https://play.golang.org/compile';

self.onmessage = async (event: MessageEvent) => {
  const { data } = event;

  if (data.type === 'init') {
    // No runtime to download — Go compiles server-side via Playground API.
    // Just verify connectivity with a quick test.
    try {
      const response = await fetch(GO_PLAYGROUND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ body: 'package main\nfunc main() {}', version: '2' }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      self.postMessage({ type: 'ready' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      self.postMessage({ type: 'error', error: `Go Playground unavailable: ${message}` });
    }
    return;
  }

  if (data.type === 'run') {
    const { code, timeout = 15000 } = data;
    const start = performance.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(GO_PLAYGROUND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ body: code, version: '2' }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - start);

      if (!response.ok) {
        self.postMessage({
          type: 'result',
          stdout: '',
          stderr: `Go Playground returned HTTP ${response.status}`,
          exitCode: 1,
          duration,
        });
        return;
      }

      const result = await response.json();

      // Compile errors
      if (result.Errors) {
        self.postMessage({
          type: 'result',
          stdout: '',
          stderr: result.Errors,
          exitCode: 1,
          duration,
        });
        return;
      }

      // Parse events into stdout/stderr
      let stdout = '';
      let stderr = '';

      if (result.Events) {
        for (const event of result.Events) {
          if (event.Kind === 'stdout') {
            stdout += event.Message;
          } else if (event.Kind === 'stderr') {
            stderr += event.Message;
          } else {
            // Default to stdout for unknown kinds
            stdout += event.Message;
          }
        }
      }

      self.postMessage({
        type: 'result',
        stdout,
        stderr,
        exitCode: result.Status ?? 0,
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
          stderr: `Go Playground error: ${message}`,
          exitCode: 1,
          duration,
        });
      }
    }
  }
};
