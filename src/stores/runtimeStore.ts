import { create } from 'zustand';

export type RuntimeStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RuntimeInfo {
  status: RuntimeStatus;
  progress: number; // 0-100
  error?: string;
}

interface RuntimeState {
  runtimes: Record<string, RuntimeInfo>;
}

interface RuntimeActions {
  setStatus: (lang: string, status: RuntimeStatus) => void;
  setProgress: (lang: string, progress: number) => void;
  setError: (lang: string, error: string) => void;
  getRuntime: (lang: string) => RuntimeInfo;
  reset: () => void;
}

export type RuntimeStore = RuntimeState & RuntimeActions;

const DEFAULT_RUNTIME: RuntimeInfo = { status: 'idle', progress: 0 };

export const useRuntimeStore = create<RuntimeStore>((set, get) => ({
  runtimes: {},

  setStatus: (lang, status) =>
    set((state) => ({
      runtimes: {
        ...state.runtimes,
        [lang]: {
          ...DEFAULT_RUNTIME,
          ...state.runtimes[lang],
          status,
          ...(status === 'ready' ? { progress: 100 } : {}),
          ...(status === 'idle' ? { progress: 0, error: undefined } : {}),
        },
      },
    })),

  setProgress: (lang, progress) =>
    set((state) => ({
      runtimes: {
        ...state.runtimes,
        [lang]: {
          ...DEFAULT_RUNTIME,
          ...state.runtimes[lang],
          status: 'loading',
          progress,
        },
      },
    })),

  setError: (lang, error) =>
    set((state) => ({
      runtimes: {
        ...state.runtimes,
        [lang]: {
          status: 'error',
          progress: 0,
          error,
        },
      },
    })),

  getRuntime: (lang) => get().runtimes[lang] ?? DEFAULT_RUNTIME,

  reset: () => set({ runtimes: {} }),
}));
