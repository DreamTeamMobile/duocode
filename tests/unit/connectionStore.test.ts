import { describe, it, expect, beforeEach } from 'vitest';
import { useConnectionStore } from '../../src/stores/connectionStore.js';

describe('connectionStore', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have correct defaults', () => {
      const state = useConnectionStore.getState();
      expect(state.connectionState).toBe('disconnected');
      expect(state.connectionType).toBeNull();
      expect(state.latency).toBeNull();
      expect(state.quality).toBeNull();
      expect(state.peerConnections).toEqual({});
    });
  });

  describe('updateConnectionState', () => {
    it('should update connection state', () => {
      useConnectionStore.getState().updateConnectionState('connected');
      expect(useConnectionStore.getState().connectionState).toBe('connected');
    });

    it('should allow transitioning through states', () => {
      const store = useConnectionStore.getState();
      store.updateConnectionState('connecting');
      expect(useConnectionStore.getState().connectionState).toBe('connecting');
      useConnectionStore.getState().updateConnectionState('connected');
      expect(useConnectionStore.getState().connectionState).toBe('connected');
    });
  });

  describe('updateMetrics', () => {
    it('should update latency', () => {
      useConnectionStore.getState().updateMetrics({ latency: 42 });
      expect(useConnectionStore.getState().latency).toBe(42);
    });

    it('should update connectionType', () => {
      useConnectionStore.getState().updateMetrics({ connectionType: 'relay' });
      expect(useConnectionStore.getState().connectionType).toBe('relay');
    });

    it('should update quality', () => {
      useConnectionStore.getState().updateMetrics({ quality: 'good' });
      expect(useConnectionStore.getState().quality).toBe('good');
    });

    it('should preserve fields not included in the update', () => {
      useConnectionStore.getState().updateMetrics({ latency: 10, connectionType: 'direct' });
      useConnectionStore.getState().updateMetrics({ latency: 20 });
      const state = useConnectionStore.getState();
      expect(state.latency).toBe(20);
      expect(state.connectionType).toBe('direct');
    });
  });

  describe('addPeer', () => {
    it('should add a peer connection', () => {
      useConnectionStore.getState().addPeer('peer1', 'connected');
      expect(useConnectionStore.getState().peerConnections.peer1).toBe('connected');
    });

    it('should update an existing peer status', () => {
      useConnectionStore.getState().addPeer('peer1', 'connecting');
      useConnectionStore.getState().addPeer('peer1', 'connected');
      expect(useConnectionStore.getState().peerConnections.peer1).toBe('connected');
    });
  });

  describe('removePeer', () => {
    it('should remove a peer connection', () => {
      useConnectionStore.getState().addPeer('peer1', 'connected');
      useConnectionStore.getState().addPeer('peer2', 'connected');
      useConnectionStore.getState().removePeer('peer1');
      const { peerConnections } = useConnectionStore.getState();
      expect(peerConnections.peer1).toBeUndefined();
      expect(peerConnections.peer2).toBe('connected');
    });
  });

  describe('reset', () => {
    it('should restore all defaults', () => {
      useConnectionStore.getState().updateConnectionState('connected');
      useConnectionStore.getState().updateMetrics({ latency: 42, connectionType: 'direct', quality: 'excellent' });
      useConnectionStore.getState().addPeer('peer1', 'connected');
      useConnectionStore.getState().reset();
      const state = useConnectionStore.getState();
      expect(state.connectionState).toBe('disconnected');
      expect(state.connectionType).toBeNull();
      expect(state.latency).toBeNull();
      expect(state.quality).toBeNull();
      expect(state.peerConnections).toEqual({});
    });
  });
});
