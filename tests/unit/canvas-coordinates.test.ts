import { describe, it, expect } from 'vitest';
import {
  getCSSScale,
  clientToLogical,
  clientToBuffer,
  getTouchDistance,
  getTouchMidpoint,
  reconcileCoordinates,
  MIN_SCALE,
  MAX_SCALE,
} from '../../src/services/canvas-logic';

describe('Canvas Coordinate Math', () => {
  describe('getCSSScale', () => {
    it('returns 1:1 when canvas and CSS sizes match', () => {
      const result = getCSSScale(800, 600, 800, 600);
      expect(result).toEqual({ x: 1, y: 1 });
    });

    it('returns 2:1 when canvas is twice the CSS size', () => {
      const result = getCSSScale(1600, 1200, 800, 600);
      expect(result).toEqual({ x: 2, y: 2 });
    });

    it('handles non-uniform scaling', () => {
      const result = getCSSScale(1000, 500, 500, 250);
      expect(result.x).toBe(2);
      expect(result.y).toBe(2);
    });
  });

  describe('clientToLogical', () => {
    const rect = { left: 0, top: 0 };
    const cssScale = { x: 1, y: 1 };

    it('returns client coords when no zoom/pan', () => {
      const result = clientToLogical(100, 200, rect, cssScale, 0, 0, 1);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('accounts for canvas rect offset', () => {
      const offsetRect = { left: 50, top: 100 };
      const result = clientToLogical(150, 300, offsetRect, cssScale, 0, 0, 1);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('applies zoom inverse', () => {
      const result = clientToLogical(200, 400, rect, cssScale, 0, 0, 2);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('applies pan inverse', () => {
      const result = clientToLogical(150, 250, rect, cssScale, 50, 50, 1);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('combines zoom and pan', () => {
      // bufferX = 200, bufferY = 400
      // logicalX = (200 - 100) / 2 = 50
      // logicalY = (400 - 200) / 2 = 100
      const result = clientToLogical(200, 400, rect, cssScale, 100, 200, 2);
      expect(result).toEqual({ x: 50, y: 100 });
    });

    it('applies CSS scaling', () => {
      const scale2x = { x: 2, y: 2 };
      // bufferX = 100 * 2 = 200, bufferY = 200 * 2 = 400
      const result = clientToLogical(100, 200, rect, scale2x, 0, 0, 1);
      expect(result).toEqual({ x: 200, y: 400 });
    });
  });

  describe('clientToBuffer', () => {
    it('converts client to buffer without zoom/pan', () => {
      const rect = { left: 10, top: 20 };
      const cssScale = { x: 2, y: 2 };
      const result = clientToBuffer(110, 220, rect, cssScale);
      expect(result).toEqual({ x: 200, y: 400 });
    });
  });

  describe('getTouchDistance', () => {
    it('returns distance between two touch points', () => {
      const t0 = { clientX: 0, clientY: 0 };
      const t1 = { clientX: 3, clientY: 4 };
      expect(getTouchDistance(t0, t1)).toBe(5);
    });

    it('returns 0 for same point', () => {
      const t = { clientX: 50, clientY: 50 };
      expect(getTouchDistance(t, t)).toBe(0);
    });
  });

  describe('getTouchMidpoint', () => {
    it('returns midpoint between two touch points', () => {
      const t0 = { clientX: 0, clientY: 0 };
      const t1 = { clientX: 100, clientY: 200 };
      expect(getTouchMidpoint(t0, t1)).toEqual({ x: 50, y: 100 });
    });
  });

  describe('reconcileCoordinates', () => {
    it('clamps scale to min', () => {
      const result = reconcileCoordinates(0, 0, 0.1, 800, 600);
      expect(result.scale).toBe(MIN_SCALE);
    });

    it('clamps scale to max', () => {
      const result = reconcileCoordinates(0, 0, 10, 800, 600);
      expect(result.scale).toBe(MAX_SCALE);
    });

    it('clamps pan to max bounds', () => {
      const result = reconcileCoordinates(99999, -99999, 1, 800, 600);
      const maxPan = Math.max(800, 600) * 2;
      expect(result.panX).toBe(maxPan);
      expect(result.panY).toBe(-maxPan);
    });

    it('passes through valid values unchanged', () => {
      const result = reconcileCoordinates(50, -30, 1.5, 800, 600);
      expect(result).toEqual({ panX: 50, panY: -30, scale: 1.5 });
    });
  });
});
