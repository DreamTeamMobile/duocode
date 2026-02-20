import { useCallback, useEffect } from 'react';
import { useExecutionStore } from '../stores/executionStore';
import { useEditorStore } from '../stores/editorStore';
import { runCode, stopExecution as stopWorker, isExecutable, isWasmLanguage, preloadRuntime } from '../services/code-executor';
import { stopWasmExecution } from '../services/wasm-runtime-manager';
import { useRuntimeStore } from '../stores/runtimeStore';
import type { DataChannelMessage } from '../services/connection-manager';

interface UseExecutionSyncOptions {
  sendMessage?: (data: DataChannelMessage) => boolean;
}

interface UseExecutionSyncReturn {
  handleMessage: (message: DataChannelMessage) => void;
}

/**
 * useExecutionSync — runs code locally and syncs results over the data channel.
 *
 * - executeCode() reads the current editor code/language, runs it in a Worker,
 *   broadcasts execution-start and execution-result to peers.
 * - handleMessage() receives execution events from peers and updates the store.
 * - Preloads WASM runtimes when the user switches to a WASM language.
 */
export function useExecutionSync({
  sendMessage,
}: UseExecutionSyncOptions = {}): UseExecutionSyncReturn {
  const startExecution = useExecutionStore((s) => s.startExecution);
  const setResult = useExecutionStore((s) => s.setResult);
  const stopExecution = useExecutionStore((s) => s.stopExecution);
  const setCallbacks = useExecutionStore((s) => s.setCallbacks);
  const language = useEditorStore((s) => s.language);

  // Preload WASM runtime when user switches to a WASM language
  useEffect(() => {
    if (isWasmLanguage(language)) {
      preloadRuntime(language);
    }
  }, [language]);

  const executeCode = useCallback(async () => {
    const { code, language } = useEditorStore.getState();
    if (!isExecutable(language)) return;

    // For WASM languages, ensure runtime is loaded before executing
    if (isWasmLanguage(language)) {
      const runtimeInfo = useRuntimeStore.getState().getRuntime(language === 'c' ? 'cpp' : language);
      if (runtimeInfo.status === 'idle' || runtimeInfo.status === 'error') {
        // Trigger preload and inform user
        preloadRuntime(language);
        const errorResult = {
          stdout: '',
          stderr: 'Runtime is loading... Please try again in a moment.',
          exitCode: 1,
          duration: 0,
        };
        setResult(errorResult);
        return;
      }
      if (runtimeInfo.status === 'loading') {
        const errorResult = {
          stdout: '',
          stderr: 'Runtime is still loading... Please wait.',
          exitCode: 1,
          duration: 0,
        };
        setResult(errorResult);
        return;
      }
    }

    startExecution();

    if (sendMessage) {
      sendMessage({
        type: 'execution-start',
        language,
        timestamp: Date.now(),
      });
    }

    try {
      const result = await runCode(code, language);
      setResult(result);

      if (sendMessage) {
        sendMessage({
          type: 'execution-result',
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          duration: result.duration,
        });
      }
    } catch {
      const errorResult = {
        stdout: '',
        stderr: 'Execution failed',
        exitCode: 1,
        duration: 0,
      };
      setResult(errorResult);

      if (sendMessage) {
        sendMessage({
          type: 'execution-result',
          ...errorResult,
        });
      }
    }
  }, [sendMessage, startExecution, setResult]);

  const cancelExecution = useCallback(() => {
    const { language } = useEditorStore.getState();
    if (isWasmLanguage(language)) {
      stopWasmExecution(language);
    } else {
      stopWorker();
    }
    stopExecution();
  }, [stopExecution]);

  // Register callbacks on the store so components can trigger execution
  useEffect(() => {
    setCallbacks(executeCode, cancelExecution);
  }, [executeCode, cancelExecution, setCallbacks]);

  const handleMessage = useCallback(
    (message: DataChannelMessage) => {
      switch (message.type) {
        case 'execution-start':
          startExecution();
          break;

        case 'execution-result':
          setResult({
            stdout: message.stdout,
            stderr: message.stderr,
            exitCode: message.exitCode,
            duration: message.duration,
          });
          break;

        default:
          break;
      }
    },
    [startExecution, setResult],
  );

  return { handleMessage };
}
