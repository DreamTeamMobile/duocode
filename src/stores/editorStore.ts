import { create } from 'zustand';

export interface RemoteCursor {
  position?: number;
  line: number;
  column: number;
  name?: string;
  color?: string;
  [key: string]: unknown;
}

interface EditorState {
  code: string;
  language: string;
  localOperationCount: number;
  remoteOperationCount: number;
  remoteCursors: Record<string, RemoteCursor>;
}

interface EditorActions {
  setCode: (code: string) => void;
  applyLocalOperation: () => void;
  applyRemoteOperation: (code: string) => void;
  setLanguage: (language: string) => void;
  updateRemoteCursor: (peerId: string, cursor: RemoteCursor) => void;
  removeRemoteCursor: (peerId: string) => void;
  reset: () => void;
}

export type EditorStore = EditorState & EditorActions;

const initialState: EditorState = {
  code: '',
  language: 'javascript',
  localOperationCount: 0,
  remoteOperationCount: 0,
  remoteCursors: {},
};

export const useEditorStore = create<EditorStore>((set) => ({
  ...initialState,

  setCode: (code) => set({ code }),

  applyLocalOperation: () =>
    set((state) => ({
      localOperationCount: state.localOperationCount + 1,
    })),

  applyRemoteOperation: (code) =>
    set((state) => ({
      code,
      remoteOperationCount: state.remoteOperationCount + 1,
    })),

  setLanguage: (language) => set({ language }),

  updateRemoteCursor: (peerId, cursor) =>
    set((state) => ({
      remoteCursors: {
        ...state.remoteCursors,
        [peerId]: cursor,
      },
    })),

  removeRemoteCursor: (peerId) =>
    set((state) => {
      const { [peerId]: _, ...rest } = state.remoteCursors;
      return { remoteCursors: rest };
    }),

  reset: () => set(initialState),
}));
