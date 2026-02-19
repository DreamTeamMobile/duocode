import { describe, it, expect } from 'vitest';
import { filterStrokesAfterErase } from '../../src/services/canvas-logic';
import type { Stroke } from '../../src/services/canvas-logic';

/**
 * Tests for eraser tool hit-testing.
 *
 * Bug: The eraser only checks a few points (start/end/mid) on shapes,
 * so erasing through the middle of a rectangle edge or circle perimeter
 * doesn't remove the stroke from data. The shape visually disappears
 * (pixels cleared) but reappears when redrawn (e.g. after moving).
 *
 * Fix: Proper geometric hit-testing for all stroke types:
 * - Rectangle: point-to-segment distance for all 4 edges + interior
 * - Circle: distance from center vs radius (perimeter + interior)
 * - Line: point-to-segment distance along full length
 * - Text: bounding box check
 * - Pen: existing point proximity check (already works)
 */

const ERASE_RADIUS = 10;

describe('Eraser hit-testing', () => {
  describe('Rectangle', () => {
    const rect: Stroke = {
      tool: 'rectangle',
      start: { x: 100, y: 100 },
      end: { x: 200, y: 200 },
      color: '#fff',
    };

    it('should erase when hitting top edge center', () => {
      const result = filterStrokesAfterErase([rect], 150, 100, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting bottom edge center', () => {
      const result = filterStrokesAfterErase([rect], 150, 200, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting left edge center', () => {
      const result = filterStrokesAfterErase([rect], 100, 150, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting right edge center', () => {
      const result = filterStrokesAfterErase([rect], 200, 150, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting inside the rectangle', () => {
      const result = filterStrokesAfterErase([rect], 150, 150, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting a corner', () => {
      const result = filterStrokesAfterErase([rect], 100, 100, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should NOT erase when far from the rectangle', () => {
      const result = filterStrokesAfterErase([rect], 400, 400, ERASE_RADIUS);
      expect(result).toHaveLength(1);
    });

    it('should work with rectangles drawn right-to-left', () => {
      const rtlRect: Stroke = {
        tool: 'rectangle',
        start: { x: 200, y: 200 },
        end: { x: 100, y: 100 },
        color: '#fff',
      };
      // Hit middle of top edge (y=100)
      const result = filterStrokesAfterErase([rtlRect], 150, 100, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });
  });

  describe('Circle', () => {
    // Circle: center=(200,200), edge=(250,200) → radius=50
    const circle: Stroke = {
      tool: 'circle',
      start: { x: 200, y: 200 },
      end: { x: 250, y: 200 },
      color: '#fff',
    };

    it('should erase when hitting the top of the perimeter', () => {
      const result = filterStrokesAfterErase([circle], 200, 150, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting the bottom of the perimeter', () => {
      const result = filterStrokesAfterErase([circle], 200, 250, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting the left of the perimeter', () => {
      const result = filterStrokesAfterErase([circle], 150, 200, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting the center', () => {
      const result = filterStrokesAfterErase([circle], 200, 200, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting the interior', () => {
      const result = filterStrokesAfterErase([circle], 220, 210, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should NOT erase when far outside the circle', () => {
      const result = filterStrokesAfterErase([circle], 400, 400, ERASE_RADIUS);
      expect(result).toHaveLength(1);
    });
  });

  describe('Line', () => {
    // Diagonal line from (100,100) to (300,300)
    const line: Stroke = {
      tool: 'line',
      start: { x: 100, y: 100 },
      end: { x: 300, y: 300 },
      color: '#fff',
    };

    it('should erase when hitting the midpoint', () => {
      const result = filterStrokesAfterErase([line], 200, 200, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting a point 25% along the line', () => {
      const result = filterStrokesAfterErase([line], 150, 150, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting a point 75% along the line', () => {
      const result = filterStrokesAfterErase([line], 250, 250, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting near (but not on) the line', () => {
      // Point slightly off the diagonal — within erase radius
      const result = filterStrokesAfterErase([line], 205, 195, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should NOT erase when far from the line', () => {
      const result = filterStrokesAfterErase([line], 50, 300, ERASE_RADIUS);
      expect(result).toHaveLength(1);
    });
  });

  describe('Text', () => {
    const textStroke: Stroke = {
      tool: 'text',
      text: 'Hello World',
      position: { x: 100, y: 200 },
      fontSize: 16,
      color: '#fff',
    };

    it('should erase when hitting the text area', () => {
      const result = filterStrokesAfterErase([textStroke], 120, 208, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when hitting near the text position', () => {
      const result = filterStrokesAfterErase([textStroke], 102, 202, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should NOT erase when far from the text', () => {
      const result = filterStrokesAfterErase([textStroke], 500, 500, ERASE_RADIUS);
      expect(result).toHaveLength(1);
    });
  });

  describe('Pen', () => {
    const pen: Stroke = {
      tool: 'pen',
      points: [
        { x: 50, y: 50 },
        { x: 100, y: 100 },
        { x: 150, y: 50 },
      ],
      color: '#fff',
      brushSize: 2,
    };

    it('should erase when hitting a pen point', () => {
      const result = filterStrokesAfterErase([pen], 100, 100, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when near a pen point', () => {
      const result = filterStrokesAfterErase([pen], 52, 52, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when near a line segment between points', () => {
      // Point (75, 75) is on the segment from (50,50) to (100,100), distance ~0
      const result = filterStrokesAfterErase([pen], 75, 75, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should erase when close to segment but not to any point', () => {
      // Pen with widely spaced points
      const widePen: Stroke = {
        tool: 'pen',
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
        color: '#fff',
        brushSize: 2,
      };
      // Point (100, 5) is 5px from the segment, within ERASE_RADIUS=10
      // but 100px from each endpoint
      const result = filterStrokesAfterErase([widePen], 100, 5, ERASE_RADIUS);
      expect(result).toHaveLength(0);
    });

    it('should NOT erase when far from pen points', () => {
      const result = filterStrokesAfterErase([pen], 300, 300, ERASE_RADIUS);
      expect(result).toHaveLength(1);
    });

    it('should handle single-point pen stroke', () => {
      const singlePoint: Stroke = {
        tool: 'pen',
        points: [{ x: 50, y: 50 }],
        color: '#fff',
        brushSize: 2,
      };
      const hit = filterStrokesAfterErase([singlePoint], 52, 52, ERASE_RADIUS);
      expect(hit).toHaveLength(0);
      const miss = filterStrokesAfterErase([singlePoint], 300, 300, ERASE_RADIUS);
      expect(miss).toHaveLength(1);
    });
  });

  describe('Multiple strokes', () => {
    it('should only remove the stroke that was hit', () => {
      const strokes: Stroke[] = [
        { tool: 'rectangle', start: { x: 100, y: 100 }, end: { x: 200, y: 200 }, color: '#fff' },
        { tool: 'rectangle', start: { x: 400, y: 400 }, end: { x: 500, y: 500 }, color: '#fff' },
      ];
      const result = filterStrokesAfterErase(strokes, 150, 150, ERASE_RADIUS);
      expect(result).toHaveLength(1);
      expect(result[0].start).toEqual({ x: 400, y: 400 });
    });
  });
});
