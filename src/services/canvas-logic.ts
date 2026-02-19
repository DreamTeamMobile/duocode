/**
 * Canvas Logic Service
 *
 * Pure, framework-agnostic canvas helpers extracted from app.js.
 * Covers coordinate transforms, drawing helpers, shape hit-testing,
 * undo/redo history management, and stroke filtering.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface BoundingRect {
  left: number;
  top: number;
}

export interface TouchPoint {
  clientX: number;
  clientY: number;
}

export type CanvasTool = 'pen' | 'line' | 'rectangle' | 'circle' | 'eraser' | 'text' | 'select' | 'pan';

export interface Stroke {
  tool: CanvasTool | string;
  color?: string;
  width?: number;
  brushSize?: number;
  points?: Point[];
  start?: Point;
  end?: Point;
  position?: Point;
  text?: string;
  textColor?: string;
  fontSize?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;
export const MAX_HISTORY_SIZE = 10;
export const DEFAULT_FONT_SIZE = 16;

// ── Coordinate Transform Functions ──────────────────────────────────────────

export function getCSSScale(
  canvasWidth: number,
  canvasHeight: number,
  rectWidth: number,
  rectHeight: number
): Point {
  return {
    x: canvasWidth / rectWidth,
    y: canvasHeight / rectHeight,
  };
}

export function clientToLogical(
  clientX: number,
  clientY: number,
  rect: BoundingRect,
  cssScale: Point,
  panX: number,
  panY: number,
  scale: number
): Point {
  const bufferX = (clientX - rect.left) * cssScale.x;
  const bufferY = (clientY - rect.top) * cssScale.y;
  return {
    x: (bufferX - panX) / scale,
    y: (bufferY - panY) / scale,
  };
}

export function clientToBuffer(
  clientX: number,
  clientY: number,
  rect: BoundingRect,
  cssScale: Point
): Point {
  return {
    x: (clientX - rect.left) * cssScale.x,
    y: (clientY - rect.top) * cssScale.y,
  };
}

export function getTouchDistance(t0: TouchPoint, t1: TouchPoint): number {
  const dx = t0.clientX - t1.clientX;
  const dy = t0.clientY - t1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getTouchMidpoint(t0: TouchPoint, t1: TouchPoint): Point {
  return {
    x: (t0.clientX + t1.clientX) / 2,
    y: (t0.clientY + t1.clientY) / 2,
  };
}

export function applyCanvasTransform(
  ctx: CanvasRenderingContext2D,
  scale: number,
  panX: number,
  panY: number
): void {
  ctx.setTransform(scale, 0, 0, scale, panX, panY);
}

export function resetCanvasTransform(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export interface ReconcileResult {
  panX: number;
  panY: number;
  scale: number;
}

export function reconcileCoordinates(
  panX: number,
  panY: number,
  scale: number,
  canvasWidth: number,
  canvasHeight: number,
  minScale: number = MIN_SCALE,
  maxScale: number = MAX_SCALE
): ReconcileResult {
  const maxPan = Math.max(canvasWidth, canvasHeight) * 2;
  return {
    panX: Math.max(-maxPan, Math.min(maxPan, panX)),
    panY: Math.max(-maxPan, Math.min(maxPan, panY)),
    scale: Math.max(minScale, Math.min(maxScale, scale)),
  };
}

// ── Drawing / Shape Helpers ─────────────────────────────────────────────────

/** Distance from point (px,py) to the line segment (ax,ay)→(bx,by). */
function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

export function filterStrokesAfterErase(
  strokes: Stroke[],
  x: number,
  y: number,
  eraseRadius: number
): Stroke[] {
  return strokes.filter(stroke => {
    if (stroke.tool === 'pen' && stroke.points) {
      return !stroke.points.some(point => {
        const dist = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
        return dist < eraseRadius;
      });
    }

    if (stroke.tool === 'text' && stroke.position) {
      const bounds = getStrokeBounds(stroke);
      // Hit if within or near the bounding box
      return !(
        x >= bounds.minX - eraseRadius && x <= bounds.maxX + eraseRadius &&
        y >= bounds.minY - eraseRadius && y <= bounds.maxY + eraseRadius
      );
    }

    if (stroke.tool === 'circle' && stroke.start && stroke.end) {
      const radius = Math.sqrt(
        (stroke.end.x - stroke.start.x) ** 2 + (stroke.end.y - stroke.start.y) ** 2
      );
      const dist = Math.sqrt((x - stroke.start.x) ** 2 + (y - stroke.start.y) ** 2);
      // Hit if within the circle or near its perimeter
      return dist > radius + eraseRadius;
    }

    if (stroke.tool === 'rectangle' && stroke.start && stroke.end) {
      const minX = Math.min(stroke.start.x, stroke.end.x);
      const maxX = Math.max(stroke.start.x, stroke.end.x);
      const minY = Math.min(stroke.start.y, stroke.end.y);
      const maxY = Math.max(stroke.start.y, stroke.end.y);

      // Hit if inside the rectangle
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) return false;

      // Hit if near any of the 4 edges
      const topDist = pointToSegmentDist(x, y, minX, minY, maxX, minY);
      const bottomDist = pointToSegmentDist(x, y, minX, maxY, maxX, maxY);
      const leftDist = pointToSegmentDist(x, y, minX, minY, minX, maxY);
      const rightDist = pointToSegmentDist(x, y, maxX, minY, maxX, maxY);

      return Math.min(topDist, bottomDist, leftDist, rightDist) >= eraseRadius;
    }

    if (stroke.tool === 'line' && stroke.start && stroke.end) {
      const dist = pointToSegmentDist(x, y, stroke.start.x, stroke.start.y, stroke.end.x, stroke.end.y);
      return dist >= eraseRadius;
    }

    // Unknown stroke type — don't erase
    return true;
  });
}

