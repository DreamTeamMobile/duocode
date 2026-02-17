import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSessionInit } from '../hooks/useSessionInit';
import { useSessionStore } from '../stores/sessionStore';
import { useUIStore } from '../stores/uiStore';

// Reset module-level ref between tests

describe('useSessionInit', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    useUIStore.getState().reset();
    vi.clearAllMocks();

    // Reset window.location.search
    globalThis.location.search = '';
    globalThis.location.href = 'http://localhost:3000';
  });

  it('creates a new session as host when no session param in URL', () => {
    const { unmount } = renderHook(() => useSessionInit());

    const session = useSessionStore.getState();
    expect(session.sessionId).toBeTruthy();
    expect(session.sessionId!.length).toBe(12);
    expect(session.isHost).toBe(true);
    expect(session.sessionStartTime).toBeGreaterThan(0);

    // URL should be updated via history.pushState
    expect(globalThis.history.pushState).toHaveBeenCalled();

    unmount();
  });

  it('joins existing session as guest when URL has session param', () => {
    globalThis.location.search = '?session=abc123test12';
    globalThis.location.href = 'http://localhost:3000?session=abc123test12';

    const { unmount } = renderHook(() => useSessionInit());

    const session = useSessionStore.getState();
    expect(session.sessionId).toBe('abc123test12');
    expect(session.isHost).toBe(false);

    unmount();
  });

  it('shows name modal when no saved name exists', () => {
    const { unmount } = renderHook(() => useSessionInit());

    expect(useUIStore.getState().isNameModalOpen).toBe(true);

    unmount();
  });

  it('restores saved name and skips modal', () => {
    // Pre-save a session-specific name (only session-specific names auto-restore)
    const sessionId = 'preexisting1';
    localStorage.setItem(`duocode_session_name_${sessionId}`, 'SavedUser');

    globalThis.location.search = `?session=${sessionId}`;
    globalThis.location.href = `http://localhost:3000?session=${sessionId}`;

    const { unmount } = renderHook(() => useSessionInit());

    const session = useSessionStore.getState();
    expect(session.peerName).toBe('SavedUser');
    expect(useUIStore.getState().isNameModalOpen).toBe(false);

    unmount();
  });

  it('persists name to localStorage when peer name is set', () => {
    const { unmount } = renderHook(() => useSessionInit());

    const sessionId = useSessionStore.getState().sessionId;

    act(() => {
      useSessionStore.getState().setPeerName('TestUser');
    });

    // Re-render to trigger the persistence effect
    const { unmount: unmount2 } = renderHook(() => useSessionInit());

    expect(localStorage.getItem('duocode_participant_name')).toBe('TestUser');
    expect(localStorage.getItem(`duocode_session_name_${sessionId}`)).toBe('TestUser');

    unmount();
    unmount2();
  });

  it('restores saved session start time for guest joining', () => {
    const sessionId = 'jointest1234';
    const startTime = Date.now() - 60000; // 1 minute ago
    localStorage.setItem(`duocode_session_start_${sessionId}`, startTime.toString());

    globalThis.location.search = `?session=${sessionId}`;
    globalThis.location.href = `http://localhost:3000?session=${sessionId}`;

    const { unmount } = renderHook(() => useSessionInit());

    const session = useSessionStore.getState();
    expect(session.sessionStartTime).toBe(startTime);

    unmount();
  });
});
