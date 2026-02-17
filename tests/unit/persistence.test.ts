/**
 * StorageManager (Persistence) Unit Tests
 *
 * Tests for localStorage persistence, session expiry, debouncing, and data integrity.
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { StorageManager } from '../../src/services/persistence';

// Type for the StorageManager instance created via Object.create
type StorageManagerInstance = typeof StorageManager;

// Helper to create a fresh StorageManager instance for each test
// (resets mutable state like debounce timers and IndexedDB refs)
const createStorageManager = (): StorageManagerInstance => {
  const sm: StorageManagerInstance = Object.create(StorageManager);
  sm._debounceTimers = {};
  sm._db = null;
  sm._dbReady = false;
  return sm;
};

// Helper: call a debounced save and immediately flush the timer
const saveCodeImmediate = (storage: StorageManagerInstance, sessionId: string, code: string): void => {
  storage.saveCode(sessionId, code);
  vi.advanceTimersByTime(500);
};

const saveMessagesImmediate = (storage: StorageManagerInstance, sessionId: string, messages: unknown[]): void => {
  storage.saveMessages(sessionId, messages);
  vi.advanceTimersByTime(300);
};

const saveOTStateImmediate = (storage: StorageManagerInstance, sessionId: string, otState: { localOperationCount: number; remoteOperationCount: number; messageSequenceNumber: number; lastReceivedMessageSeq: number }): void => {
  storage.saveOTState(sessionId, otState);
  vi.advanceTimersByTime(500);
};

describe('Storage Key Generation', () => {
  let storage: StorageManagerInstance;

  beforeEach(() => {
    storage = createStorageManager();
  });

  it('should generate correct key format', () => {
    const key = storage._key('session', 'abc123');
    expect(key).toBe('duocode_session_abc123');
  });

  it('should handle different types', () => {
    expect(storage._key('code', 'xyz')).toBe('duocode_code_xyz');
    expect(storage._key('messages', 'xyz')).toBe('duocode_messages_xyz');
    expect(storage._key('canvas', 'xyz')).toBe('duocode_canvas_xyz');
    expect(storage._key('ot', 'xyz')).toBe('duocode_ot_xyz');
  });

  it('should use consistent prefix', () => {
    expect(storage.PREFIX).toBe('duocode_');
  });
});

describe('Session Storage', () => {
  let storage: StorageManagerInstance;

  beforeEach(() => {
    storage = createStorageManager();
    localStorage.clear();
  });

  it('should save session data', () => {
    storage.saveSession('test123', {
      role: 'interviewer',
      language: 'javascript',
      isSessionHost: true
    });

    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('should load session data', () => {
    const sessionData = {
      sessionId: 'test123',
      role: 'interviewer',
      language: 'javascript',
      isSessionHost: true,
      lastUpdated: Date.now()
    };

    localStorage.setItem('duocode_session_test123', JSON.stringify(sessionData));

    const loaded = storage.loadSession('test123');

    expect(loaded).toBeTruthy();
    expect(loaded!.role).toBe('interviewer');
    expect(loaded!.language).toBe('javascript');
  });

  it('should return null for non-existent session', () => {
    const loaded = storage.loadSession('nonexistent');
    expect(loaded).toBeNull();
  });

  it('should include lastUpdated timestamp', () => {
    const before = Date.now();
    storage.saveSession('test123', {
      role: 'candidate',
      language: 'python',
      isSessionHost: false
    } as { role: string; language: string; isSessionHost: boolean });

    const call = (localStorage.setItem as Mock).mock.calls[0];
    const savedData = JSON.parse(call[1] as string);

    expect(savedData.lastUpdated).toBeGreaterThanOrEqual(before);
  });
});

describe('Session Expiry', () => {
  let storage: StorageManagerInstance;

  beforeEach(() => {
    storage = createStorageManager();
    localStorage.clear();
  });

  it('should expire sessions older than 7 days', () => {
    const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago

    const sessionData = {
      sessionId: 'expired123',
      role: 'interviewer',
      language: 'javascript',
      lastUpdated: oldTimestamp
    };

    localStorage.setItem('duocode_session_expired123', JSON.stringify(sessionData));

    const loaded = storage.loadSession('expired123');

    expect(loaded).toBeNull();
  });

  it('should not expire recent sessions', () => {
    const recentTimestamp = Date.now() - (1 * 24 * 60 * 60 * 1000); // 1 day ago

    const sessionData = {
      sessionId: 'recent123',
      role: 'interviewer',
      language: 'javascript',
      lastUpdated: recentTimestamp
    };

    localStorage.setItem('duocode_session_recent123', JSON.stringify(sessionData));

    const loaded = storage.loadSession('recent123');

    expect(loaded).toBeTruthy();
    expect(loaded!.sessionId).toBe('recent123');
  });

  it('should have correct expiry constant (7 days)', () => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(storage.SESSION_EXPIRY_MS).toBe(sevenDaysMs);
  });
});

describe('Code Storage', () => {
  let storage: StorageManagerInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = createStorageManager();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should save code after debounce', () => {
    saveCodeImmediate(storage, 'test123', 'function hello() {}');
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('should load saved code', () => {
    const codeData = {
      code: 'const x = 42;',
      lastUpdated: Date.now()
    };

    localStorage.setItem('duocode_code_test123', JSON.stringify(codeData));

    const loaded = storage.loadCode('test123');
    expect(loaded).toBe('const x = 42;');
  });

  it('should return null for missing code', () => {
    const loaded = storage.loadCode('nonexistent');
    expect(loaded).toBeNull();
  });

  it('should handle multiline code', () => {
    const multilineCode = `function test() {
      const x = 1;
      return x + 1;
    }`;

    saveCodeImmediate(storage, 'test123', multilineCode);

    const call = (localStorage.setItem as Mock).mock.calls[0];
    const savedData = JSON.parse(call[1] as string);

    expect(savedData.code).toBe(multilineCode);
  });

  it('should handle unicode in code', () => {
    const unicodeCode = 'const greeting = "你好世界";';

    saveCodeImmediate(storage, 'test123', unicodeCode);
    const call = (localStorage.setItem as Mock).mock.calls[0];
    const savedData = JSON.parse(call[1] as string);

    expect(savedData.code).toBe(unicodeCode);
  });
});

describe('Messages Storage', () => {
  let storage: StorageManagerInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = createStorageManager();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should save messages after debounce', () => {
    const messages = [
      { id: '1', text: 'Hello', role: 'interviewer' },
      { id: '2', text: 'Hi', role: 'candidate' }
    ];

    saveMessagesImmediate(storage, 'test123', messages);
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('should load saved messages', () => {
    const messages = [
      { id: '1', text: 'Hello', role: 'interviewer' },
      { id: '2', text: 'Hi', role: 'candidate' }
    ];

    const messageData = {
      messages,
      lastUpdated: Date.now()
    };

    localStorage.setItem('duocode_messages_test123', JSON.stringify(messageData));

    const loaded = storage.loadMessages('test123') as Array<{ id: string; text: string; role: string }>;
    expect(loaded).toHaveLength(2);
    expect(loaded[0].text).toBe('Hello');
  });

  it('should return empty array for missing messages', () => {
    const loaded = storage.loadMessages('nonexistent');
    expect(loaded).toEqual([]);
  });

  it('should preserve message order', () => {
    const messages = [
      { id: '1', text: 'First', role: 'interviewer', seq: 0 },
      { id: '2', text: 'Second', role: 'candidate', seq: 1 },
      { id: '3', text: 'Third', role: 'interviewer', seq: 2 }
    ];

    saveMessagesImmediate(storage, 'test123', messages);

    const call = (localStorage.setItem as Mock).mock.calls[0];
    const savedData = JSON.parse(call[1] as string);

    expect(savedData.messages[0].seq).toBe(0);
    expect(savedData.messages[1].seq).toBe(1);
    expect(savedData.messages[2].seq).toBe(2);
  });
});

describe('OT State Storage', () => {
  let storage: StorageManagerInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = createStorageManager();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should save OT state after debounce', () => {
    const otState = {
      localOperationCount: 10,
      remoteOperationCount: 8,
      messageSequenceNumber: 5,
      lastReceivedMessageSeq: 4
    };

    saveOTStateImmediate(storage, 'test123', otState);
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('should load saved OT state', () => {
    const otState = {
      localOperationCount: 10,
      remoteOperationCount: 8,
      messageSequenceNumber: 5,
      lastReceivedMessageSeq: 4,
      lastUpdated: Date.now()
    };

    localStorage.setItem('duocode_ot_test123', JSON.stringify(otState));

    const loaded = storage.loadOTState('test123');

    expect(loaded).toBeTruthy();
    expect(loaded!.localOperationCount).toBe(10);
    expect(loaded!.remoteOperationCount).toBe(8);
  });

  it('should return null for missing OT state', () => {
    const loaded = storage.loadOTState('nonexistent');
    expect(loaded).toBeNull();
  });
});

describe('Session Cleanup', () => {
  let storage: StorageManagerInstance;

  beforeEach(() => {
    storage = createStorageManager();
    localStorage.clear();
  });

  it('should clear all session data', () => {
    // Set up various data
    localStorage.setItem('duocode_session_test123', JSON.stringify({ sessionId: 'test123' }));
    localStorage.setItem('duocode_code_test123', JSON.stringify({ code: 'test' }));
    localStorage.setItem('duocode_messages_test123', JSON.stringify({ messages: [] }));
    localStorage.setItem('duocode_ot_test123', JSON.stringify({ localOperationCount: 0 }));

    storage.clearSession('test123');

    expect(localStorage.removeItem).toHaveBeenCalledWith('duocode_session_test123');
    expect(localStorage.removeItem).toHaveBeenCalledWith('duocode_code_test123');
    expect(localStorage.removeItem).toHaveBeenCalledWith('duocode_messages_test123');
    expect(localStorage.removeItem).toHaveBeenCalledWith('duocode_ot_test123');
    expect(localStorage.removeItem).toHaveBeenCalledWith('duocode_canvas_test123');
  });

  it('should not affect other sessions', () => {
    localStorage.setItem('duocode_session_other', JSON.stringify({ sessionId: 'other' }));
    localStorage.setItem('duocode_session_test123', JSON.stringify({ sessionId: 'test123' }));

    storage.clearSession('test123');

    // other session should not be removed
    expect(localStorage.removeItem).not.toHaveBeenCalledWith('duocode_session_other');
  });
});

describe('hasPersistedData()', () => {
  let storage: StorageManagerInstance;

  beforeEach(() => {
    storage = createStorageManager();
    localStorage.clear();
  });

  it('should return true when session data exists', () => {
    localStorage.setItem('duocode_session_test123', JSON.stringify({ sessionId: 'test123' }));

    expect(storage.hasPersistedData('test123')).toBe(true);
  });

  it('should return true when code exists', () => {
    localStorage.setItem('duocode_code_test123', JSON.stringify({ code: 'test' }));

    expect(storage.hasPersistedData('test123')).toBe(true);
  });

  it('should return true when messages exist', () => {
    localStorage.setItem('duocode_messages_test123', JSON.stringify({ messages: [] }));

    expect(storage.hasPersistedData('test123')).toBe(true);
  });

  it('should return false when no data exists', () => {
    expect(storage.hasPersistedData('nonexistent')).toBe(false);
  });
});

describe('Debouncing', () => {
  let storage: StorageManagerInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = createStorageManager();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce rapid saves', () => {
    storage.saveCode('test123', 'v1');
    storage.saveCode('test123', 'v2');
    storage.saveCode('test123', 'v3');

    // Should not have saved yet
    expect(localStorage.setItem).not.toHaveBeenCalled();

    // Advance timers
    vi.advanceTimersByTime(500);

    // Should have saved only once
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);

    const call = (localStorage.setItem as Mock).mock.calls[0];
    const savedData = JSON.parse(call[1] as string);
    expect(savedData.code).toBe('v3'); // Last value
  });

  it('should cancel pending debounce on new save', () => {
    storage.saveCode('test123', 'first');

    vi.advanceTimersByTime(250); // Half the debounce time

    storage.saveCode('test123', 'second');

    vi.advanceTimersByTime(250); // Another half

    // Should not have saved 'first'
    expect(localStorage.setItem).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250); // Complete debounce for 'second'

    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
    const savedData = JSON.parse((localStorage.setItem as Mock).mock.calls[0][1] as string);
    expect(savedData.code).toBe('second');
  });
});

describe('Error Handling', () => {
  let storage: StorageManagerInstance;

  beforeEach(() => {
    storage = createStorageManager();
    localStorage.clear();
  });

  it('should handle invalid JSON gracefully', () => {
    localStorage.setItem('duocode_session_test123', 'not valid json');

    const loaded = storage.loadSession('test123');
    expect(loaded).toBeNull();
  });

  it('should handle missing required fields', () => {
    localStorage.setItem('duocode_session_test123', JSON.stringify({}));

    const loaded = storage.loadSession('test123');
    // Should not throw, but may return incomplete data
    expect(loaded).toBeTruthy();
  });
});

describe('getSavedSessions()', () => {
  let storage: StorageManagerInstance;
  let mockStore: Record<string, string>;

  beforeEach(() => {
    storage = createStorageManager();

    // Set up mock store with sessions
    mockStore = {
      'duocode_session_abc': JSON.stringify({
        sessionId: 'abc',
        role: 'interviewer',
        language: 'javascript',
        lastUpdated: 1000
      }),
      'duocode_session_xyz': JSON.stringify({
        sessionId: 'xyz',
        role: 'candidate',
        language: 'python',
        lastUpdated: 2000
      }),
      'duocode_code_abc': JSON.stringify({ code: 'test' }), // Not a session
      'other_key': 'other value'
    };

    // Override localStorage mock
    (localStorage.key as Mock).mockImplementation((index: number) => Object.keys(mockStore)[index] || null);
    (localStorage.getItem as Mock).mockImplementation((key: string) => mockStore[key] || null);
    Object.defineProperty(localStorage, 'length', { get: () => Object.keys(mockStore).length, configurable: true });
  });

  it('should return all sessions sorted by lastUpdated (newest first)', () => {
    const sessions = storage.getSavedSessions();

    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionId).toBe('xyz'); // Newer
    expect(sessions[1].sessionId).toBe('abc'); // Older
  });

  it('should include session details', () => {
    const sessions = storage.getSavedSessions();

    expect(sessions[0]).toHaveProperty('sessionId');
    expect(sessions[0]).toHaveProperty('role');
    expect(sessions[0]).toHaveProperty('language');
    expect(sessions[0]).toHaveProperty('lastUpdated');
  });

  it('should only return session data, not code or messages', () => {
    const sessions = storage.getSavedSessions();

    // Should have exactly 2 sessions
    expect(sessions).toHaveLength(2);

    // None should be code data
    sessions.forEach(s => {
      expect(s.sessionId).not.toContain('code');
    });
  });
});
