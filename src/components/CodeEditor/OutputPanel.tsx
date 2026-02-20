import { useRef, useEffect } from 'react';
import { useExecutionStore } from '../../stores/executionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useRuntimeStore } from '../../stores/runtimeStore';
import { isExecutable, isWasmLanguage } from '../../services/code-executor';

const LANGUAGE_NAMES: Record<string, string> = {
  python: 'Python',
  c: 'C',
  cpp: 'C++',
  go: 'Go',
  ruby: 'Ruby',
  lua: 'Lua',
};

export default function OutputPanel() {
  const isRunning = useExecutionStore((s) => s.isRunning);
  const output = useExecutionStore((s) => s.output);
  const panelExpanded = useExecutionStore((s) => s.panelExpanded);
  const togglePanel = useExecutionStore((s) => s.togglePanel);
  const language = useEditorStore((s) => s.language);
  const runtimeInfo = useRuntimeStore((s) => s.getRuntime(language === 'c' ? 'cpp' : language));
  const outputRef = useRef<HTMLPreElement>(null);

  const isWasm = isWasmLanguage(language);
  const isLoading = isWasm && runtimeInfo.status === 'loading';

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current && panelExpanded) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, panelExpanded]);

  // Hide when language doesn't support execution, or no output/loading/running
  if (!isExecutable(language) || (!output && !isRunning && !isLoading)) return null;

  const hasError = output && output.exitCode !== 0;
  const hasOutput = output && (output.stdout || output.stderr);
  const langName = LANGUAGE_NAMES[language] || language;

  return (
    <div className={`output-panel${panelExpanded ? ' expanded' : ' collapsed'}`}>
      <div className="output-header" onClick={togglePanel}>
        <div className="output-header-left">
          {isLoading ? (
            <span className="output-spinner" />
          ) : isRunning ? (
            <span className="output-spinner" />
          ) : output ? (
            <span className={`output-status-icon ${hasError ? 'error' : 'success'}`}>
              {hasError ? '\u2717' : '\u2713'}
            </span>
          ) : null}
          <span className="output-title">Output</span>
          {output && (
            <span className="output-duration">{output.duration}ms</span>
          )}
          {isLoading && (
            <span className="output-running-label">
              Downloading {langName} runtime... {runtimeInfo.progress > 0 ? `${runtimeInfo.progress}%` : ''}
            </span>
          )}
          {isRunning && !isLoading && (
            <span className="output-running-label">Running...</span>
          )}
        </div>
        <button
          className="output-toggle"
          aria-label={panelExpanded ? 'Collapse output' : 'Expand output'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="currentColor"
            style={{ transform: panelExpanded ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.15s' }}
          >
            <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {panelExpanded && (
        <pre className="output-body" ref={outputRef}>
          {isLoading && !hasOutput && (
            <span className="output-placeholder">
              Loading {langName} runtime... {runtimeInfo.progress > 0 ? `${runtimeInfo.progress}%` : 'please wait'}
            </span>
          )}
          {isRunning && !hasOutput && !isLoading && (
            <span className="output-placeholder">Executing...</span>
          )}
          {output?.stdout && (
            <span className="output-stdout">{output.stdout}</span>
          )}
          {output?.stdout && output?.stderr && '\n'}
          {output?.stderr && (
            <span className="output-stderr">{output.stderr}</span>
          )}
          {output && !output.stdout && !output.stderr && (
            <span className="output-placeholder">(No output)</span>
          )}
        </pre>
      )}
    </div>
  );
}
