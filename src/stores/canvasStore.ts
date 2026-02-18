import { create } from 'zustand';
import type { CanvasTool, Point, Stroke } from '../services/canvas-logic';
import { MAX_HISTORY_SIZE } from '../services/canvas-logic';

export interface RemoteDrawer {
  x: number;
  y: number;
  name: string;
  active: boolean;
  [key: string]: unknown;
}

interface CanvasState {
  currentTool: CanvasTool;
  strokeColor: string;
  strokeWidth: number;
  zoom: number;
  panOffset: Point;
  drawingStrokes: Stroke[];
  strokeVersion: number;
  undoHistory: Stroke[][];
  redoHistory: Stroke[][];
  remoteDrawers: Record<string, RemoteDrawer>;
}

interface CanvasActions {
  setTool: (tool: CanvasTool) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  addStroke: (stroke: Stroke) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  setZoom: (zoom: number) => void;
  setPan: (offset: Point) => void;
  setStrokes: (strokes: Stroke[]) => void;
  updateStrokeAt: (index: number, updates: Partial<Stroke>) => void;
  updateRemoteDrawer: (peerId: string, data: Partial<RemoteDrawer>) => void;
  removeRemoteDrawer: (peerId: string) => void;
  reset: () => void;
}

export type CanvasStore = CanvasState & CanvasActions;

const initialState: CanvasState = {
  currentTool: 'pen',
  strokeColor: '#ffffff',
  strokeWidth: 2,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  drawingStrokes: [],
  strokeVersion: 0,
  undoHistory: [],
  redoHistory: [],
  remoteDrawers: {},
};

export const useCanvasStore = create<CanvasStore>((set) => ({
  ...initialState,

  setTool: (currentTool) => set({ currentTool }),

  setStrokeColor: (strokeColor) => set({ strokeColor }),

  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),

  addStroke: (stroke) =>
    set((state) => {
      const undoHistory = [...state.undoHistory, [...state.drawingStrokes]];
      if (undoHistory.length > MAX_HISTORY_SIZE) {
        undoHistory.shift();
      }
      return {
        drawingStrokes: [...state.drawingStrokes, stroke],
        undoHistory,
        redoHistory: [],
      };
    }),

  undo: () =>
    set((state) => {
      if (state.undoHistory.length === 0) return state;
      const undoHistory = [...state.undoHistory];
      const previous = undoHistory.pop()!;
      return {
        drawingStrokes: previous,
        undoHistory,
        redoHistory: [...state.redoHistory, [...state.drawingStrokes]],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.redoHistory.length === 0) return state;
      const redoHistory = [...state.redoHistory];
      const next = redoHistory.pop()!;
      return {
        drawingStrokes: next,
        undoHistory: [...state.undoHistory, [...state.drawingStrokes]],
        redoHistory,
      };
    }),

  clear: () =>
    set((state) => ({
      drawingStrokes: [],
      undoHistory: [...state.undoHistory, [...state.drawingStrokes]],
      redoHistory: [],
    })),

  setZoom: (zoom) => set({ zoom }),

  setPan: (panOffset) => set({ panOffset }),

  setStrokes: (drawingStrokes) => set({ drawingStrokes }),

  updateStrokeAt: (index, updates) =>
    set((state) => {
      if (index < 0 || index >= state.drawingStrokes.length) return state;
      const drawingStrokes = [...state.drawingStrokes];
      drawingStrokes[index] = { ...drawingStrokes[index], ...updates };
      return { drawingStrokes, strokeVersion: state.strokeVersion + 1 };
    }),

  updateRemoteDrawer: (peerId, data) =>
    set((state) => ({
      remoteDrawers: {
        ...state.remoteDrawers,
        [peerId]: { ...state.remoteDrawers[peerId], ...data },
      },
    })),

  removeRemoteDrawer: (peerId) =>
    set((state) => {
      const { [peerId]: _, ...rest } = state.remoteDrawers;
      return { remoteDrawers: rest };
    }),

  reset: () => set(initialState),
}));
