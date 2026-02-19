/**
 * Canvas Logic Service Unit Tests
 *
 * Tests for coordinate transforms, drawing helpers, shape hit-testing,
 * stroke filtering, and text wrapping from src/services/canvas-logic.js.
 */

import { describe, it, expect } from 'vitest';
import {
  getCSSScale,
  clientToLogical,
  clientToBuffer,
  getTouchDistance,
  getTouchMidpoint,
  applyCanvasTransform,
  resetCanvasTransform,
  reconcileCoordinates,
  filterStrokesAfterErase,
  findShapeAtPosition,
  getShapeCenter,
  containsNonASCII,
  wrapText,
  MIN_SCALE,
  MAX_SCALE,
  type Stroke,
} from '../../src/services/canvas-logic.js';

// ── Coordinate Transform Functions ──────────────────────────────────────────

describe('getCSSScale', () => {
  it('should return 1:1 when buffer and CSS sizes match', () => {
    const s = getCSSScale(800, 600, 800, 600);
    expect(s.x).toBe(1);
    expect(s.y).toBe(1);
  });

  it('should compute ratio when buffer is 2x CSS size (retina)', () => {
    const s = getCSSScale(1600, 1200, 800, 600);
    expect(s.x).toBe(2);
    expect(s.y).toBe(2);
  });

  it('should handle non-uniform scaling', () => {
    const s = getCSSScale(400, 600, 200, 400);
    expect(s.x).toBe(2);
    expect(s.y).toBe(1.5);
  });
});

