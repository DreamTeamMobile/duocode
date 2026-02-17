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
    } else if (stroke.start && stroke.end) {
      const startDist = Math.sqrt((stroke.start.x - x) ** 2 + (stroke.start.y - y) ** 2);
      const endDist = Math.sqrt((stroke.end.x - x) ** 2 + (stroke.end.y - y) ** 2);
      if (stroke.tool === 'line') {
        const midX = (stroke.start.x + stroke.end.x) / 2;
        const midY = (stroke.start.y + stroke.end.y) / 2;
        const midDist = Math.sqrt((midX - x) ** 2 + (midY - y) ** 2);
        return startDist >= eraseRadius && endDist >= eraseRadius && midDist >= eraseRadius;
      }
      return startDist >= eraseRadius && endDist >= eraseRadius;
    }
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
