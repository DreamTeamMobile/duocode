/**
 * code-executor.worker.ts — Sandboxed Web Worker for JS/TS code execution.
 *
 * Receives { type: 'run', code, language } messages.
 * Captures console output, enforces a timeout, and posts back results.
 */

import ts from 'typescript';

interface RunMessage {
  type: 'run';
  code: string;
  language: string;
  timeout?: number;
}

interface OutputLine {
  stream: 'stdout' | 'stderr';
  text: string;
}

const DEFAULT_TIMEOUT = 10_000; // 10 seconds
const MAX_OUTPUT_SIZE = 100_000; // 100KB per stream

self.onmessage = (event: MessageEvent<RunMessage>) => {
  const { code, language, timeout = DEFAULT_TIMEOUT } = event.data;
  if (event.data.type !== 'run') return;

  const output: OutputLine[] = [];
  let totalSize = 0;
  let truncated = false;

  function addOutput(stream: 'stdout' | 'stderr', args: unknown[]) {
    if (truncated) return;
    const text = args.map(stringifyArg).join(' ');
    totalSize += text.length;
    if (totalSize > MAX_OUTPUT_SIZE) {
      output.push({ stream: 'stderr', text: '\n[Output truncated — exceeded 100KB limit]' });
      truncated = true;
      return;
    }
    output.push({ stream, text });
  }

  // Override console methods to capture output
  const fakeConsole = {
    log: (...args: unknown[]) => addOutput('stdout', args),
    info: (...args: unknown[]) => addOutput('stdout', args),
    warn: (...args: unknown[]) => addOutput('stderr', args),
    error: (...args: unknown[]) => addOutput('stderr', args),
    debug: (...args: unknown[]) => addOutput('stdout', args),
    dir: (...args: unknown[]) => addOutput('stdout', args),
    table: (...args: unknown[]) => addOutput('stdout', args),
    clear: () => { output.length = 0; totalSize = 0; truncated = false; },
  };

  const start = performance.now();

  // Timeout guard
  const timeoutId = setTimeout(() => {
    const duration = Math.round(performance.now() - start);
    self.postMessage({
      type: 'result',
      stdout: collectStream(output, 'stdout'),
      stderr: collectStream(output, 'stderr') + `\n[Execution timed out after ${timeout / 1000}s]`,
      exitCode: 1,
      duration,
    });
    self.close();
  }, timeout);

  try {
    let jsCode = code;

    if (language === 'typescript') {
      const result = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          strict: false,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      });
      jsCode = result.outputText;
    }

    // Execute in a closure that provides our fake console
    const wrappedCode = `
      "use strict";
      return (function(console) {
        ${jsCode}
      });
    `;
    const factory = new Function(wrappedCode);
    const executor = factory();
    executor(fakeConsole);

    clearTimeout(timeoutId);
    const duration = Math.round(performance.now() - start);

    self.postMessage({
      type: 'result',
      stdout: collectStream(output, 'stdout'),
      stderr: collectStream(output, 'stderr'),
      exitCode: 0,
      duration,
    });
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const duration = Math.round(performance.now() - start);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error && error.stack ? error.stack : '';

    self.postMessage({
      type: 'result',
      stdout: collectStream(output, 'stdout'),
      stderr: collectStream(output, 'stderr') +
        (output.some(l => l.stream === 'stderr') ? '\n' : '') +
        (errorStack || errorMessage),
      exitCode: 1,
      duration,
    });
  }
};

function stringifyArg(arg: unknown): string {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'function') return `[Function: ${arg.name || 'anonymous'}]`;
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}

function collectStream(output: OutputLine[], stream: 'stdout' | 'stderr'): string {
  return output
    .filter((l) => l.stream === stream)
    .map((l) => l.text)
    .join('\n');
}
