import { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';
import type { Point, Stroke } from '../../services/canvas-logic';
import {
  getCSSScale,
  clientToLogical,
  clientToBuffer,
  getTouchDistance,
  getTouchMidpoint,
  applyCanvasTransform,
  reconcileCoordinates,
  filterStrokesAfterErase,
  getShapeCenter,
  findTextAtPosition,
  findStrokeAtPosition,
  getStrokeBounds,
  translateStroke,
  DEFAULT_FONT_SIZE,
  MIN_SCALE,
  MAX_SCALE,
} from '../../services/canvas-logic';
import CanvasToolbar from './CanvasToolbar';
import TextInputOverlay from './TextInputOverlay';
import DrawerLabels from './DrawerLabels';

interface TextOverlayState {
  visible: boolean;
  x: number;
  y: number;
  shapeIndex: number | null;
  editIndex: number | null;
  initialText: string;
}

interface MouseLikeEvent {
  clientX: number;
  clientY: number;
}

export default function DiagramCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Drawing state refs (mutable, not in React state for perf)
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const startPosRef = useRef<Point>({ x: 0, y: 0 });
  const panStartRef = useRef<Point>({ x: 0, y: 0 });

  // Touch gesture refs
  const isPanningRef = useRef(false);
  const pinchDistRef = useRef(0);
  const pinchScaleRef = useRef(1);
  const lastPanPointRef = useRef<Point>({ x: 0, y: 0 });

  // Selection state refs
  const selectedIndexRef = useRef<number | null>(null);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  // Text overlay state
  const textOverlayRef = useRef<TextOverlayState>({ visible: false, x: 0, y: 0, shapeIndex: null, editIndex: null, initialText: '' });

  // Store selectors — only subscribe to values that trigger re-renders
  const currentTool = useCanvasStore((s) => s.currentTool);
  const drawingStrokes = useCanvasStore((s) => s.drawingStrokes);
  const theme = useUIStore((s) => s.theme);

  // Non-reactive store access
  const getState = useCanvasStore.getState;

  // ── Canvas setup & resize ──────────────────────────────────────────

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    if (!bufferRef.current) {
      bufferRef.current = document.createElement('canvas');
    }
    bufferRef.current.width = canvas.width;
    bufferRef.current.height = canvas.height;

    ctxRef.current = canvas.getContext('2d');
    redrawAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    if (canvasRef.current?.parentElement) {
      ro.observe(canvasRef.current.parentElement);
    }
    return () => ro.disconnect();
  }, [resizeCanvas]);

  // ── Drawing helpers ────────────────────────────────────────────────

  const getCanvasBackground = useCallback(() => {
    const computedStyle = getComputedStyle(document.documentElement);
    return computedStyle.getPropertyValue('--bg-canvas').trim() || '#fff';
  }, []);

  const getMousePos = useCallback(
    (e: MouseLikeEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const cssScale = getCSSScale(canvas.width, canvas.height, rect.width, rect.height);
      const { zoom: z, panOffset: pan } = getState();
      return clientToLogical(e.clientX, e.clientY, rect, cssScale, pan.x, pan.y, z);
    },
    [getState],
  );

  const getBufferPos = useCallback((e: MouseLikeEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cssScale = getCSSScale(canvas.width, canvas.height, rect.width, rect.height);
    return clientToBuffer(e.clientX, e.clientY, rect, cssScale);
  }, []);

  // ── Rendering ──────────────────────────────────────────────────────

  const renderStrokes = useCallback(
    (ctx: CanvasRenderingContext2D, strokes: Stroke[]) => {
      strokes.forEach((stroke) => {
        if (stroke.tool === 'text' && stroke.text && stroke.position) {
          const fontSize = stroke.fontSize || DEFAULT_FONT_SIZE;
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = stroke.color || '#000';
          ctx.textBaseline = 'top';
          const lines = stroke.text.split('\n');
          const lineHeight = fontSize * 1.3;
          lines.forEach((line, i) => {
            ctx.fillText(line, stroke.position!.x, stroke.position!.y + i * lineHeight);
          });
        } else {
          ctx.beginPath();
          ctx.strokeStyle = stroke.color || '#000';
          ctx.lineWidth = stroke.brushSize || 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (stroke.tool === 'pen' && stroke.points && stroke.points.length > 0) {
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
              ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
          } else if (stroke.tool === 'line' && stroke.start && stroke.end) {
            ctx.moveTo(stroke.start.x, stroke.start.y);
            ctx.lineTo(stroke.end.x, stroke.end.y);
            ctx.stroke();
          } else if (stroke.tool === 'rectangle' && stroke.start && stroke.end) {
            const w = stroke.end.x - stroke.start.x;
            const h = stroke.end.y - stroke.start.y;
            ctx.strokeRect(stroke.start.x, stroke.start.y, w, h);
            if (stroke.text) {
              ctx.font = `${DEFAULT_FONT_SIZE}px sans-serif`;
              ctx.fillStyle = stroke.textColor || stroke.color || '#000';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(stroke.text, stroke.start.x + w / 2, stroke.start.y + h / 2);
              ctx.textAlign = 'left';
            }
          } else if (stroke.tool === 'circle' && stroke.start && stroke.end) {
            const radius = Math.sqrt(
              (stroke.end.x - stroke.start.x) ** 2 + (stroke.end.y - stroke.start.y) ** 2,
            );
            ctx.arc(stroke.start.x, stroke.start.y, radius, 0, 2 * Math.PI);
            ctx.stroke();
            if (stroke.text) {
              ctx.font = `${DEFAULT_FONT_SIZE}px sans-serif`;
              ctx.fillStyle = stroke.textColor || stroke.color || '#000';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(stroke.text, stroke.start.x, stroke.start.y);
              ctx.textAlign = 'left';
            }
          }
        }
      });
    },
    [],
  );

  const renderSelection = useCallback(
    (ctx: CanvasRenderingContext2D, strokes: Stroke[]) => {
      const idx = selectedIndexRef.current;
      if (idx === null || idx < 0 || idx >= strokes.length) return;

      const bounds = getStrokeBounds(strokes[idx]);
      const pad = 6;
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#007bff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        bounds.minX - pad,
        bounds.minY - pad,
        bounds.maxX - bounds.minX + pad * 2,
        bounds.maxY - bounds.minY + pad * 2,
      );
      ctx.setLineDash([]);
      ctx.restore();
    },
    [],
  );

  const saveToBuffer = useCallback(() => {
    const canvas = canvasRef.current;
    const buffer = bufferRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !buffer || !ctx) return;
    if (!canvas.width || !canvas.height) return;

    buffer.width = canvas.width;
    buffer.height = canvas.height;
    const bufferCtx = buffer.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    bufferCtx?.drawImage(canvas, 0, 0);
  }, []);

  const redrawViewport = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    if (!canvas || !ctx) return;
    if (!canvas.width || !canvas.height) return;

    const { zoom: z, panOffset: pan, drawingStrokes: strokes } = getState();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = getCanvasBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(z, 0, 0, z, pan.x, pan.y);

    if (buffer && strokes?.length > 0) {
      ctx.drawImage(buffer, 0, 0);
    }

    // Draw selection highlight on top (not baked into buffer)
    renderSelection(ctx, strokes);
  }, [getState, getCanvasBackground, renderSelection]);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    if (!canvas.width || !canvas.height) return;

    const { drawingStrokes: strokes } = getState();

    // Draw strokes at identity (logical coordinates) to the buffer
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getCanvasBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    renderStrokes(ctx, strokes);
    saveToBuffer();
    redrawViewport();
  }, [getState, getCanvasBackground, renderStrokes, saveToBuffer, redrawViewport]);

  // Redraw when strokes or theme change
  useEffect(() => {
    // Use requestAnimationFrame to ensure CSS variables are applied before reading
    const id = requestAnimationFrame(() => redrawAll());
    return () => cancelAnimationFrame(id);
  }, [drawingStrokes, theme, redrawAll]);

  // Clear selection when switching away from select tool
  useEffect(() => {
    if (currentTool !== 'select') {
      selectedIndexRef.current = null;
      isDraggingRef.current = false;
    }
  }, [currentTool]);

  // ── Text overlay state (must be before mouse handlers that reference it) ──

  const [overlayKey, setOverlayKey] = useState(0);
  const forceOverlayUpdate = useCallback(() => setOverlayKey((k) => k + 1), []);

  // ── Text overlay handlers (before mouse handlers that reference them) ──

  const handleTextCommit = useCallback(
    (text: string) => {
      if (!text.trim()) {
        textOverlayRef.current = { visible: false, x: 0, y: 0, shapeIndex: null, editIndex: null, initialText: '' };
        forceOverlayUpdate();
        return;
      }

      const { shapeIndex, editIndex } = textOverlayRef.current;
      if (shapeIndex !== null) {
        // Add/update text on existing shape
        getState().updateStrokeAt(shapeIndex, { text });
      } else if (editIndex !== null) {
        // Edit existing text stroke in-place
        getState().updateStrokeAt(editIndex, { text });
      } else {
        // Create standalone text stroke
        const { strokeColor: color } = getState();
        const stroke: Stroke = {
          tool: 'text',
          text,
          color,
          position: { x: textOverlayRef.current.x, y: textOverlayRef.current.y },
          fontSize: DEFAULT_FONT_SIZE,
        };
        getState().addStroke(stroke);
      }
      textOverlayRef.current = { visible: false, x: 0, y: 0, shapeIndex: null, editIndex: null, initialText: '' };
      forceOverlayUpdate();
    },
    [getState, forceOverlayUpdate],
  );

  const handleTextDismiss = useCallback(() => {
    textOverlayRef.current = { visible: false, x: 0, y: 0, shapeIndex: null, editIndex: null, initialText: '' };
    forceOverlayUpdate();
  }, [forceOverlayUpdate]);

  // ── Mouse event handlers ───────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: MouseLikeEvent) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      const { currentTool: tool, strokeColor: color, strokeWidth: width } = getState();

      isDrawingRef.current = true;
      const pos = getMousePos(e);
      startPosRef.current = pos;

      if (tool === 'select') {
        isDrawingRef.current = false;
        const strokes = getState().drawingStrokes;
        const hitIdx = findStrokeAtPosition(strokes, pos.x, pos.y);
        if (hitIdx !== null) {
          selectedIndexRef.current = hitIdx;
          dragStartRef.current = pos;
          isDraggingRef.current = true;
        } else {
          selectedIndexRef.current = null;
          isDraggingRef.current = false;
        }
        redrawViewport();
        return;
      }

      if (tool === 'pan') {
        const bufPos = getBufferPos(e);
        panStartRef.current = bufPos;
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grabbing';
        }
        return;
      }

      if (tool === 'text') {
        isDrawingRef.current = false;

        // If a text overlay is already visible, commit its value before opening a new one.
        if (textOverlayRef.current.visible) {
          const input = document.getElementById('canvasTextInput') as HTMLTextAreaElement | null;
          const value = input?.value ?? '';
          handleTextCommit(value);
        }

        // Check if clicking on existing text stroke to edit it
        const strokes = getState().drawingStrokes;
        const textIndex = findTextAtPosition(strokes, pos.x, pos.y);
        if (textIndex !== null) {
          const stroke = strokes[textIndex];
          textOverlayRef.current = {
            visible: true,
            x: stroke.position!.x,
            y: stroke.position!.y,
            shapeIndex: null,
            editIndex: textIndex,
            initialText: stroke.text || '',
          };
        } else {
          textOverlayRef.current = { visible: true, x: pos.x, y: pos.y, shapeIndex: null, editIndex: null, initialText: '' };
        }
        forceOverlayUpdate();
        return;
      }

      if (tool === 'eraser') {
        // Apply transform before drawing the eraser path
        const { zoom: z, panOffset: pan } = getState();
        applyCanvasTransform(ctx, z, pan.x, pan.y);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.strokeStyle = getCanvasBackground();
        ctx.lineWidth = width * 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        return;
      }

      // Apply transform for drawing
      const { zoom: z, panOffset: pan } = getState();
      applyCanvasTransform(ctx, z, pan.x, pan.y);

      if (tool === 'pen') {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        currentStrokeRef.current = {
          tool: 'pen',
          color,
          brushSize: width,
          points: [{ x: pos.x, y: pos.y }],
        };
      } else {
        currentStrokeRef.current = {
          tool,
          color,
          brushSize: width,
          start: { x: pos.x, y: pos.y },
          end: { x: pos.x, y: pos.y },
        };
      }
    },
    [getState, getMousePos, getBufferPos, getCanvasBackground, forceOverlayUpdate, handleTextCommit, redrawViewport],
  );

  const handleMouseMove = useCallback(
    (e: MouseLikeEvent) => {
      // Handle select tool drag (isDragging is separate from isDrawing)
      if (isDraggingRef.current && selectedIndexRef.current !== null) {
        const pos = getMousePos(e);
        const dx = pos.x - dragStartRef.current.x;
        const dy = pos.y - dragStartRef.current.y;
        if (dx === 0 && dy === 0) return;

        const strokes = getState().drawingStrokes;
        const idx = selectedIndexRef.current;
        if (idx >= 0 && idx < strokes.length) {
          const moved = translateStroke(strokes[idx], dx, dy);
          getState().updateStrokeAt(idx, moved);
          dragStartRef.current = pos;
        }
        return;
      }

      if (!isDrawingRef.current) return;
      const ctx = ctxRef.current;
      if (!ctx) return;

      const { currentTool: tool, strokeColor: color, strokeWidth: width } = getState();

      if (tool === 'pan') {
        const bufPos = getBufferPos(e);
        const dx = bufPos.x - panStartRef.current.x;
        const dy = bufPos.y - panStartRef.current.y;
        const { panOffset: pan } = getState();
        getState().setPan({ x: pan.x + dx, y: pan.y + dy });
        panStartRef.current = bufPos;
        redrawViewport();
        return;
      }

      const pos = getMousePos(e);

      if (tool === 'eraser') {
        const eraseRadius = width * 3;
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = getCanvasBackground();
        ctx.lineWidth = eraseRadius * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);

        const { drawingStrokes: strokes } = getState();
        const remaining = filterStrokesAfterErase(strokes, pos.x, pos.y, eraseRadius);
        if (remaining.length !== strokes.length) {
          getState().setStrokes(remaining);
        }
        return;
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = width;

      if (tool === 'pen') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        if (currentStrokeRef.current?.points) {
          currentStrokeRef.current.points.push({ x: pos.x, y: pos.y });
        }
      } else {
        // Shapes: vector redraw + preview
        redrawAll();
        const { zoom: z, panOffset: pan } = getState();
        applyCanvasTransform(ctx, z, pan.x, pan.y);
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const start = startPosRef.current;
        if (tool === 'line') {
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        } else if (tool === 'rectangle') {
          ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
        } else if (tool === 'circle') {
          const radius = Math.sqrt((pos.x - start.x) ** 2 + (pos.y - start.y) ** 2);
          ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }

        if (currentStrokeRef.current) {
          currentStrokeRef.current.end = { x: pos.x, y: pos.y };
        }
      }
    },
    [getState, getMousePos, getBufferPos, getCanvasBackground, redrawAll, redrawViewport],
  );

  const handleMouseUp = useCallback(() => {
    // Handle select tool drag end
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      // Selection stays active so user can see what they moved
      return;
    }

    if (!isDrawingRef.current) return;
    const ctx = ctxRef.current;
    const { currentTool: tool } = getState();

    if (tool === 'pan') {
      isDrawingRef.current = false;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grab';
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { panOffset: pan, zoom: z } = getState();
      const result = reconcileCoordinates(pan.x, pan.y, z, canvas.width, canvas.height);
      getState().setPan({ x: result.panX, y: result.panY });
      getState().setZoom(result.scale);
      return;
    }

    if (tool === 'eraser') {
      isDrawingRef.current = false;
      // Redraw cleanly from remaining strokes so eraser trail disappears
      redrawAll();
      return;
    }

    if (tool === 'pen' && ctx) {
      ctx.closePath();
    }

    if (currentStrokeRef.current) {
      getState().addStroke(currentStrokeRef.current);
      currentStrokeRef.current = null;
    }

    isDrawingRef.current = false;
    saveToBuffer();
  }, [getState, saveToBuffer, redrawAll]);

  // ── Wheel zoom ─────────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const cssScale = getCSSScale(canvas.width, canvas.height, rect.width, rect.height);
      const mouseX = (e.clientX - rect.left) * cssScale.x;
      const mouseY = (e.clientY - rect.top) * cssScale.y;

      const { zoom: z, panOffset: pan } = getState();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(MAX_SCALE, Math.max(MIN_SCALE, z * zoomFactor));

      if (newZoom !== z) {
        const scaleChange = newZoom / z;
        const newPanX = mouseX - (mouseX - pan.x) * scaleChange;
        const newPanY = mouseY - (mouseY - pan.y) * scaleChange;
        getState().setZoom(newZoom);
        getState().setPan({ x: newPanX, y: newPanY });
        redrawViewport();
      }
    },
    [getState, redrawViewport],
  );

  // ── Touch handlers ─────────────────────────────────────────────────

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        isPanningRef.current = true;
        isDrawingRef.current = false;
        pinchDistRef.current = getTouchDistance(e.touches[0], e.touches[1]);
        pinchScaleRef.current = getState().zoom;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mid = getTouchMidpoint(e.touches[0], e.touches[1]);
        lastPanPointRef.current = { x: mid.x - rect.left, y: mid.y - rect.top };
        saveToBuffer();
      } else if (e.touches.length === 1 && !isPanningRef.current) {
        handleMouseDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      }
    },
    [getState, handleMouseDown, saveToBuffer],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.touches.length === 2 && isPanningRef.current) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
        const newZoom = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, pinchScaleRef.current * (currentDist / pinchDistRef.current)),
        );

        const mid = getTouchMidpoint(e.touches[0], e.touches[1]);
        const currentPoint = { x: mid.x - rect.left, y: mid.y - rect.top };
        const dx = currentPoint.x - lastPanPointRef.current.x;
        const dy = currentPoint.y - lastPanPointRef.current.y;
        lastPanPointRef.current = currentPoint;

        const { panOffset: pan } = getState();
        getState().setZoom(newZoom);
        getState().setPan({ x: pan.x + dx, y: pan.y + dy });
        redrawViewport();
      } else if (e.touches.length === 1 && !isPanningRef.current) {
        handleMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      }
    },
    [getState, handleMouseMove, redrawViewport],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (isPanningRef.current) {
        if (e.touches.length < 2) {
          isPanningRef.current = false;
        }
        return;
      }
      handleMouseUp();
    },
    [handleMouseUp],
  );

  // Attach wheel event with passive: false
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Convert logical position to screen position for overlay.
  // Subtract the overlay's CSS padding+border so the text inside the input
  // aligns exactly with where ctx.fillText will render on the canvas.
  const OVERLAY_OFFSET_LEFT = 10; // padding-left(8) + border(2)
  const OVERLAY_OFFSET_TOP = 6;   // padding-top(4) + border(2)

  const getOverlayScreenPos = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { left: 0, top: 0 };
    const rect = canvas.getBoundingClientRect();
    const { zoom: z, panOffset: pan } = getState();

    const bufferX = textOverlayRef.current.x * z + pan.x;
    const bufferY = textOverlayRef.current.y * z + pan.y;

    const cssScaleX = rect.width / canvas.width;
    const cssScaleY = rect.height / canvas.height;

    return {
      left: bufferX * cssScaleX - OVERLAY_OFFSET_LEFT,
      top: bufferY * cssScaleY - OVERLAY_OFFSET_TOP,
    };
  }, [getState]);

  // ── Cursor style ───────────────────────────────────────────────────

  const getCursorStyle = useCallback((): string => {
    switch (currentTool) {
      case 'select':
        return 'default';
      case 'pan':
        return 'grab';
      case 'eraser':
        return 'cell';
      case 'text':
        return 'text';
      default:
        return 'crosshair';
    }
  }, [currentTool]);

  // ── Double-click for text on shapes ────────────────────────────────

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);
      // Check if double-click is inside an existing shape
      const strokes = getState().drawingStrokes;
      let shapeIndex = null;
      for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        if (s.tool === 'rectangle' && s.start && s.end) {
          const minX = Math.min(s.start.x, s.end.x);
          const maxX = Math.max(s.start.x, s.end.x);
          const minY = Math.min(s.start.y, s.end.y);
          const maxY = Math.max(s.start.y, s.end.y);
          if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) {
            shapeIndex = i;
            break;
          }
        } else if (s.tool === 'circle' && s.start && s.end) {
          const radius = Math.sqrt(
            (s.end.x - s.start.x) ** 2 + (s.end.y - s.start.y) ** 2,
          );
          const dx = pos.x - s.start.x;
          const dy = pos.y - s.start.y;
          if (Math.sqrt(dx * dx + dy * dy) <= radius) {
            shapeIndex = i;
            break;
          }
        }
      }
      if (shapeIndex !== null) {
        const shape = strokes[shapeIndex];
        const center = getShapeCenter(shape);
        textOverlayRef.current = { visible: true, x: center.x, y: center.y, shapeIndex, editIndex: null, initialText: shape.text || '' };
      } else {
        textOverlayRef.current = { visible: true, x: pos.x, y: pos.y, shapeIndex: null, editIndex: null, initialText: '' };
      }
      forceOverlayUpdate();
    },
    [getMousePos, getState, forceOverlayUpdate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <CanvasToolbar />
      <div id="diagramArea-wrapper" style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          id="diagramArea"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: getCursorStyle() }}
        />
        {textOverlayRef.current.visible && (
          <TextInputOverlay
            key={overlayKey}
            position={getOverlayScreenPos()}
            onCommit={handleTextCommit}
            onDismiss={handleTextDismiss}
            initialText={textOverlayRef.current.initialText}
          />
        )}
        <DrawerLabels canvasRef={canvasRef} />
      </div>
    </div>
  );
}
