import { useEffect, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useUIStore } from '../stores/uiStore';
import {
  generateSessionId,
  getSessionIdFromURL,
  updateURLWithSession,
  getSessionNameKey,
  saveParticipantName,
  saveSessionStartTime,
  loadSessionStartTime,
} from '../services/session-logic';

/**
 * useSessionInit — initialises the session on app load.
 *
 * Flow:
 *  1. Read `?session=<id>` from the URL.
 *  2. If present → join as guest; if absent → create as host.
 *  3. Restore a previously saved name for this session (pre-fill).
 *  4. Open the name-entry modal so the user can confirm / enter their name.
 *  5. When the user submits a name, persist it to localStorage and update
 *     the URL so the share link is ready.
 */
export function useSessionInit(): void {
  const hasInitRef = useRef(false);

  const sessionId = useSessionStore((s) => s.sessionId);
  const peerName = useSessionStore((s) => s.peerName);
  const createSession = useSessionStore((s) => s.createSession);
  const joinSession = useSessionStore((s) => s.joinSession);
  const setPeerName = useSessionStore((s) => s.setPeerName);
  const showNameModal = useUIStore((s) => s.showNameModal);

  // ── Step 1: one-time initialisation on mount ──────────────────────
  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;

    const urlSessionId = getSessionIdFromURL(window.location.search);

    if (urlSessionId) {
      // Guest joining an existing session
      joinSession(urlSessionId);

      // Restore saved start time if available
      const savedStart = loadSessionStartTime(urlSessionId);
      if (savedStart) {
        useSessionStore.setState({ sessionStartTime: savedStart });
      }
    } else {
      // Host creating a new session
      const newId = generateSessionId();
      createSession(newId);
      updateURLWithSession(newId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 2: once session exists, always prompt for name ──────────
  useEffect(() => {
    if (!sessionId || peerName) return;

    // Always show the name modal on a fresh tab so each tab acts as
    // a unique participant.  The modal pre-fills from localStorage so
    // returning users can just click Join.
    showNameModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Step 3: persist name + start time when peer name is set ───────
  useEffect(() => {
    if (!sessionId || !peerName) return;

    saveParticipantName(peerName, sessionId);

    // Persist session start time
    const startTime = useSessionStore.getState().sessionStartTime;
    if (startTime) {
      saveSessionStartTime(sessionId, startTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, peerName]);
}
