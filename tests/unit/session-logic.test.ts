/**
 * Session Logic Service Unit Tests
 *
 * Tests for session ID helpers, elapsed time formatting, participant name
 * persistence, and session start time persistence from
 * src/services/session-logic.js.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSessionId,
  getSessionIdFromURL,
  buildSessionURL,
  formatElapsedTime,
  getSessionNameKey,
  getSessionStartTimeKey,
  getSavedNameForSession,
  saveParticipantName,
  saveSessionStartTime,
  loadSessionStartTime,
  SESSION_ID_LENGTH,
  SESSION_NAME_PREFIX,
  SESSION_START_PREFIX,
  PARTICIPANT_NAME_KEY,
} from '../../src/services/session-logic.js';

// ── buildSessionURL ─────────────────────────────────────────────────────────

describe('buildSessionURL', () => {
  it('should add session param to URL', () => {
    const url = buildSessionURL('http://localhost:3000', 'abc123');
    expect(url.searchParams.get('session')).toBe('abc123');
  });

  it('should preserve existing params', () => {
    const url = buildSessionURL('http://localhost:3000?foo=bar', 'xyz');
    expect(url.searchParams.get('foo')).toBe('bar');
    expect(url.searchParams.get('session')).toBe('xyz');
  });

  it('should overwrite existing session param', () => {
    const url = buildSessionURL('http://localhost:3000?session=old', 'new');
    expect(url.searchParams.get('session')).toBe('new');
  });
});

// ── formatElapsedTime ───────────────────────────────────────────────────────

describe('formatElapsedTime', () => {
  it('should format 0 elapsed as 00:00:00', () => {
    const now = Date.now();
    expect(formatElapsedTime(now, now)).toBe('00:00:00');
  });

  it('should format seconds correctly', () => {
    const start = 1000;
    const now = 46000; // 45 seconds later
    expect(formatElapsedTime(start, now)).toBe('00:00:45');
  });

  it('should format minutes correctly', () => {
    const start = 0;
    const now = 125000; // 2 minutes 5 seconds
    expect(formatElapsedTime(start, now)).toBe('00:02:05');
  });

  it('should format hours correctly', () => {
    const start = 0;
    const now = 3661000; // 1 hour 1 minute 1 second
    expect(formatElapsedTime(start, now)).toBe('01:01:01');
  });

  it('should handle large durations', () => {
    const start = 0;
    const now = 36000000; // 10 hours
    expect(formatElapsedTime(start, now)).toBe('10:00:00');
  });
});

// ── Key Helpers ─────────────────────────────────────────────────────────────

describe('getSessionNameKey', () => {
  it('should build key with prefix + session ID', () => {
    expect(getSessionNameKey('abc')).toBe(SESSION_NAME_PREFIX + 'abc');
  });
});

describe('getSessionStartTimeKey', () => {
  it('should build key with prefix + session ID', () => {
    expect(getSessionStartTimeKey('xyz')).toBe(SESSION_START_PREFIX + 'xyz');
  });
});

// ── Participant Name Persistence ────────────────────────────────────────────

describe('getSavedNameForSession', () => {
  it('should return session-specific name if available', () => {
    const storage = {
      getItem: (key: string): string | null => {
        if (key === SESSION_NAME_PREFIX + 'sess1') return 'Alice';
        if (key === PARTICIPANT_NAME_KEY) return 'Bob';
        return null;
      },
    };
    expect(getSavedNameForSession('sess1', storage)).toBe('Alice');
  });

  it('should fall back to global name if no session name', () => {
    const storage = {
      getItem: (key: string): string | null => {
        if (key === PARTICIPANT_NAME_KEY) return 'GlobalUser';
        return null;
      },
    };
    expect(getSavedNameForSession('sess2', storage)).toBe('GlobalUser');
  });

  it('should return empty string if nothing saved', () => {
    const storage = { getItem: (_key: string): string | null => null };
    expect(getSavedNameForSession('sess3', storage)).toBe('');
  });
});

describe('saveParticipantName', () => {
  it('should save to both global and session-specific keys', () => {
    const saved: Record<string, string> = {};
    const storage = { setItem: (k: string, v: string): void => { saved[k] = v; } };

    saveParticipantName('Charlie', 'sess1', storage);

    expect(saved[PARTICIPANT_NAME_KEY]).toBe('Charlie');
    expect(saved[SESSION_NAME_PREFIX + 'sess1']).toBe('Charlie');
  });
});

// ── Session Start Time Persistence ──────────────────────────────────────────

describe('saveSessionStartTime', () => {
  it('should save start time as string', () => {
    const saved: Record<string, string> = {};
    const storage = { setItem: (k: string, v: string): void => { saved[k] = v; } };

    saveSessionStartTime('sess1', 1700000000000, storage);

    expect(saved[SESSION_START_PREFIX + 'sess1']).toBe('1700000000000');
  });
});

describe('loadSessionStartTime', () => {
  it('should load and parse saved start time', () => {
    const storage = {
      getItem: (key: string): string | null => key === SESSION_START_PREFIX + 'sess1' ? '1700000000000' : null,
    };
    expect(loadSessionStartTime('sess1', storage)).toBe(1700000000000);
  });

  it('should return null when not saved', () => {
    const storage = { getItem: (_key: string): string | null => null };
    expect(loadSessionStartTime('sess1', storage)).toBeNull();
  });
});

// ── Constants ───────────────────────────────────────────────────────────────

describe('Constants', () => {
  it('should have SESSION_ID_LENGTH of 12', () => {
    expect(SESSION_ID_LENGTH).toBe(12);
  });

  it('should generate IDs matching SESSION_ID_LENGTH', () => {
    const id = generateSessionId();
    expect(id).toHaveLength(SESSION_ID_LENGTH);
  });
});
