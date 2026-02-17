import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../../src/stores/sessionStore.js';

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have correct defaults', () => {
      const state = useSessionStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.isHost).toBe(false);
      expect(state.peerName).toBeNull();
      expect(state.sessionStartTime).toBeNull();
      expect(state.participants).toEqual({});
    });
  });

  describe('createSession', () => {
    it('should set sessionId, isHost, and sessionStartTime', () => {
      const before = Date.now();
      useSessionStore.getState().createSession('abc123');
      const state = useSessionStore.getState();
      expect(state.sessionId).toBe('abc123');
      expect(state.isHost).toBe(true);
      expect(state.sessionStartTime).toBeGreaterThanOrEqual(before);
    });
  });

  describe('joinSession', () => {
    it('should set sessionId and isHost to false', () => {
      useSessionStore.getState().joinSession('xyz789');
      const state = useSessionStore.getState();
      expect(state.sessionId).toBe('xyz789');
      expect(state.isHost).toBe(false);
    });
  });

  describe('setPeerName', () => {
    it('should update the peer name', () => {
      useSessionStore.getState().setPeerName('Alice');
      expect(useSessionStore.getState().peerName).toBe('Alice');
    });
  });

  describe('updateParticipant', () => {
    it('should add a new participant', () => {
      useSessionStore.getState().updateParticipant('peer1', {
        name: 'Bob',
        isHost: false,
        connectionStatus: 'connected',
      });
      const { participants } = useSessionStore.getState();
      expect(participants.peer1).toEqual({
        name: 'Bob',
        isHost: false,
        connectionStatus: 'connected',
      });
    });

    it('should merge updates into an existing participant', () => {
      useSessionStore.getState().updateParticipant('peer1', {
        name: 'Bob',
        isHost: false,
        connectionStatus: 'connecting',
      });
      useSessionStore.getState().updateParticipant('peer1', {
        connectionStatus: 'connected',
      });
      const { participants } = useSessionStore.getState();
      expect(participants.peer1.name).toBe('Bob');
      expect(participants.peer1.connectionStatus).toBe('connected');
    });
  });

  describe('removeParticipant', () => {
    it('should remove a participant by peerId', () => {
      useSessionStore.getState().updateParticipant('peer1', { name: 'Bob' });
      useSessionStore.getState().updateParticipant('peer2', { name: 'Carol' });
      useSessionStore.getState().removeParticipant('peer1');
      const { participants } = useSessionStore.getState();
      expect(participants.peer1).toBeUndefined();
      expect(participants.peer2).toEqual({ name: 'Carol' });
    });
  });

  describe('transferHost', () => {
    it('should set local host when newHostPeerId is null', () => {
      useSessionStore.getState().createSession('s1');
      useSessionStore.getState().updateParticipant('peer1', {
        name: 'Bob',
        isHost: true,
      });
      useSessionStore.getState().transferHost(null);
      const state = useSessionStore.getState();
      expect(state.isHost).toBe(true);
      expect(state.participants.peer1.isHost).toBe(false);
    });

    it('should set a remote peer as host', () => {
      useSessionStore.getState().createSession('s1');
      useSessionStore.getState().updateParticipant('peer1', {
        name: 'Bob',
        isHost: false,
      });
      useSessionStore.getState().updateParticipant('peer2', {
        name: 'Carol',
        isHost: false,
      });
      useSessionStore.getState().transferHost('peer2');
      const state = useSessionStore.getState();
      expect(state.isHost).toBe(false);
      expect(state.participants.peer1.isHost).toBe(false);
      expect(state.participants.peer2.isHost).toBe(true);
    });
  });

  describe('reset', () => {
    it('should restore all defaults', () => {
      useSessionStore.getState().createSession('s1');
      useSessionStore.getState().setPeerName('Alice');
      useSessionStore.getState().updateParticipant('peer1', { name: 'Bob' });
      useSessionStore.getState().reset();
      const state = useSessionStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.isHost).toBe(false);
      expect(state.peerName).toBeNull();
      expect(state.sessionStartTime).toBeNull();
      expect(state.participants).toEqual({});
    });
  });
});
