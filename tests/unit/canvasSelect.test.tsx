import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../../src/stores/canvasStore';
import {
  findStrokeAtPosition,
  getStrokeBounds,
  translateStroke,
} from '../../src/services/canvas-logic';
import type { Stroke } from '../../src/services/canvas-logic';

/**
 * Tests for selection tool functionality.
 *
 * Requirements:
 * - findStrokeAtPosition correctly hit-tests all stroke types
 * - getStrokeBounds returns correct bounding box for all stroke types
 * - translateStroke correctly shifts coordinates for all stroke types
 * - Select and move updates stroke position in store
 */

describe('Canvas selection tool', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  describe('findStrokeAtPosition', () => {
    it('should find a rectangle stroke', () => {
      const strokes: Stroke[] = [
        { tool: 'rectangle', start: { x: 100, y: 100 }, end: { x: 200, y: 200 }, color: '#fff' },
      ];
      expect(findStrokeAtPosition(strokes, 150, 150)).toBe(0);
    });

    it('should find a circle stroke', () => {
      const strokes: Stroke[] = [
        { tool: 'circle', start: { x: 200, y: 200 }, end: { x: 250, y: 200 }, color: '#fff' },
      ];
      // Point inside circle (radius=50, center=200,200)
      expect(findStrokeAtPosition(strokes, 210, 210)).toBe(0);
    });

    it('should find a text stroke', () => {
      const strokes: Stroke[] = [
        { tool: 'text', text: 'Hello', position: { x: 100, y: 100 }, fontSize: 16, color: '#fff' },
      ];
      expect(findStrokeAtPosition(strokes, 110, 108)).toBe(0);
    });

    it('should find a pen stroke', () => {
      const strokes: Stroke[] = [
        {
          tool: 'pen',
          points: [{ x: 100, y: 100 }, { x: 150, y: 150 }, { x: 200, y: 100 }],
          color: '#fff',
          brushSize: 2,
        },
      ];
      // Point near (150, 150)
      expect(findStrokeAtPosition(strokes, 152, 148)).toBe(0);
    });

    it('should find a line stroke', () => {
      const strokes: Stroke[] = [
        { tool: 'line', start: { x: 100, y: 100 }, end: { x: 200, y: 200 }, color: '#fff' },
      ];
      // Point near the midpoint of the line
      expect(findStrokeAtPosition(strokes, 150, 150)).toBe(0);
    });

    it('should return null for empty area', () => {
      const strokes: Stroke[] = [
        { tool: 'rectangle', start: { x: 100, y: 100 }, end: { x: 200, y: 200 }, color: '#fff' },
      ];
      expect(findStrokeAtPosition(strokes, 500, 500)).toBeNull();
    });

    it('should find topmost stroke when overlapping', () => {
      const strokes: Stroke[] = [
        { tool: 'rectangle', start: { x: 100, y: 100 }, end: { x: 300, y: 300 }, color: '#fff' },
        { tool: 'rectangle', start: { x: 150, y: 150 }, end: { x: 250, y: 250 }, color: '#fff' },
      ];
      expect(findStrokeAtPosition(strokes, 200, 200)).toBe(1);
    });
  });

  describe('getStrokeBounds', () => {
    it('should return bounds for rectangle', () => {
      const stroke: Stroke = { tool: 'rectangle', start: { x: 100, y: 100 }, end: { x: 200, y: 200 } };
      const bounds = getStrokeBounds(stroke);
      expect(bounds).toEqual({ minX: 100, minY: 100, maxX: 200, maxY: 200 });
    });

    it('should handle rectangle drawn right-to-left', () => {
      const stroke: Stroke = { tool: 'rectangle', start: { x: 200, y: 200 }, end: { x: 100, y: 100 } };
      const bounds = getStrokeBounds(stroke);
      expect(bounds).toEqual({ minX: 100, minY: 100, maxX: 200, maxY: 200 });
    });

    it('should return bounds for circle', () => {
      const stroke: Stroke = { tool: 'circle', start: { x: 200, y: 200 }, end: { x: 250, y: 200 } };
      const bounds = getStrokeBounds(stroke);
      // radius=50, so bounds = 150..250, 150..250
      expect(bounds).toEqual({ minX: 150, minY: 150, maxX: 250, maxY: 250 });
    });

    it('should return bounds for pen stroke', () => {
      const stroke: Stroke = {
        tool: 'pen',
        points: [{ x: 50, y: 100 }, { x: 200, y: 50 }, { x: 150, y: 300 }],
      };
      const bounds = getStrokeBounds(stroke);
      expect(bounds).toEqual({ minX: 50, minY: 50, maxX: 200, maxY: 300 });
    });

    it('should return bounds for text stroke', () => {
      const stroke: Stroke = {
        tool: 'text',
        text: 'Hello',
        position: { x: 100, y: 200 },
        fontSize: 16,
      };
      const bounds = getStrokeBounds(stroke);
      expect(bounds.minX).toBe(100);
      expect(bounds.minY).toBe(200);
      expect(bounds.maxX).toBeGreaterThan(100);
      expect(bounds.maxY).toBeGreaterThan(200);
    });

    it('should return bounds for line', () => {
      const stroke: Stroke = { tool: 'line', start: { x: 50, y: 100 }, end: { x: 200, y: 300 } };
      const bounds = getStrokeBounds(stroke);
      expect(bounds).toEqual({ minX: 50, minY: 100, maxX: 200, maxY: 300 });
    });
  });

  describe('translateStroke', () => {
    it('should translate rectangle', () => {
      const stroke: Stroke = { tool: 'rectangle', start: { x: 100, y: 100 }, end: { x: 200, y: 200 }, color: '#fff' };
      const translated = translateStroke(stroke, 50, -30);
      expect(translated.start).toEqual({ x: 150, y: 70 });
      expect(translated.end).toEqual({ x: 250, y: 170 });
    });

    it('should translate circle', () => {
      const stroke: Stroke = { tool: 'circle', start: { x: 200, y: 200 }, end: { x: 250, y: 200 }, color: '#fff' };
      const translated = translateStroke(stroke, 10, 20);
      expect(translated.start).toEqual({ x: 210, y: 220 });
      expect(translated.end).toEqual({ x: 260, y: 220 });
    });

    it('should translate pen stroke', () => {
      const stroke: Stroke = {
        tool: 'pen',
        points: [{ x: 100, y: 100 }, { x: 150, y: 150 }],
        color: '#fff',
      };
      const translated = translateStroke(stroke, 20, 30);
      expect(translated.points).toEqual([{ x: 120, y: 130 }, { x: 170, y: 180 }]);
    });

    it('should translate text stroke', () => {
      const stroke: Stroke = {
        tool: 'text',
        text: 'Hi',
        position: { x: 100, y: 200 },
        fontSize: 16,
        color: '#fff',
      };
      const translated = translateStroke(stroke, -10, 15);
      expect(translated.position).toEqual({ x: 90, y: 215 });
    });

    it('should translate line stroke', () => {
      const stroke: Stroke = { tool: 'line', start: { x: 50, y: 50 }, end: { x: 150, y: 100 }, color: '#fff' };
      const translated = translateStroke(stroke, 25, 25);
      expect(translated.start).toEqual({ x: 75, y: 75 });
      expect(translated.end).toEqual({ x: 175, y: 125 });
    });

    it('should preserve non-coordinate properties', () => {
      const stroke: Stroke = {
        tool: 'rectangle',
        start: { x: 100, y: 100 },
        end: { x: 200, y: 200 },
        color: '#ff0000',
        brushSize: 3,
        text: 'Label',
      };
      const translated = translateStroke(stroke, 10, 10);
      expect(translated.color).toBe('#ff0000');
      expect(translated.brushSize).toBe(3);
      expect(translated.text).toBe('Label');
    });
  });

  describe('Store operations for selection/move', () => {
    it('should update stroke position via updateStrokeAt after move', () => {
      const store = useCanvasStore.getState();

      store.addStroke({
        tool: 'rectangle',
        color: '#ffffff',
        start: { x: 100, y: 100 },
        end: { x: 200, y: 200 },
      });

      // Simulate moving the rectangle by (50, 30)
      const stroke = useCanvasStore.getState().drawingStrokes[0];
      const moved = translateStroke(stroke, 50, 30);
      useCanvasStore.getState().updateStrokeAt(0, moved);

      const updated = useCanvasStore.getState().drawingStrokes[0];
      expect(updated.start).toEqual({ x: 150, y: 130 });
      expect(updated.end).toEqual({ x: 250, y: 230 });
    });
  });
});
