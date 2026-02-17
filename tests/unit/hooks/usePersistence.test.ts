import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistence } from '../../../src/hooks/usePersistence.js';
import { useEditorStore } from '../../../src/stores/editorStore.js';
import { useMessagesStore } from '../../../src/stores/messagesStore.js';
import { useSessionStore } from '../../../src/stores/sessionStore.js';
import { StorageManager } from '../../../src/services/persistence';

// Spy on StorageManager methods
vi.spyOn(StorageManager, 'initIndexedDB').mockResolvedValue(true);
vi.spyOn(StorageManager, 'cleanupExpiredSessions').mockImplementation(() => {});
vi.spyOn(StorageManager, 'saveCode').mockImplementation(() => {});
vi.spyOn(StorageManager, 'loadCode').mockReturnValue(null);
vi.spyOn(StorageManager, 'saveSession').mockImplementation(() => {});
vi.spyOn(StorageManager, 'loadSession').mockReturnValue(null);
vi.spyOn(StorageManager, 'saveMessages').mockImplementation(() => {});
vi.spyOn(StorageManager, 'loadMessages').mockReturnValue([]);
vi.spyOn(StorageManager, 'saveOTState').mockImplementation(() => {});
vi.spyOn(StorageManager, 'loadOTState').mockReturnValue(null);
vi.spyOn(StorageManager, 'loadCanvas').mockResolvedValue(null);

describe('usePersistence', () => {
  const loadCodeMock = StorageManager.loadCode as ReturnType<typeof vi.fn>;
  const loadSessionMock = StorageManager.loadSession as ReturnType<typeof vi.fn>;
  const loadMessagesMock = StorageManager.loadMessages as ReturnType<typeof vi.fn>;
  const saveCodeMock = StorageManager.saveCode as ReturnType<typeof vi.fn>;
  const saveMessagesMock = StorageManager.saveMessages as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.getState().reset();
    useMessagesStore.getState().reset();
    useSessionStore.getState().reset();
  });

  it('initializes IndexedDB on mount', () => {
    renderHook(() => usePersistence());

    expect(StorageManager.initIndexedDB).toHaveBeenCalledTimes(1);
  });

  it('cleans up expired sessions on mount', () => {
    renderHook(() => usePersistence());

    expect(StorageManager.cleanupExpiredSessions).toHaveBeenCalledTimes(1);
  });

  it('restores code when session becomes active', () => {
    loadCodeMock.mockReturnValue('saved code');
    loadSessionMock.mockReturnValue({ language: 'python' });

    // Set session so persistence triggers
    useSessionStore.getState().createSession('test-session');

    renderHook(() => usePersistence());

    expect(StorageManager.loadCode).toHaveBeenCalledWith('test-session');
    expect(useEditorStore.getState().code).toBe('saved code');
    expect(useEditorStore.getState().language).toBe('python');
  });

  it('restores messages when session becomes active', () => {
    const savedMessages = [
      { id: '1', text: 'Hello', sender: 'Alice', timestamp: 1700000000000 },
      { id: '2', text: 'World', sender: 'Bob', timestamp: 1700000001000 },
    ];
    loadMessagesMock.mockReturnValue(savedMessages);

    useSessionStore.getState().createSession('test-session');

    renderHook(() => usePersistence());

    expect(useMessagesStore.getState().messages).toHaveLength(2);
    expect(useMessagesStore.getState().messages[0].text).toBe('Hello');
  });

  it('persists code changes to storage', async () => {
    useSessionStore.getState().createSession('test-session');

    renderHook(() => usePersistence());

    // Change code in the store
    act(() => {
      useEditorStore.getState().setCode('new code');
    });

    // The subscribe callback fires synchronously
    expect(saveCodeMock).toHaveBeenCalledWith('test-session', 'new code');
  });

  it('persists message additions to storage', () => {
    useSessionStore.getState().createSession('test-session');

    renderHook(() => usePersistence());

    act(() => {
      useMessagesStore.getState().addMessage({
        id: 'msg-1',
        text: 'Test',
        sender: 'Me',
        timestamp: Date.now(),
      });
    });

    expect(saveMessagesMock).toHaveBeenCalledWith(
      'test-session',
      expect.arrayContaining([
        expect.objectContaining({ id: 'msg-1', text: 'Test' }),
      ])
    );
  });

  it('does not restore data when no session is active', () => {
    // sessionId is null by default
    renderHook(() => usePersistence());

    expect(StorageManager.loadCode).not.toHaveBeenCalled();
    expect(StorageManager.loadMessages).not.toHaveBeenCalled();
  });

  it('cleans up subscriptions on unmount', () => {
    useSessionStore.getState().createSession('test-session');

    const { unmount } = renderHook(() => usePersistence());

    unmount();

    // After unmount, store changes should not trigger saves
    saveCodeMock.mockClear();
    act(() => {
      useEditorStore.getState().setCode('after unmount');
    });

    expect(saveCodeMock).not.toHaveBeenCalled();
  });
});
