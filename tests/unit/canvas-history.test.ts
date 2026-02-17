/**
 * Canvas Undo/Redo History Unit Tests
 *
 * Tests for the diagram canvas undo/redo functionality.
 * Imports CanvasHistoryManager from src/services/canvas-logic.js.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasHistoryManager, MAX_HISTORY_SIZE, type Stroke } from '../../src/services/canvas-logic.js';

/**
 * Thin wrapper that mirrors the original test helper API (addStroke, clear)
 * while delegating to the extracted CanvasHistoryManager.
 */
class CanvasHistoryTestHelper {
  drawingStrokes: Stroke[];
  _manager: CanvasHistoryManager;

  constructor() {
    this.drawingStrokes = [];
    this._manager = new CanvasHistoryManager(MAX_HISTORY_SIZE);
  }

  get undoHistory(): Stroke[][] { return this._manager.undoStack; }
  get redoHistory(): Stroke[][] { return this._manager.redoStack; }

  saveToUndoHistory(): void {
    this._manager.save(this.drawingStrokes);
  }

  addStroke(stroke: Stroke): void {
    this.saveToUndoHistory();
    this.drawingStrokes.push(stroke);
  }

  clear(): void {
    if (this.drawingStrokes.length > 0) {
      this.saveToUndoHistory();
    }
    this.drawingStrokes = [];
  }

  undo(): boolean {
    const result = this._manager.undo(this.drawingStrokes);
    if (!result) return false;
    this.drawingStrokes = result.strokes;
    return true;
  }

  redo(): boolean {
    const result = this._manager.redo(this.drawingStrokes);
    if (!result) return false;
    this.drawingStrokes = result.strokes;
    return true;
  }

  canUndo(): boolean { return this._manager.canUndo; }
  canRedo(): boolean { return this._manager.canRedo; }
}

