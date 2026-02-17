import { create } from 'zustand';

export interface Participant {
  name?: string;
  isHost?: boolean;
  joinedAt?: number;
  [key: string]: unknown;
}

interface SessionState {
  sessionId: string | null;
  isHost: boolean;
  peerName: string | null;
  sessionStartTime: number | null;
  participants: Record<string, Participant>;
}

interface SessionActions {
  createSession: (sessionId: string) => void;
  joinSession: (sessionId: string) => void;
  setPeerName: (name: string) => void;
  updateParticipant: (peerId: string, data: Partial<Participant>) => void;
  removeParticipant: (peerId: string) => void;
  transferHost: (newHostPeerId: string | null) => void;
  reset: () => void;
}

export type SessionStore = SessionState & SessionActions;

const initialState: SessionState = {
  sessionId: null,
  isHost: false,
  peerName: null,
  sessionStartTime: null,
  participants: {},
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialState,

  createSession: (sessionId) =>
    set({ sessionId, isHost: true, sessionStartTime: Date.now() }),

  joinSession: (sessionId) =>
    set({ sessionId, isHost: false, sessionStartTime: Date.now() }),

  setPeerName: (name) => set({ peerName: name }),

  updateParticipant: (peerId, data) =>
    set((state) => ({
      participants: {
        ...state.participants,
        [peerId]: { ...state.participants[peerId], ...data },
      },
    })),

  removeParticipant: (peerId) =>
    set((state) => {
      const { [peerId]: _, ...rest } = state.participants;
      return { participants: rest };
    }),

  transferHost: (newHostPeerId) =>
    set((state) => {
      const isLocalHost = newHostPeerId === null;
      const participants = { ...state.participants };
      for (const id of Object.keys(participants)) {
        participants[id] = {
          ...participants[id],
          isHost: id === newHostPeerId,
        };
      }
      return {
        isHost: isLocalHost,
        participants,
      };
    }),

  reset: () => set(initialState),
}));
