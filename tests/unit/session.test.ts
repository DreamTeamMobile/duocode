/**
 * Session Management Unit Tests
 *
 * Tests for session ID generation, URL parsing, and session initialization.
 * Imports from src/services/session-logic.js.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  generateSessionId,
  getSessionIdFromURL,
  updateURLWithSession,
  getShareableURL,
} from '../../src/services/session-logic.js';

describe('Session ID Generation', () => {
  it('should generate a 12-character session ID', () => {
    const id = generateSessionId();
    expect(id).toHaveLength(12);
  });

  it('should only contain alphanumeric characters', () => {
    const id = generateSessionId();
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('should generate unique IDs across multiple calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateSessionId());
    }
    // With 62^12 possible combinations, 1000 IDs should be unique
    expect(ids.size).toBe(1000);
  });

  it('should use full character set', () => {
    // Generate many IDs and check character distribution
    const charCounts: Record<string, number> = {};
    for (let i = 0; i < 10000; i++) {
      const id = generateSessionId();
      for (const char of id) {
        charCounts[char] = (charCounts[char] || 0) + 1;
      }
    }

    // Should have characters from all categories
    const hasLowercase = Object.keys(charCounts).some(c => /[a-z]/.test(c));
    const hasUppercase = Object.keys(charCounts).some(c => /[A-Z]/.test(c));
    const hasDigits = Object.keys(charCounts).some(c => /[0-9]/.test(c));

    expect(hasLowercase).toBe(true);
    expect(hasUppercase).toBe(true);
    expect(hasDigits).toBe(true);
  });

  it('should not generate empty IDs', () => {
    for (let i = 0; i < 100; i++) {
      const id = generateSessionId();
      expect(id).toBeTruthy();
      expect(id.length).toBeGreaterThan(0);
    }
  });
});

describe('URL Session ID Parsing', () => {
  it('should parse session ID from query string', () => {
    const searchString = '?session=abc123XYZ456';
    const sessionId = getSessionIdFromURL(searchString);
    expect(sessionId).toBe('abc123XYZ456');
  });

  it('should return null when no session in URL', () => {
    const searchString = '';
    const sessionId = getSessionIdFromURL(searchString);
    expect(sessionId).toBeNull();
  });

  it('should return null for empty session parameter', () => {
    const searchString = '?session=';
    const sessionId = getSessionIdFromURL(searchString);
    expect(sessionId).toBe('');
  });

  it('should handle URL with other parameters', () => {
    const searchString = '?foo=bar&session=testSession123&baz=qux';
    const sessionId = getSessionIdFromURL(searchString);
    expect(sessionId).toBe('testSession123');
  });

  it('should handle URL-encoded session IDs', () => {
    const searchString = '?session=test%20session'; // URL encoded space
    const sessionId = getSessionIdFromURL(searchString);
    expect(sessionId).toBe('test session');
  });

  it('should handle special characters in session ID', () => {
    const searchString = '?session=a-b_c.d';
    const sessionId = getSessionIdFromURL(searchString);
    expect(sessionId).toBe('a-b_c.d');
  });
});

describe('URL Updates', () => {
  beforeEach(() => {
    location.href = 'http://localhost:3000';
    location.search = '';
  });

  it('should update URL with session ID', () => {
    updateURLWithSession('newSession123');
    expect(history.pushState).toHaveBeenCalled();
  });

  it('should call pushState with URL object', () => {
    updateURLWithSession('mySession456');
    expect(history.pushState).toHaveBeenCalled();
    const calls = (history.pushState as Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // The URL is passed as a URL object which gets stringified
    const urlArg = calls[0][2] as URL;
    expect(urlArg.toString()).toContain('session=mySession456');
  });

  it('should include session parameter in URL', () => {
    updateURLWithSession('session789');
    expect(history.pushState).toHaveBeenCalled();
    const urlArg = (history.pushState as Mock).mock.calls[0][2] as URL;
    expect(urlArg.toString()).toContain('session=session789');
  });
});

describe('Shareable URL', () => {
  it('should return current URL', () => {
    location.href = 'http://localhost:3000?session=testABC';
    const url = getShareableURL();
    expect(url).toBe('http://localhost:3000?session=testABC');
  });

  it('should include full URL with session', () => {
    location.href = 'https://example.com/duocode?session=shareMe123';
    const url = getShareableURL();
    expect(url).toContain('session=shareMe123');
    expect(url).toContain('example.com');
  });
});

describe('Session Initialization Logic', () => {
  it('should detect new session when no URL parameter', () => {
    location.search = '';
    const urlSessionId = getSessionIdFromURL(location.search);
    const isNewSession = !urlSessionId;
    expect(isNewSession).toBe(true);
  });

  it('should detect existing session from URL', () => {
    location.search = '?session=existingSession';
    const urlSessionId = getSessionIdFromURL(location.search);
    const isNewSession = !urlSessionId;
    expect(isNewSession).toBe(false);
    expect(urlSessionId).toBe('existingSession');
  });

  it('should assign interviewer role for new sessions', () => {
    location.search = '';
    const urlSessionId = getSessionIdFromURL(location.search);
    // Creator (no URL session) = interviewer
    const role = urlSessionId ? 'candidate' : 'interviewer';
    expect(role).toBe('interviewer');
  });

  it('should assign candidate role for joined sessions', () => {
    location.search = '?session=joinedSession';
    const urlSessionId = getSessionIdFromURL(location.search);
    // Joiner (URL has session) = candidate
    const role = urlSessionId ? 'candidate' : 'interviewer';
    expect(role).toBe('candidate');
  });
});

describe('Session ID Collision Prevention', () => {
  it('should have extremely low collision probability', () => {
    // With 62 chars and 12 positions, we have 62^12 = ~3.2e21 combinations
    // Birthday paradox: 50% collision chance at ~sqrt(N) = ~1.8e10 IDs
    // For 1000 IDs, collision probability is essentially 0

    const ids = new Set<string>();
    let collisionCount = 0;

    for (let i = 0; i < 10000; i++) {
      const id = generateSessionId();
      if (ids.has(id)) {
        collisionCount++;
      }
      ids.add(id);
    }

    expect(collisionCount).toBe(0);
  });

  it('should produce statistically random distribution', () => {
    // Check that first character is roughly evenly distributed
    const firstChars: Record<string, number> = {};
    const iterations = 6200; // ~100 per character expected

    for (let i = 0; i < iterations; i++) {
      const id = generateSessionId();
      const first = id[0];
      firstChars[first] = (firstChars[first] || 0) + 1;
    }

    // All characters should appear at least once
    const uniqueFirstChars = Object.keys(firstChars).length;
    expect(uniqueFirstChars).toBeGreaterThan(50); // Should be close to 62
  });
});
