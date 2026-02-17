import { create } from 'zustand';
import type { ConnectionState, ConnectionType, ConnectionQuality } from '../services/connection-manager';

interface ConnectionStoreState {
  connectionState: ConnectionState;
  connectionType: ConnectionType | null;
  latency: number | null;
  quality: ConnectionQuality | null;
  peerConnections: Record<string, string>;
}

interface ConnectionMetricsUpdate {
  latency?: number | null;
  connectionType?: ConnectionType | null;
  quality?: ConnectionQuality | null;
}

interface ConnectionActions {
  updateConnectionState: (connectionState: ConnectionState) => void;
  updateMetrics: (metrics: ConnectionMetricsUpdate) => void;
  addPeer: (peerId: string, status: string) => void;
  removePeer: (peerId: string) => void;
  reset: () => void;
}

export type ConnectionStore = ConnectionStoreState & ConnectionActions;

const initialState: ConnectionStoreState = {
  connectionState: 'disconnected',
  connectionType: null,
  latency: null,
  quality: null,
  peerConnections: {},
};

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...initialState,

  updateConnectionState: (connectionState) => set({ connectionState }),

  updateMetrics: (metrics) =>
    set((state) => ({
      latency: metrics.latency ?? state.latency,
      connectionType: metrics.connectionType ?? state.connectionType,
      quality: metrics.quality ?? state.quality,
    })),

  addPeer: (peerId, status) =>
    set((state) => ({
      peerConnections: {
        ...state.peerConnections,
        [peerId]: status,
      },
    })),

  removePeer: (peerId) =>
    set((state) => {
      const { [peerId]: _, ...rest } = state.peerConnections;
      return { peerConnections: rest };
    }),

  reset: () => set(initialState),
}));