describe('clientToLogical', () => {
  it('should return origin when click is at rect top-left with no zoom/pan', () => {
    const rect = { left: 100, top: 50 };
    const cssScale = { x: 1, y: 1 };
    const pos = clientToLogical(100, 50, rect, cssScale, 0, 0, 1);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it('should account for CSS scale', () => {
    const rect = { left: 0, top: 0 };
    const cssScale = { x: 2, y: 2 };
    const pos = clientToLogical(50, 50, rect, cssScale, 0, 0, 1);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(100);
  });

  it('should apply inverse zoom/pan', () => {
    const rect = { left: 0, top: 0 };
    const cssScale = { x: 1, y: 1 };
    // Zoomed to 2x with pan (100, 50)
    const pos = clientToLogical(200, 150, rect, cssScale, 100, 50, 2);
    expect(pos.x).toBe(50);  // (200 - 100) / 2
    expect(pos.y).toBe(50);  // (150 - 50) / 2
  });
});

describe('clientToBuffer', () => {
  it('should convert client to buffer coords without zoom/pan', () => {
    const rect = { left: 10, top: 20 };
    const cssScale = { x: 2, y: 2 };
    const pos = clientToBuffer(60, 70, rect, cssScale);
    expect(pos.x).toBe(100); // (60-10)*2
    expect(pos.y).toBe(100); // (70-20)*2
  });
});

describe('getTouchDistance', () => {
  it('should compute distance between two touch points', () => {
    const t0 = { clientX: 0, clientY: 0 };
    const t1 = { clientX: 3, clientY: 4 };
    expect(getTouchDistance(t0, t1)).toBe(5);
  });

  it('should return 0 for same point', () => {
    const t = { clientX: 10, clientY: 20 };
    expect(getTouchDistance(t, t)).toBe(0);
  });
});

describe('getTouchMidpoint', () => {
  it('should compute midpoint', () => {
    const t0 = { clientX: 0, clientY: 0 };
    const t1 = { clientX: 100, clientY: 200 };
    const mid = getTouchMidpoint(t0, t1);
    expect(mid.x).toBe(50);
    expect(mid.y).toBe(100);
  });
});

describe('applyCanvasTransform / resetCanvasTransform', () => {
  it('should call setTransform with scale and pan', () => {
    const ctx = { setTransform: (...args: number[]) => { ctx._args = args; }, _args: [] as number[] };
    applyCanvasTransform(ctx as unknown as CanvasRenderingContext2D, 2, 10, 20);
    expect(ctx._args).toEqual([2, 0, 0, 2, 10, 20]);
  });

  it('should reset to identity', () => {
    const ctx = { setTransform: (...args: number[]) => { ctx._args = args; }, _args: [] as number[] };
    resetCanvasTransform(ctx as unknown as CanvasRenderingContext2D);
    expect(ctx._args).toEqual([1, 0, 0, 1, 0, 0]);
  });
});

describe('reconcileCoordinates', () => {
  it('should clamp scale to bounds', () => {
    const r = reconcileCoordinates(0, 0, 0.1, 800, 600);
    expect(r.scale).toBe(MIN_SCALE);

    const r2 = reconcileCoordinates(0, 0, 10, 800, 600);
    expect(r2.scale).toBe(MAX_SCALE);
  });

  it('should clamp pan to +/-2x canvas dimension', () => {
    const r = reconcileCoordinates(5000, -5000, 1, 800, 600);
    const maxPan = 1600; // max(800,600)*2
    expect(r.panX).toBe(maxPan);
    expect(r.panY).toBe(-maxPan);
  });

  it('should pass through valid values unchanged', () => {
    const r = reconcileCoordinates(10, 20, 1.5, 800, 600);
    expect(r.panX).toBe(10);
    expect(r.panY).toBe(20);
    expect(r.scale).toBe(1.5);
  });

  it('should accept custom min/max scale', () => {
    const r = reconcileCoordinates(0, 0, 0.5, 100, 100, 0.5, 2);
    expect(r.scale).toBe(0.5);

    const r2 = reconcileCoordinates(0, 0, 3, 100, 100, 0.5, 2);
    expect(r2.scale).toBe(2);
  });
});

// ── Drawing / Shape Helpers ─────────────────────────────────────────────────

describe('filterStrokesAfterErase', () => {
  const penStroke: Stroke = {
    tool: 'pen',
    color: '#000',
    points: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }],
  };

  const lineStroke: Stroke = {
    tool: 'line',
    color: '#f00',
    start: { x: 50, y: 50 },
    end: { x: 100, y: 100 },
  };

  const rectStroke: Stroke = {
    tool: 'rectangle',
    color: '#0f0',
    start: { x: 200, y: 200 },
    end: { x: 300, y: 300 },
  };

  it('should remove pen stroke when a point is within erase radius', () => {
    const result = filterStrokesAfterErase([penStroke], 10, 10, 5);
    expect(result).toHaveLength(0);
  });

  it('should keep pen stroke when no point is within erase radius', () => {
    const result = filterStrokesAfterErase([penStroke], 100, 100, 5);
    expect(result).toHaveLength(1);
  });

  it('should remove line stroke when start is within radius', () => {
    const result = filterStrokesAfterErase([lineStroke], 50, 50, 5);
    expect(result).toHaveLength(0);
  });

  it('should remove line stroke when midpoint is within radius', () => {
    const result = filterStrokesAfterErase([lineStroke], 75, 75, 5);
    expect(result).toHaveLength(0);
  });

  it('should keep line stroke when no key point is within radius', () => {
    const result = filterStrokesAfterErase([lineStroke], 0, 0, 5);
    expect(result).toHaveLength(1);
  });

  it('should remove rect stroke when start is within radius', () => {
    const result = filterStrokesAfterErase([rectStroke], 200, 200, 5);
    expect(result).toHaveLength(0);
  });

  it('should erase rect stroke when point is inside', () => {
    // (250,250) is inside rect (200,200)→(300,300)
    const result = filterStrokesAfterErase([rectStroke], 250, 250, 5);
    expect(result).toHaveLength(0);
  });

  it('should keep rect stroke when far outside', () => {
    const result = filterStrokesAfterErase([rectStroke], 500, 500, 5);
    expect(result).toHaveLength(1);
  });

  it('should keep strokes of unknown type', () => {
    const unknownStroke = { tool: 'unknown', data: 'test' } as unknown as Stroke;
    const result = filterStrokesAfterErase([unknownStroke], 0, 0, 100);
    expect(result).toHaveLength(1);
  });

  it('should filter multiple strokes independently', () => {
    const result = filterStrokesAfterErase(
      [penStroke, lineStroke, rectStroke],
      10, 10, 5
    );
    // penStroke hit, others kept
    expect(result).toHaveLength(2);
  });
});

