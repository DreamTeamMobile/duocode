/**
 * ruby.worker.ts — Ruby execution via ruby.wasm in a Web Worker.
 *
 * Downloads the Ruby WASM binary from CDN, initializes via DefaultRubyVM,
 * and captures stdout/stderr by overriding console methods.
 */

const RUBY_WASM_URL = 'https://cdn.jsdelivr.net/npm/@ruby/3.3-wasm-wasi@2.8.1/dist/ruby+stdlib.wasm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rubyVM: any = null;

// Capture console output (DefaultRubyVM routes puts/print → console.log)
let capturedStdout: string[] = [];
let capturedStderr: string[] = [];
let capturing = false;

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: unknown[]) => {
  if (capturing) {
    capturedStdout.push(args.map(String).join(' '));
  } else {
    originalLog(...args);
  }
};

console.error = (...args: unknown[]) => {
  if (capturing) {
    capturedStderr.push(args.map(String).join(' '));
  } else {
    originalError(...args);
  }
};

console.warn = (...args: unknown[]) => {
  if (capturing) {
    capturedStderr.push(args.map(String).join(' '));
  } else {
    originalWarn(...args);
  }
};

async function fetchWithProgress(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  const contentLength = Number(response.headers.get('content-length')) || 0;

  if (!response.body || contentLength === 0) {
    return response.arrayBuffer();
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

  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result.buffer;
}

self.onmessage = async (event: MessageEvent) => {
  const { data } = event;

  if (data.type === 'init') {
    try {
      // Download WASM binary with progress tracking
      const wasmBuffer = await fetchWithProgress(RUBY_WASM_URL);
      const module = await WebAssembly.compile(wasmBuffer);

      // Import DefaultRubyVM from the browser entry
      const { DefaultRubyVM } = await import('@ruby/wasm-wasi/dist/browser');
      const { vm } = await DefaultRubyVM(module, { consolePrint: true });
      rubyVM = vm;

      self.postMessage({ type: 'ready' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      self.postMessage({ type: 'error', error: `Failed to load Ruby runtime: ${message}` });
    }
    return;
  }

  if (data.type === 'run') {
    if (!rubyVM) {
      self.postMessage({ type: 'error', error: 'Ruby runtime not initialized' });
      return;
    }

    const { code, timeout = 10000 } = data;
    capturedStdout = [];
    capturedStderr = [];
    capturing = true;

    const start = performance.now();
    const timeoutId = setTimeout(() => {
      capturing = false;
      const duration = Math.round(performance.now() - start);
      self.postMessage({
        type: 'result',
        stdout: capturedStdout.join('\n'),
        stderr: capturedStderr.join('\n') + `\n[Execution timed out after ${timeout / 1000}s]`,
        exitCode: 1,
        duration,
      });
    }, timeout);

    try {
      rubyVM.eval(code);
      clearTimeout(timeoutId);
      capturing = false;
      const duration = Math.round(performance.now() - start);

      self.postMessage({
        type: 'result',
        stdout: capturedStdout.join('\n'),
        stderr: capturedStderr.join('\n'),
        exitCode: 0,
        duration,
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      capturing = false;
      const duration = Math.round(performance.now() - start);
      const message = error instanceof Error ? error.message : String(error);

      self.postMessage({
        type: 'result',
        stdout: capturedStdout.join('\n'),
        stderr: capturedStderr.join('\n') + (capturedStderr.length ? '\n' : '') + message,
        exitCode: 1,
        duration,
      });
    }
  }
};