export function findShapeAtPosition(strokes: Stroke[], x: number, y: number): number | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];

    if (stroke.tool === 'rectangle' && stroke.start && stroke.end) {
      const minX = Math.min(stroke.start.x, stroke.end.x);
      const maxX = Math.max(stroke.start.x, stroke.end.x);
      const minY = Math.min(stroke.start.y, stroke.end.y);
      const maxY = Math.max(stroke.start.y, stroke.end.y);
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        return i;
      }
    } else if (stroke.tool === 'circle' && stroke.start && stroke.end) {
      const radius = Math.sqrt(
        (stroke.end.x - stroke.start.x) ** 2 +
        (stroke.end.y - stroke.start.y) ** 2
      );
      const distance = Math.sqrt(
        (x - stroke.start.x) ** 2 +
        (y - stroke.start.y) ** 2
      );
      if (distance <= radius) {
        return i;
      }
    }
  }
  return null;
}

export function getShapeCenter(stroke: Stroke): Point {
  if (stroke.tool === 'rectangle' && stroke.start && stroke.end) {
    return {
      x: (stroke.start.x + stroke.end.x) / 2,
      y: (stroke.start.y + stroke.end.y) / 2,
    };
  } else if (stroke.tool === 'circle' && stroke.start) {
    return { x: stroke.start.x, y: stroke.start.y };
  }
  return stroke.position || { x: 0, y: 0 };
}

// ── Universal Hit-Testing & Selection ────────────────────────────────────────

export interface StrokeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Returns the bounding box for any stroke type.
 */
export function getStrokeBounds(stroke: Stroke): StrokeBounds {
  if (stroke.tool === 'pen' && stroke.points && stroke.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  if (stroke.tool === 'circle' && stroke.start && stroke.end) {
    const radius = Math.sqrt(
      (stroke.end.x - stroke.start.x) ** 2 + (stroke.end.y - stroke.start.y) ** 2
    );
    return {
      minX: stroke.start.x - radius,
      minY: stroke.start.y - radius,
      maxX: stroke.start.x + radius,
      maxY: stroke.start.y + radius,
    };
  }

  if (stroke.tool === 'text' && stroke.position) {
    const fontSize = stroke.fontSize || DEFAULT_FONT_SIZE;
    const lines = (stroke.text || '').split('\n');
    const lineHeight = fontSize * 1.3;
    const maxLineLen = Math.max(...lines.map(l => l.length), 1);
    const approxWidth = Math.max(maxLineLen * fontSize * 0.6, 20);
    const approxHeight = lines.length * lineHeight;
    return {
      minX: stroke.position.x,
      minY: stroke.position.y,
      maxX: stroke.position.x + approxWidth,
      maxY: stroke.position.y + approxHeight,
    };
  }

  // line, rectangle, or any start/end shape
  if (stroke.start && stroke.end) {
    return {
      minX: Math.min(stroke.start.x, stroke.end.x),
      minY: Math.min(stroke.start.y, stroke.end.y),
      maxX: Math.max(stroke.start.x, stroke.end.x),
      maxY: Math.max(stroke.start.y, stroke.end.y),
    };
  }

  return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

/**
 * Universal hit-test for all stroke types.
 * Returns the index of the topmost stroke at (x,y), or null.
 */
export function findStrokeAtPosition(strokes: Stroke[], x: number, y: number): number | null {
  const HIT_TOLERANCE = 8;

  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];

    if (stroke.tool === 'rectangle' && stroke.start && stroke.end) {
      const minX = Math.min(stroke.start.x, stroke.end.x);
      const maxX = Math.max(stroke.start.x, stroke.end.x);
      const minY = Math.min(stroke.start.y, stroke.end.y);
      const maxY = Math.max(stroke.start.y, stroke.end.y);
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) return i;
    } else if (stroke.tool === 'circle' && stroke.start && stroke.end) {
      const radius = Math.sqrt(
        (stroke.end.x - stroke.start.x) ** 2 + (stroke.end.y - stroke.start.y) ** 2
      );
      const dist = Math.sqrt((x - stroke.start.x) ** 2 + (y - stroke.start.y) ** 2);
      if (dist <= radius) return i;
    } else if (stroke.tool === 'text' && stroke.text && stroke.position) {
      const bounds = getStrokeBounds(stroke);
      if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) return i;
    } else if (stroke.tool === 'pen' && stroke.points && stroke.points.length > 0) {
      for (const p of stroke.points) {
        if (Math.abs(x - p.x) <= HIT_TOLERANCE && Math.abs(y - p.y) <= HIT_TOLERANCE) return i;
      }
    } else if (stroke.tool === 'line' && stroke.start && stroke.end) {
      // Point-to-line-segment distance
      const dx = stroke.end.x - stroke.start.x;
      const dy = stroke.end.y - stroke.start.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) {
        if (Math.abs(x - stroke.start.x) <= HIT_TOLERANCE && Math.abs(y - stroke.start.y) <= HIT_TOLERANCE) return i;
      } else {
        let t = ((x - stroke.start.x) * dx + (y - stroke.start.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = stroke.start.x + t * dx;
        const projY = stroke.start.y + t * dy;
        const dist = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
        if (dist <= HIT_TOLERANCE) return i;
      }
    }
  }
  return null;
}

