import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWebRTC } from '../../../src/hooks/useWebRTC.js';
import { useConnectionStore } from '../../../src/stores/connectionStore.js';
import { useSessionStore } from '../../../src/stores/sessionStore.js';
import type { DataChannelMessage } from '../../../src/services/connection-manager.js';

// Mock the service classes using proper class constructors
vi.mock('../../../src/services/connection-manager.js', () => {
  return {
    ConnectionManager: class MockConnectionManager {
      _callbacks: Record<string, (...args: unknown[]) => void> = {};
      dataChannel: RTCDataChannel | null = null;
      callbacks = this._callbacks;
      on(event: string, cb: (...args: unknown[]) => void) { this._callbacks[event] = cb; }
      initializePeerConnection() { return Promise.resolve({}); }
      createDataChannel() {
        return {
          readyState: 'open',
          send: vi.fn(),
          close: vi.fn(),
          onopen: null,
          onclose: null,
          onmessage: null,
        };
      }
      createOffer() { return Promise.resolve({ type: 'offer', sdp: 'test' }); }
      handleOffer() { return Promise.resolve({ type: 'answer', sdp: 'test' }); }
      handleAnswer() { return Promise.resolve(); }
      addIceCandidate() { return Promise.resolve(); }
      disconnect() {}
    },
  };
});

vi.mock('../../../src/services/signaling-client.js', () => {
  return {
    SignalingClient: class MockSignalingClient {
      _callbacks: Record<string, (...args: unknown[]) => void> = {};
      connected = false;
      on(event: string, cb: (...args: unknown[]) => void) { this._callbacks[event] = cb; }
      connect() { this.connected = true; return Promise.resolve(true); }
      disconnect() { this.connected = false; }
      sendOffer() {}
      sendAnswer() {}
      sendIceCandidate() {}
      getSocketId() { return 'my-socket-id'; }
    },
  };
});

describe('useWebRTC', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset();
    useSessionStore.getState().reset();
  });

  it('returns sendMessage function and dataChannelRef', () => {
    const { result } = renderHook(() => useWebRTC({ onMessage: vi.fn() }));

    expect(typeof result.current.sendMessage).toBe('function');
    expect(result.current.dataChannelRef).toBeDefined();
  });

  it('does not connect when no session or peerName', () => {
    const { result } = renderHook(() => useWebRTC({ onMessage: vi.fn() }));

    expect(useConnectionStore.getState().connectionState).toBe('disconnected');
    expect(result.current.sendMessage({ type: 'test' } as unknown as DataChannelMessage)).toBe(false);
  });

  it('sets connection state to connecting when session and name are set', async () => {
    useSessionStore.getState().createSession('test-session');
    useSessionStore.getState().setPeerName('TestUser');

    renderHook(() => useWebRTC({ onMessage: vi.fn() }));

    expect(useConnectionStore.getState().connectionState).toBe('connecting');
  });

  it('cleans up on unmount', () => {
    useSessionStore.getState().createSession('test-session');
    useSessionStore.getState().setPeerName('TestUser');

    const { unmount } = renderHook(() => useWebRTC({ onMessage: vi.fn() }));

    unmount();

    expect(useConnectionStore.getState().connectionState).toBe('disconnected');
  });

  it('sendMessage returns false when no data channel', () => {
    const { result } = renderHook(() => useWebRTC({ onMessage: vi.fn() }));

    expect(result.current.sendMessage({ type: 'test' } as unknown as DataChannelMessage)).toBe(false);
  });
});
