/**
 * lua.worker.ts — Wasmoon-based Lua execution in a Web Worker.
 *
 * Uses Wasmoon (Lua 5.4 compiled to WASM, ~300KB) for Lua code execution.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let luaFactory: any = null;

self.onmessage = async (event: MessageEvent) => {
  const { data } = event;

  if (data.type === 'init') {
    try {
      const { LuaFactory } = await import('wasmoon');
      luaFactory = new LuaFactory();
      // Pre-create an engine to verify the WASM loads correctly
      const testEngine = await luaFactory.createEngine();
      testEngine.global.close();
      self.postMessage({ type: 'ready' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      self.postMessage({ type: 'error', error: `Failed to load Lua runtime: ${message}` });
    }
    return;
  }

  if (data.type === 'run') {
    if (!luaFactory) {
      self.postMessage({ type: 'error', error: 'Lua runtime not initialized' });
      return;
    }

    const { code, timeout = 10000 } = data;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const start = performance.now();

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let engine: any = null;
    try {
      engine = await luaFactory.createEngine();

      // Override print to capture output
      engine.global.set('print', (...args: unknown[]) => {
        stdoutLines.push(args.map(String).join('\t'));
      });

      // Override io.write for direct output
      engine.global.set('io', {
        write: (...args: unknown[]) => {
          stdoutLines.push(args.map(String).join(''));
        },
      });

      await engine.doString(code);
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
    } finally {
      if (engine) {
        try { engine.global.close(); } catch { /* ignore */ }
      }
    }
  }
};
