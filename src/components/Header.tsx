import { useState, useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useSessionStore } from '../stores/sessionStore';
import { useEditorStore } from '../stores/editorStore';
import { useMessagesStore } from '../stores/messagesStore';
import { useToastStore } from '../stores/toastStore';
import { getShareableURL } from '../services/session-logic';
import { exportToPDF } from '../services/pdf-export';
import type { ChatMessage } from '../services/pdf-export';
import { APP_VERSION } from '../version';

function SyncIndicator() {
  const connectionState = useConnectionStore((s) => s.connectionState);

  const statusMap: Record<string, { className: string; title: string }> = {
    connected: { className: 'synced', title: 'Synced' },
    connecting: { className: 'syncing', title: 'Syncing...' },
    reconnecting: { className: 'pending', title: 'Reconnecting...' },
    error: { className: 'error', title: 'Sync error' },
    disconnected: { className: 'offline', title: 'Offline' },
  };

  const status = statusMap[connectionState] || statusMap.disconnected;

  return (
    <span
      className={`sync-indicator ${status.className}`}
      title={status.title}
    >
      <span className="sync-dot" />
    </span>
  );
}

function SessionTimer() {
  const sessionStartTime = useSessionStore((s) => s.sessionStartTime);
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!sessionStartTime) {
      setElapsed('00:00:00');
      return;
    }

    function update() {
      const diff = Math.floor((Date.now() - sessionStartTime!) / 1000);
      const h = String(Math.floor(diff / 3600)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    }

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [sessionStartTime]);

  return (
    <span className="session-timer" title="Session duration">
      {elapsed}
    </span>
  );
}

function ParticipantCount() {
  const participants = useSessionStore((s) => s.participants);
  const peerName = useSessionStore((s) => s.peerName);

  // Count = 1 (self, if named) + remote participants
  const count = (peerName ? 1 : 0) + Object.keys(participants).length;

  return <span id="participantCount" className="participant-count">{count}</span>;
}

function ConnectionStatusIndicator() {
  const connectionType = useConnectionStore((s) => s.connectionType);
  const latency = useConnectionStore((s) => s.latency);

  const modeLabel = connectionType || '--';
  const modeClass = connectionType || '';

  let latencyLabel = '--';
  let latencyClass = '';
  if (latency != null) {
    latencyLabel = `${latency}ms`;
    if (latency < 100) latencyClass = 'low';
    else if (latency < 300) latencyClass = 'medium';
    else latencyClass = 'high';
  }

  return (
    <span className="connection-status" title="Connection status">
      <span className={`conn-mode ${modeClass}`}>{modeLabel}</span>
      <span className={`conn-latency ${latencyClass}`}>{latencyLabel}</span>
    </span>
  );
}

interface ThemeToggleIconProps {
  theme: string;
}

function ThemeToggleIcon({ theme }: ThemeToggleIconProps) {
  if (theme === 'dark') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function Header() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const showNewSessionModal = useUIStore((s) => s.showNewSessionModal);

  const handleShare = useCallback(async () => {
    const url = getShareableURL();
    try {
      await navigator.clipboard.writeText(url);
      useToastStore.getState().showSuccess('Session URL copied to clipboard');
    } catch {
      useToastStore.getState().showError('Failed to copy URL. Please copy it manually from the address bar.');
    }
  }, []);

  const handleExportPDF = useCallback(() => {
    const session = useSessionStore.getState();
    const editor = useEditorStore.getState();
    const msgs = useMessagesStore.getState();
    const canvasElement = document.querySelector('#diagramCanvas') as HTMLCanvasElement | null;

    try {
      const filename = exportToPDF({
        sessionId: session.sessionId ?? '',
        peerName: session.peerName ?? '',
        participants: session.participants,
        sessionStartTime: session.sessionStartTime,
        code: editor.code,
        language: editor.language,
        messages: msgs.messages as unknown as ChatMessage[],
        canvasElement,
      });
      useToastStore.getState().showSuccess(`PDF saved: ${filename}`);
    } catch (err) {
      console.error('[Header] PDF export failed:', err);
      useToastStore.getState().showError('PDF export failed');
    }
  }, []);

  return (
    <header>
      <div className="header-left">
        <h1 className="clickable-title" title="Click for debug info">DuoCode</h1>
        <span className="app-version">v{APP_VERSION}</span>
        <SyncIndicator />
        <SessionTimer />
        <ConnectionStatusIndicator />
        <ParticipantCount />
      </div>
      <div className="header-right">
        <button className="icon-btn" title="Share session URL" onClick={handleShare}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
        <button className="icon-btn" title="New Session" onClick={showNewSessionModal}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button className="icon-btn" title="Toggle theme" onClick={toggleTheme}>
          <ThemeToggleIcon theme={theme} />
        </button>
        <button className="icon-btn" title="Save as PDF" onClick={handleExportPDF}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>
    </header>
  );
}
