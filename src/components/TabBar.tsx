import { useUIStore } from '../stores/uiStore';
import { useEditorStore } from '../stores/editorStore';
import { useExecutionStore } from '../stores/executionStore';
import { useRuntimeStore } from '../stores/runtimeStore';
import { isExecutable, isWasmLanguage } from '../services/code-executor';
import LanguageSelector from './CodeEditor/LanguageSelector';

export default function TabBar() {
  const activeTab = useUIStore((s) => s.activeTab);
  const switchTab = useUIStore((s) => s.switchTab);
  const language = useEditorStore((s) => s.language);
  const isRunning = useExecutionStore((s) => s.isRunning);
  const runCode = useExecutionStore((s) => s.runCode);
  const cancelCode = useExecutionStore((s) => s.cancelCode);
  const runtimeInfo = useRuntimeStore((s) => s.getRuntime(language === 'c' ? 'cpp' : language));

  const showRunButton = activeTab === 'code' && isExecutable(language);
  const isWasm = isWasmLanguage(language);
  const isLoading = isWasm && runtimeInfo.status === 'loading';
  const hasError = isWasm && runtimeInfo.status === 'error';
  const progress = runtimeInfo.progress;

  // SVG progress ring params
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (progress / 100) * circumference;

  return (
    <div id="tabBarWrapper">
      <div id="tabBar">
        <button
          className={`tab-btn${activeTab === 'code' ? ' active' : ''}`}
          onClick={() => switchTab('code')}
        >
          Code
        </button>
        <button
          className={`tab-btn${activeTab === 'canvas' ? ' active' : ''}`}
          onClick={() => switchTab('canvas')}
        >
          Diagram
        </button>
      </div>
      {activeTab === 'code' && <LanguageSelector />}
      {showRunButton && (
        isRunning ? (
          <button
            className="icon-btn stop-btn"
            onClick={() => cancelCode?.()}
            title="Stop execution"
            aria-label="Stop execution"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          </button>
        ) : isLoading ? (
          <button
            className="icon-btn run-btn loading"
            disabled
            title={`Loading runtime... ${progress}%`}
            aria-label={`Loading runtime ${progress}%`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              {/* Background circle */}
              <circle
                cx="8" cy="8" r={radius}
                fill="none"
                stroke="var(--text-secondary)"
                strokeWidth="2"
                opacity="0.3"
              />
              {/* Progress arc */}
              <circle
                cx="8" cy="8" r={radius}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeDasharray={circumference}
                strokeDashoffset={progress > 0 ? strokeOffset : 0}
                strokeLinecap="round"
                transform="rotate(-90 8 8)"
                className={progress === 0 ? 'progress-ring-indeterminate' : ''}
              />
            </svg>
          </button>
        ) : hasError ? (
          <button
            className="icon-btn run-btn error"
            onClick={() => runCode?.()}
            title={`Runtime error — click to retry: ${runtimeInfo.error ?? ''}`}
            aria-label="Retry loading runtime"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--danger)">
              <path d="M8 1l7 14H1L8 1zm0 5v4m0 2v1" fill="none" stroke="var(--danger)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <button
            className="icon-btn run-btn"
            onClick={() => runCode?.()}
            title="Run code (Ctrl+Enter)"
            aria-label="Run code"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2l10 6-10 6V2z" />
            </svg>
          </button>
        )
      )}
    </div>
  );
}
