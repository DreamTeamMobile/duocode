import { useUIStore } from '../stores/uiStore';
import { useEditorStore } from '../stores/editorStore';
import { useExecutionStore } from '../stores/executionStore';
import { isExecutable } from '../services/code-executor';
import LanguageSelector from './CodeEditor/LanguageSelector';

export default function TabBar() {
  const activeTab = useUIStore((s) => s.activeTab);
  const switchTab = useUIStore((s) => s.switchTab);
  const language = useEditorStore((s) => s.language);
  const isRunning = useExecutionStore((s) => s.isRunning);
  const runCode = useExecutionStore((s) => s.runCode);
  const cancelCode = useExecutionStore((s) => s.cancelCode);

  const showRunButton = activeTab === 'code' && isExecutable(language);

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
