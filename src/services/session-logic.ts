/**
 * Session Logic Service
 *
 * Pure, framework-agnostic session management helpers extracted from app.js.
 * Covers session ID generation/parsing, elapsed-time formatting,
 * and participant name persistence helpers.
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const SESSION_ID_LENGTH = 12;
export const SESSION_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const PARTICIPANT_NAME_KEY = 'duocode_participant_name';
export const SESSION_NAME_PREFIX = 'duocode_session_name_';
export const SESSION_START_PREFIX = 'duocode_session_start_';

// ── Session ID Functions ────────────────────────────────────────────────────

/**
 * Generate a random alphanumeric session ID.
 */
export function generateSessionId(length: number = SESSION_ID_LENGTH): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += SESSION_ID_CHARS.charAt(
      Math.floor(Math.random() * SESSION_ID_CHARS.length)
    );
  }
  return result;
}

/**
 * Parse the session ID from a URL search string.
 */
export function getSessionIdFromURL(searchString: string): string | null {
  const urlParams = new URLSearchParams(searchString);
  return urlParams.get('session');
}

/**
 * Build a URL object with the session query parameter set.
 * Pure — does not touch window.history.
 */
export function buildSessionURL(baseHref: string, sessionId: string): URL {
  const url = new URL(baseHref);
  url.searchParams.set('session', sessionId);
  return url;
}

/**
 * Update the browser URL with a session ID via pushState.
 * Thin wrapper around buildSessionURL + history.pushState.
 */
export function updateURLWithSession(
  sessionId: string,
  loc: Location = window.location,
  hist: History = window.history
): void {
  const url = buildSessionURL(loc.href, sessionId);
  hist.pushState({}, '', url);
}

/**
 * Get the shareable URL for the current session.
 */
export function getShareableURL(loc: Location = window.location): string {
  return loc.href;
}

// ── Timer / Elapsed Time ────────────────────────────────────────────────────

/**
 * Format an elapsed duration in milliseconds as HH:MM:SS.
 * Pure function — takes explicit start time and current time.
 */
export function formatElapsedTime(startTime: number, now: number = Date.now()): string {
  const elapsed = now - startTime;
  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return (
    hours.toString().padStart(2, '0') + ':' +
    minutes.toString().padStart(2, '0') + ':' +
    seconds.toString().padStart(2, '0')
  );
}

// ── Participant Name Helpers ────────────────────────────────────────────────

interface StorageReader {
  getItem: (key: string) => string | null;
}

interface StorageWriter {
  setItem: (key: string, value: string) => void;
}

/**
 * Get the localStorage key for a session-specific participant name.
 */
export function getSessionNameKey(sessionId: string): string {
  return SESSION_NAME_PREFIX + sessionId;
}

/**
 * Get the localStorage key for the session start time.
 */
export function getSessionStartTimeKey(sessionId: string): string {
  return SESSION_START_PREFIX + sessionId;
}

/**
 * Load the saved participant name for a session, falling back to the
 * global name for pre-filling new sessions.
 */
export function getSavedNameForSession(sessionId: string, storage: StorageReader = localStorage): string {
  const sessionName = storage.getItem(getSessionNameKey(sessionId));
  if (sessionName) return sessionName;
  return storage.getItem(PARTICIPANT_NAME_KEY) || '';
}

/**
 * Save a participant name to both the global key (for future pre-fills)
 * and the per-session key.
 */
export function saveParticipantName(name: string, sessionId: string, storage: StorageWriter = localStorage): void {
  storage.setItem(PARTICIPANT_NAME_KEY, name);
  storage.setItem(getSessionNameKey(sessionId), name);
}

/**
 * Save the session start time to storage.
 */
export function saveSessionStartTime(sessionId: string, startTime: number, storage: StorageWriter = localStorage): void {
  storage.setItem(getSessionStartTimeKey(sessionId), startTime.toString());
}

/**
 * Load the session start time from storage.
 */
export function loadSessionStartTime(sessionId: string, storage: StorageReader = localStorage): number | null {
  const saved = storage.getItem(getSessionStartTimeKey(sessionId));
  return saved ? parseInt(saved, 10) : null;
}
