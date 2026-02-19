import { useRef, useEffect } from 'react';
import { useExecutionStore } from '../../stores/executionStore';
import { useEditorStore } from '../../stores/editorStore';
import { isExecutable } from '../../services/code-executor';

export default function OutputPanel() {
  const isRunning = useExecutionStore((s) => s.isRunning);
  const output = useExecutionStore((s) => s.output);
  const panelExpanded = useExecutionStore((s) => s.panelExpanded);
  const togglePanel = useExecutionStore((s) => s.togglePanel);
  const language = useEditorStore((s) => s.language);
  const outputRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current && panelExpanded) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, panelExpanded]);

  // Hide when language doesn't support execution, or no output and not running
  if (!isExecutable(language) || (!output && !isRunning)) return null;

  const hasError = output && output.exitCode !== 0;
  const hasOutput = output && (output.stdout || output.stderr);

  return (
    <div className={`output-panel${panelExpanded ? ' expanded' : ' collapsed'}`}>
      <div className="output-header" onClick={togglePanel}>
        <div className="output-header-left">
          {isRunning ? (
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
          {isRunning && (
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
          {isRunning && !hasOutput && (
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
