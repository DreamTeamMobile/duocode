import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../../src/stores/canvasStore';
import type { Stroke } from '../../src/services/canvas-logic';

describe('canvasStore', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have correct defaults', () => {
      const state = useCanvasStore.getState();
      expect(state.currentTool).toBe('pen');
      expect(state.strokeColor).toBe('#ffffff');
      expect(state.strokeWidth).toBe(2);
      expect(state.zoom).toBe(1);
      expect(state.panOffset).toEqual({ x: 0, y: 0 });
      expect(state.drawingStrokes).toEqual([]);
      expect(state.undoHistory).toEqual([]);
      expect(state.redoHistory).toEqual([]);
    });
  });

  describe('setTool', () => {
    it('should update the current tool', () => {
      useCanvasStore.getState().setTool('eraser');
      expect(useCanvasStore.getState().currentTool).toBe('eraser');
    });
  });

  describe('setStrokeColor', () => {
    it('should update stroke color', () => {
      useCanvasStore.getState().setStrokeColor('#ff0000');
      expect(useCanvasStore.getState().strokeColor).toBe('#ff0000');
    });
  });

  describe('setStrokeWidth', () => {
    it('should update stroke width', () => {
      useCanvasStore.getState().setStrokeWidth(5);
      expect(useCanvasStore.getState().strokeWidth).toBe(5);
    });
  });

  describe('addStroke', () => {
    it('should add a stroke to drawingStrokes', () => {
      const stroke: Stroke = { tool: 'pen', color: '#fff', points: [{ x: 0, y: 0 }] };
      useCanvasStore.getState().addStroke(stroke);
      expect(useCanvasStore.getState().drawingStrokes).toEqual([stroke]);
    });

    it('should push previous strokes to undoHistory', () => {
      const stroke1: Stroke = { tool: 'pen', color: '#fff', points: [{ x: 0, y: 0 }] };
      const stroke2: Stroke = { tool: 'pen', color: '#fff', points: [{ x: 1, y: 1 }] };
      useCanvasStore.getState().addStroke(stroke1);
      useCanvasStore.getState().addStroke(stroke2);
      const { undoHistory } = useCanvasStore.getState();
      expect(undoHistory).toHaveLength(2);
      expect(undoHistory[0]).toEqual([]);
      expect(undoHistory[1]).toEqual([stroke1]);
    });

    it('should clear redoHistory on new stroke', () => {
      const stroke1: Stroke = { tool: 'pen', points: [{ x: 0, y: 0 }] };
      const stroke2: Stroke = { tool: 'pen', points: [{ x: 1, y: 1 }] };
      useCanvasStore.getState().addStroke(stroke1);
      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().redoHistory).toHaveLength(1);
      useCanvasStore.getState().addStroke(stroke2);
      expect(useCanvasStore.getState().redoHistory).toEqual([]);
    });

    it('should cap undoHistory at MAX_HISTORY_SIZE', () => {
      for (let i = 0; i < 15; i++) {
        useCanvasStore.getState().addStroke({ tool: 'pen' } as Stroke);
      }
      // MAX_HISTORY_SIZE is 10
      expect(useCanvasStore.getState().undoHistory.length).toBeLessThanOrEqual(10);
    });
  });

  describe('undo', () => {
    it('should restore the previous strokes state', () => {
      const stroke: Stroke = { tool: 'pen', points: [{ x: 0, y: 0 }] };
      useCanvasStore.getState().addStroke(stroke);
      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().drawingStrokes).toEqual([]);
    });

    it('should push current strokes to redoHistory', () => {
      const stroke: Stroke = { tool: 'pen', points: [{ x: 0, y: 0 }] };
      useCanvasStore.getState().addStroke(stroke);
      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().redoHistory).toHaveLength(1);
      expect(useCanvasStore.getState().redoHistory[0]).toEqual([stroke]);
    });

    it('should not change state when undoHistory is empty', () => {
      const before = useCanvasStore.getState().drawingStrokes;
      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().drawingStrokes).toBe(before);
    });
  });

  describe('redo', () => {
    it('should restore the next strokes state', () => {
      const stroke: Stroke = { tool: 'pen', points: [{ x: 0, y: 0 }] };
      useCanvasStore.getState().addStroke(stroke);
      useCanvasStore.getState().undo();
      useCanvasStore.getState().redo();
      expect(useCanvasStore.getState().drawingStrokes).toEqual([stroke]);
    });

    it('should push current strokes to undoHistory on redo', () => {
      const stroke: Stroke = { tool: 'pen', points: [{ x: 0, y: 0 }] };
      useCanvasStore.getState().addStroke(stroke);
      useCanvasStore.getState().undo();
      useCanvasStore.getState().redo();
      expect(useCanvasStore.getState().undoHistory.length).toBeGreaterThan(0);
    });

    it('should not change state when redoHistory is empty', () => {
      const before = useCanvasStore.getState().drawingStrokes;
      useCanvasStore.getState().redo();
      expect(useCanvasStore.getState().drawingStrokes).toBe(before);
    });
  });

  describe('clear', () => {
    it('should clear all strokes', () => {
      useCanvasStore.getState().addStroke({ tool: 'pen', points: [] });
      useCanvasStore.getState().clear();
      expect(useCanvasStore.getState().drawingStrokes).toEqual([]);
    });

    it('should save current state to undoHistory before clearing', () => {
      const stroke: Stroke = { tool: 'pen', points: [{ x: 0, y: 0 }] };
      useCanvasStore.getState().addStroke(stroke);
      useCanvasStore.getState().clear();
      const { undoHistory } = useCanvasStore.getState();
      expect(undoHistory[undoHistory.length - 1]).toEqual([stroke]);
    });
  });

  describe('setZoom', () => {
    it('should update the zoom level', () => {
      useCanvasStore.getState().setZoom(2.5);
      expect(useCanvasStore.getState().zoom).toBe(2.5);
    });
  });

  describe('setPan', () => {
    it('should update the pan offset', () => {
      useCanvasStore.getState().setPan({ x: 100, y: -50 });
      expect(useCanvasStore.getState().panOffset).toEqual({ x: 100, y: -50 });
    });
  });

  describe('reset', () => {
    it('should restore all defaults', () => {
      useCanvasStore.getState().setTool('eraser');
      useCanvasStore.getState().setStrokeColor('#ff0000');
      useCanvasStore.getState().addStroke({ tool: 'pen' } as Stroke);
      useCanvasStore.getState().setZoom(3);
      useCanvasStore.getState().setPan({ x: 50, y: 50 });
      useCanvasStore.getState().reset();
      const state = useCanvasStore.getState();
      expect(state.currentTool).toBe('pen');
      expect(state.strokeColor).toBe('#ffffff');
      expect(state.drawingStrokes).toEqual([]);
      expect(state.zoom).toBe(1);
      expect(state.panOffset).toEqual({ x: 0, y: 0 });
      expect(state.undoHistory).toEqual([]);
      expect(state.redoHistory).toEqual([]);
    });
  });
});