/**
 * Returns a new stroke with all coordinates shifted by (dx, dy).
 */
export function translateStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  const result = { ...stroke };

  if (result.start) {
    result.start = { x: result.start.x + dx, y: result.start.y + dy };
  }
  if (result.end) {
    result.end = { x: result.end.x + dx, y: result.end.y + dy };
  }
  if (result.position) {
    result.position = { x: result.position.x + dx, y: result.position.y + dy };
  }
  if (result.points) {
    result.points = result.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
  }

  return result;
}

// ── Text Hit-Testing ────────────────────────────────────────────────────────

/**
 * Find a text stroke at the given position.
 * Uses an approximate bounding box based on character count and font size.
 * Returns the index of the topmost matching text stroke, or null.
 */
export function findTextAtPosition(
  strokes: Stroke[],
  x: number,
  y: number,
  defaultFontSize: number = DEFAULT_FONT_SIZE
): number | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (stroke.tool !== 'text' || !stroke.text || !stroke.position) continue;

    const fontSize = stroke.fontSize || defaultFontSize;
    const lines = stroke.text.split('\n');
    const lineHeight = fontSize * 1.3;
    // Approximate width: ~0.6em per character, use widest line
    const maxLineLen = Math.max(...lines.map(l => l.length));
    const approxWidth = Math.max(maxLineLen * fontSize * 0.6, 20);
    const approxHeight = lines.length * lineHeight;

    const minX = stroke.position.x;
    const minY = stroke.position.y;
    const maxX = minX + approxWidth;
    const maxY = minY + approxHeight;

    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      return i;
    }
  }
  return null;
}

// ── Undo / Redo History ─────────────────────────────────────────────────────

export interface UndoRedoResult {
  strokes: Stroke[];
}

/**
 * Manages an undo/redo history stack for drawing strokes.
 * Pure state management — no DOM or canvas rendering side-effects.
 */
export class CanvasHistoryManager {
  private maxSize: number;
  undoStack: Stroke[][];
  redoStack: Stroke[][];

  constructor(maxSize: number = MAX_HISTORY_SIZE) {
    this.maxSize = maxSize;
    this.undoStack = [];
    this.redoStack = [];
  }

  save(currentStrokes: Stroke[]): void {
    this.undoStack.push(JSON.parse(JSON.stringify(currentStrokes)));
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(currentStrokes: Stroke[]): UndoRedoResult | null {
    if (this.undoStack.length === 0) return null;
    this.redoStack.push(JSON.parse(JSON.stringify(currentStrokes)));
    return { strokes: this.undoStack.pop()! };
  }

  redo(currentStrokes: Stroke[]): UndoRedoResult | null {
    if (this.redoStack.length === 0) return null;
    this.undoStack.push(JSON.parse(JSON.stringify(currentStrokes)));
    return { strokes: this.redoStack.pop()! };
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// ── Export Helpers ───────────────────────────────────────────────────────────

export function containsNonASCII(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

export function wrapText(
  text: string,
  maxWidth: number,
  measureWidth: (text: string) => number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (measureWidth(testLine) > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}
