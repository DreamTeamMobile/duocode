import { create } from 'zustand';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

interface ExecutionState {
  isRunning: boolean;
  output: ExecutionResult | null;
  panelExpanded: boolean;
  /** Set by useExecutionSync — triggers code execution with sync. */
  runCode: (() => void) | null;
  /** Set by useExecutionSync — cancels in-progress execution. */
  cancelCode: (() => void) | null;
}

interface ExecutionActions {
  startExecution: () => void;
  setResult: (result: ExecutionResult) => void;
  stopExecution: () => void;
  togglePanel: () => void;
  setCallbacks: (run: () => void, cancel: () => void) => void;
  reset: () => void;
}

export type ExecutionStore = ExecutionState & ExecutionActions;

const initialState: ExecutionState = {
  isRunning: false,
  output: null,
  panelExpanded: false,
  runCode: null,
  cancelCode: null,
};

export const useExecutionStore = create<ExecutionStore>((set) => ({
  ...initialState,

  startExecution: () =>
    set({ isRunning: true, output: null, panelExpanded: true }),

  setResult: (result) =>
    set({ isRunning: false, output: result }),

  stopExecution: () =>
    set({ isRunning: false }),

  togglePanel: () =>
    set((state) => ({ panelExpanded: !state.panelExpanded })),

  setCallbacks: (run, cancel) =>
    set({ runCode: run, cancelCode: cancel }),

  reset: () => set(initialState),
}));
