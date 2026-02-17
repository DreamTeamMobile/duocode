import { useEffect, useRef } from 'react';
import { StorageManager } from '../services/persistence';
import { useEditorStore } from '../stores/editorStore';
import { useMessagesStore } from '../stores/messagesStore';
import type { Message } from '../stores/messagesStore';
import { useSessionStore } from '../stores/sessionStore';

/**
 * usePersistence — auto-saves store state to localStorage / IndexedDB and
 * restores it on mount when a session exists.
 *
 * Persistence targets:
 *  - Code (editorStore.code)          → localStorage (debounced by StorageManager)
 *  - Messages (messagesStore)         → localStorage (debounced by StorageManager)
 *  - Session metadata                 → localStorage
 *  - OT state (operation counts)      → localStorage (debounced by StorageManager)
 *
 * Also runs expired-session cleanup on mount.
 */
export function usePersistence(): void {
  const initializedRef = useRef(false);
  const sessionId = useSessionStore((s) => s.sessionId);
  const isHost = useSessionStore((s) => s.isHost);

  // Initialize IndexedDB and clean up expired sessions once
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    StorageManager.initIndexedDB().catch(() => {
      // IndexedDB may not be available — canvas will fall back to localStorage
    });
    StorageManager.cleanupExpiredSessions();
  }, []);

  // Restore persisted state when a session becomes active
  useEffect(() => {
    if (!sessionId) return;

    // Restore code
    const savedCode = StorageManager.loadCode(sessionId);
    if (savedCode) {
      useEditorStore.getState().setCode(savedCode);
    }

    // Restore session metadata (language, host status)
    const savedSession = StorageManager.loadSession(sessionId);
    if (savedSession?.language) {
      useEditorStore.getState().setLanguage(savedSession.language);
    }

    // Restore messages
    const savedMessages = StorageManager.loadMessages(sessionId) as Message[];
    if (savedMessages && savedMessages.length > 0) {
      const store = useMessagesStore.getState();
      savedMessages.forEach((msg) => store.addMessage(msg));
    }

    // Restore OT operation counts
    const savedOT = StorageManager.loadOTState(sessionId);
    if (savedOT) {
      const editorState = useEditorStore.getState();
      for (let i = 0; i < (savedOT.localOperationCount || 0); i++) {
        editorState.applyLocalOperation();
      }
    }
  }, [sessionId]);

  // Subscribe to store changes and persist them
  useEffect(() => {
    if (!sessionId) return;

    let prevCode = useEditorStore.getState().code;
    let prevLanguage = useEditorStore.getState().language;
    let prevLocalOps = useEditorStore.getState().localOperationCount;
    let prevRemoteOps = useEditorStore.getState().remoteOperationCount;
    let prevMessageCount = useMessagesStore.getState().messages.length;

    const unsubEditor = useEditorStore.subscribe((state) => {
      if (state.code !== prevCode) {
        prevCode = state.code;
        StorageManager.saveCode(sessionId, state.code);
      }
      if (
        state.language !== prevLanguage ||
        state.localOperationCount !== prevLocalOps ||
        state.remoteOperationCount !== prevRemoteOps
      ) {
        prevLanguage = state.language;
        prevLocalOps = state.localOperationCount;
        prevRemoteOps = state.remoteOperationCount;

        StorageManager.saveSession(sessionId, {
          language: state.language,
          isSessionHost: isHost,
        });
        StorageManager.saveOTState(sessionId, {
          localOperationCount: state.localOperationCount,
          remoteOperationCount: state.remoteOperationCount,
        });
      }
    });

    const unsubMessages = useMessagesStore.subscribe((state) => {
      if (state.messages.length !== prevMessageCount) {
        prevMessageCount = state.messages.length;
        StorageManager.saveMessages(sessionId, state.messages);
      }
    });

    return () => {
      unsubEditor();
      unsubMessages();
    };
  }, [sessionId, isHost]);
}