describe('Canvas Undo/Redo History', () => {
  let history: CanvasHistoryTestHelper;

  beforeEach(() => {
    history = new CanvasHistoryTestHelper();
  });

  describe('Initial State', () => {
    it('should start with empty strokes and histories', () => {
      expect(history.drawingStrokes).toEqual([]);
      expect(history.undoHistory).toEqual([]);
      expect(history.redoHistory).toEqual([]);
    });

    it('should not allow undo on empty history', () => {
      expect(history.canUndo()).toBe(false);
      expect(history.undo()).toBe(false);
    });

    it('should not allow redo on empty history', () => {
      expect(history.canRedo()).toBe(false);
      expect(history.redo()).toBe(false);
    });
  });

  describe('Adding Strokes', () => {
    it('should add stroke and save previous state to undo history', () => {
      const stroke: Stroke = { tool: 'pen', color: '#000', points: [{ x: 0, y: 0 }] };
      history.addStroke(stroke);

      expect(history.drawingStrokes).toHaveLength(1);
      expect(history.undoHistory).toHaveLength(1);
      expect(history.undoHistory[0]).toEqual([]); // Previous state was empty
    });

    it('should clear redo history when adding new stroke', () => {
      const stroke1: Stroke = { tool: 'pen', color: '#000', points: [{ x: 0, y: 0 }] };
      const stroke2: Stroke = { tool: 'pen', color: '#f00', points: [{ x: 10, y: 10 }] };

      history.addStroke(stroke1);
      history.undo();
      expect(history.canRedo()).toBe(true);

      history.addStroke(stroke2);
      expect(history.canRedo()).toBe(false);
      expect(history.redoHistory).toEqual([]);
    });
  });

  describe('Undo Operation', () => {
    it('should restore previous state on undo', () => {
      const stroke: Stroke = { tool: 'pen', color: '#000', points: [{ x: 0, y: 0 }] };
      history.addStroke(stroke);

      expect(history.drawingStrokes).toHaveLength(1);
      history.undo();
      expect(history.drawingStrokes).toHaveLength(0);
    });

    it('should save current state to redo history on undo', () => {
      const stroke: Stroke = { tool: 'pen', color: '#000', points: [{ x: 0, y: 0 }] };
      history.addStroke(stroke);
      history.undo();

      expect(history.canRedo()).toBe(true);
      expect(history.redoHistory).toHaveLength(1);
      expect(history.redoHistory[0]).toEqual([stroke]);
    });

    it('should support multiple undos', () => {
      const stroke1: Stroke = { tool: 'pen', color: '#000', points: [{ x: 0, y: 0 }] };
      const stroke2: Stroke = { tool: 'pen', color: '#f00', points: [{ x: 10, y: 10 }] };
      const stroke3: Stroke = { tool: 'line', color: '#00f', start: { x: 0, y: 0 }, end: { x: 20, y: 20 } };

      history.addStroke(stroke1);
      history.addStroke(stroke2);
      history.addStroke(stroke3);

      expect(history.drawingStrokes).toHaveLength(3);

      history.undo();
      expect(history.drawingStrokes).toHaveLength(2);

      history.undo();
      expect(history.drawingStrokes).toHaveLength(1);

      history.undo();
      expect(history.drawingStrokes).toHaveLength(0);

      expect(history.canUndo()).toBe(false);
    });
  });

  describe('Redo Operation', () => {
    it('should restore undone state on redo', () => {
      const stroke: Stroke = { tool: 'pen', color: '#000', points: [{ x: 0, y: 0 }] };
      history.addStroke(stroke);
      history.undo();

      expect(history.drawingStrokes).toHaveLength(0);
      history.redo();
      expect(history.drawingStrokes).toHaveLength(1);
      expect(history.drawingStrokes[0]).toEqual(stroke);
    });

    it('should support multiple redos', () => {
      const stroke1: Stroke = { tool: 'pen', color: '#000', points: [{ x: 0, y: 0 }] };
      const stroke2: Stroke = { tool: 'pen', color: '#f00', points: [{ x: 10, y: 10 }] };

      history.addStroke(stroke1);
      history.addStroke(stroke2);

      history.undo();
      history.undo();

      expect(history.drawingStrokes).toHaveLength(0);

      history.redo();
      expect(history.drawingStrokes).toHaveLength(1);

      history.redo();
      expect(history.drawingStrokes).toHaveLength(2);
    });
  });

  describe('History Size Limit', () => {
    it('should limit undo history to MAX_HISTORY_SIZE', () => {
      // Add more strokes than the limit
      for (let i = 0; i < MAX_HISTORY_SIZE + 5; i++) {
        history.addStroke({ tool: 'pen', color: '#000', points: [{ x: i, y: i }] });
      }

      expect(history.undoHistory.length).toBe(MAX_HISTORY_SIZE);
    });

    it('should remove oldest history when exceeding limit', () => {
      // Add exactly MAX_HISTORY_SIZE strokes
      for (let i = 0; i < MAX_HISTORY_SIZE; i++) {
        history.addStroke({ tool: 'pen', color: '#000', points: [{ x: i, y: i }] });
      }

      // The first entry should be an empty array (before first stroke)
      expect(history.undoHistory[0]).toEqual([]);

      // Add one more stroke
      history.addStroke({ tool: 'pen', color: '#f00', points: [{ x: 100, y: 100 }] });

      // History should still be at limit
      expect(history.undoHistory.length).toBe(MAX_HISTORY_SIZE);

      // First entry should now have 1 stroke (oldest empty was removed)
      expect(history.undoHistory[0]).toHaveLength(1);
    });
  });

  describe('Clear Canvas', () => {
    it('should save state to undo history before clearing', () => {
      const stroke: Stroke = { tool: 'pen', color: '#000', points: [{ x: 0, y: 0 }] };
      history.addStroke(stroke);
      history.clear();

      expect(history.drawingStrokes).toHaveLength(0);
      expect(history.canUndo()).toBe(true);
    });

    it('should allow undo after clear', () => {
      const stroke: Stroke = { tool: 'pen', color: '#000', points: [{ x: 0, y: 0 }] };
      history.addStroke(stroke);
      history.clear();

      expect(history.drawingStrokes).toHaveLength(0);
      history.undo();
      expect(history.drawingStrokes).toHaveLength(1);
    });

    it('should not save to history when clearing empty canvas', () => {
      history.clear();
      expect(history.undoHistory).toHaveLength(0);
    });
  });

  describe('Complex Workflows', () => {
    it('should handle undo, new action, and not allow redo of old action', () => {
      const stroke1: Stroke = { tool: 'pen', color: '#000', points: [{ x: 0, y: 0 }] };
      const stroke2: Stroke = { tool: 'pen', color: '#f00', points: [{ x: 10, y: 10 }] };
      const stroke3: Stroke = { tool: 'pen', color: '#00f', points: [{ x: 20, y: 20 }] };

      history.addStroke(stroke1);
      history.addStroke(stroke2);
      history.undo();

      // stroke2 is in redo history
      expect(history.canRedo()).toBe(true);

      // Add a new stroke (this should clear redo history)
      history.addStroke(stroke3);

      // Cannot redo stroke2 anymore
      expect(history.canRedo()).toBe(false);

      // Strokes should be: stroke1, stroke3
      expect(history.drawingStrokes).toHaveLength(2);
      expect(history.drawingStrokes[0]).toEqual(stroke1);
      expect(history.drawingStrokes[1]).toEqual(stroke3);
    });

    it('should deep copy states in undo history', () => {
      const stroke1: Stroke = { tool: 'pen', color: '#000', points: [{ x: 0, y: 0 }] };
      const stroke2: Stroke = { tool: 'pen', color: '#f00', points: [{ x: 10, y: 10 }] };

      history.addStroke(stroke1);
      history.addStroke(stroke2);

      // Modify current strokes
      history.drawingStrokes[0].color = '#0f0';

      // Undo twice to get back to empty state
      history.undo();
      history.undo();

      // Redo back
      history.redo();

      // The undo history should have preserved the original color
      expect(history.drawingStrokes[0].color).toBe('#000');
    });
  });
});