describe('findShapeAtPosition', () => {
  const strokes: Stroke[] = [
    { tool: 'pen', color: '#000', points: [{ x: 5, y: 5 }] },
    { tool: 'rectangle', color: '#f00', start: { x: 10, y: 10 }, end: { x: 50, y: 50 } },
    { tool: 'circle', color: '#0f0', start: { x: 100, y: 100 }, end: { x: 120, y: 100 } },
  ];

  it('should find rectangle when point is inside', () => {
    expect(findShapeAtPosition(strokes, 30, 30)).toBe(1);
  });

  it('should find circle when point is inside', () => {
    expect(findShapeAtPosition(strokes, 110, 100)).toBe(2);
  });

  it('should return null for pen strokes (not hit-testable)', () => {
    expect(findShapeAtPosition(strokes, 5, 5)).toBeNull();
  });

  it('should return null when outside all shapes', () => {
    expect(findShapeAtPosition(strokes, 500, 500)).toBeNull();
  });

  it('should return topmost shape when overlapping', () => {
    const overlapping: Stroke[] = [
      { tool: 'rectangle', start: { x: 0, y: 0 }, end: { x: 100, y: 100 } },
      { tool: 'rectangle', start: { x: 0, y: 0 }, end: { x: 100, y: 100 } },
    ];
    // Should return index 1 (last, topmost)
    expect(findShapeAtPosition(overlapping, 50, 50)).toBe(1);
  });

  it('should return null for empty strokes', () => {
    expect(findShapeAtPosition([], 50, 50)).toBeNull();
  });
});

describe('getShapeCenter', () => {
  it('should return center of rectangle', () => {
    const stroke: Stroke = { tool: 'rectangle', start: { x: 0, y: 0 }, end: { x: 100, y: 200 } };
    const center = getShapeCenter(stroke);
    expect(center.x).toBe(50);
    expect(center.y).toBe(100);
  });

  it('should return start for circle (center)', () => {
    const stroke: Stroke = { tool: 'circle', start: { x: 50, y: 75 }, end: { x: 80, y: 75 } };
    const center = getShapeCenter(stroke);
    expect(center.x).toBe(50);
    expect(center.y).toBe(75);
  });

  it('should return position property as fallback', () => {
    const stroke: Stroke = { tool: 'text', position: { x: 30, y: 40 } };
    const center = getShapeCenter(stroke);
    expect(center.x).toBe(30);
    expect(center.y).toBe(40);
  });

  it('should return {0,0} when no position info', () => {
    const stroke: Stroke = { tool: 'unknown' };
    const center = getShapeCenter(stroke);
    expect(center.x).toBe(0);
    expect(center.y).toBe(0);
  });
});

// ── Export Helpers ───────────────────────────────────────────────────────────

describe('containsNonASCII', () => {
  it('should return false for ASCII-only text', () => {
    expect(containsNonASCII('Hello World 123!')).toBe(false);
  });

  it('should return true for Cyrillic text', () => {
    expect(containsNonASCII('\u041f\u0440\u0438\u0432\u0435\u0442')).toBe(true);
  });

  it('should return true for CJK text', () => {
    expect(containsNonASCII('\u4f60\u597d')).toBe(true);
  });

  it('should return true for mixed text', () => {
    expect(containsNonASCII('Hello \u041c\u0438\u0440')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(containsNonASCII('')).toBe(false);
  });
});

describe('wrapText', () => {
  // Simple measureWidth mock: each character is 10px wide
  const measureWidth = (text: string): number => text.length * 10;

  it('should not wrap short text', () => {
    const lines = wrapText('Hi', 100, measureWidth);
    expect(lines).toEqual(['Hi']);
  });

  it('should wrap text exceeding maxWidth', () => {
    const lines = wrapText('one two three', 50, measureWidth);
    // "one" = 30px, "one two" = 70px > 50, wrap
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]).toBe('one');
  });

  it('should handle single word exceeding maxWidth', () => {
    const lines = wrapText('superlongword', 50, measureWidth);
    // Single word can't be split, so it stays on one line
    expect(lines).toEqual(['superlongword']);
  });

  it('should return empty array for empty string', () => {
    const lines = wrapText('', 100, measureWidth);
    expect(lines).toEqual([]);
  });

  it('should handle exact width boundary', () => {
    // "abcde" = 50px exactly, should fit without wrapping
    const lines = wrapText('abcde fghij', 50, measureWidth);
    expect(lines).toEqual(['abcde', 'fghij']);
  });
});
