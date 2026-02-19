import { describe, it, expect, beforeEach } from 'vitest';
import { getLeadingWhitespace } from '../../src/services/code-editor-logic';
import { filterStrokesAfterErase } from '../../src/services/canvas-logic';
import type { Stroke } from '../../src/services/canvas-logic';

/**
 * Tests for recently introduced fixes:
 * 1. Pen eraser now checks line segments between points
 * 2. getLeadingWhitespace for auto-indent edge cases
 */

describe('Pen eraser segment-based hit testing', () => {
  const curvedPen: Stroke = {
    tool: 'pen',
    points: [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 50 },
      { x: 200, y: 200 },
    ],
    color: '#fff',
    brushSize: 2,
  };

  it('should erase when eraser passes between two points on a segment', () => {
    // Point (25, 50) is on the segment from (0,0) to (50,100)
    const result = filterStrokesAfterErase([curvedPen], 25, 50, 10);
    expect(result).toHaveLength(0);
  });

  it('should erase when near middle of a long segment', () => {
    // Point (150, 125) is near the segment from (100,50) to (200,200)
    const result = filterStrokesAfterErase([curvedPen], 150, 125, 10);
    expect(result).toHaveLength(0);
  });

  it('should NOT erase when far from all segments', () => {
    const result = filterStrokesAfterErase([curvedPen], 500, 500, 10);
    expect(result).toHaveLength(1);
  });

  it('should erase entire stroke when any segment is hit', () => {
    // Hit just the first segment — entire stroke should be removed
    const result = filterStrokesAfterErase([curvedPen], 10, 20, 10);
    expect(result).toHaveLength(0);
  });

  it('should handle pen stroke with only 2 points', () => {
    const twoPointPen: Stroke = {
      tool: 'pen',
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      color: '#fff',
      brushSize: 2,
    };
    // Near the midpoint of the segment
    const result = filterStrokesAfterErase([twoPointPen], 50, 50, 10);
    expect(result).toHaveLength(0);
  });
});

describe('Auto-indent edge cases', () => {
  it('should handle cursor at position 0', () => {
    expect(getLeadingWhitespace('    hello', 0)).toBe('    ');
  });

  it('should handle newline right before cursor', () => {
    const text = 'line1\n    line2';
    // Cursor right after the newline
    expect(getLeadingWhitespace(text, 6)).toBe('    ');
  });

  it('should return empty for line with no leading whitespace', () => {
    expect(getLeadingWhitespace('hello', 3)).toBe('');
  });
});
