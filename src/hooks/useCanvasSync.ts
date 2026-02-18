import { useCallback, useEffect, useRef } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import type { DataChannelMessage } from '../services/connection-manager';
import type { Stroke, Point } from '../services/canvas-logic';

interface UseCanvasSyncOptions {
  sendMessage?: (data: DataChannelMessage) => boolean;
}

interface UseCanvasSyncReturn {
  handleMessage: (message: DataChannelMessage) => void;
  sendStroke: (stroke: Stroke) => void;
  sendCanvasView: (zoom: number, panOffset: Point) => void;
  sendCanvasClear: () => void;
}

/**
 * useCanvasSync — sends/receives canvas drawing actions over a data channel.
 *
 * - Automatically sends new strokes to peers when added locally.
 * - Provides `sendCanvasView` / `sendCanvasClear` helpers
 *   that broadcast local actions to peers.
 * - Handles incoming `canvas`, `canvas-view`, `canvas-clear`, and
 *   `canvas-sync` messages by updating the canvas store.
 */
export function useCanvasSync({ sendMessage }: UseCanvasSyncOptions = {}): UseCanvasSyncReturn {
  const setStrokes = useCanvasStore((s) => s.setStrokes);
  const addStroke = useCanvasStore((s) => s.addStroke);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setPan = useCanvasStore((s) => s.setPan);
  const clear = useCanvasStore((s) => s.clear);
  const updateRemoteDrawer = useCanvasStore((s) => s.updateRemoteDrawer);
  const drawingStrokes = useCanvasStore((s) => s.drawingStrokes);
  const strokeVersion = useCanvasStore((s) => s.strokeVersion);

  const isRemoteUpdateRef = useRef(false);
  const previousStrokesLenRef = useRef(0);
  const previousVersionRef = useRef(0);

  // Auto-send new strokes when added locally
  useEffect(() => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      previousStrokesLenRef.current = drawingStrokes.length;
      return;
    }

    const prevLen = previousStrokesLenRef.current;
    const currLen = drawingStrokes.length;

    if (currLen > prevLen && sendMessage) {
      // New stroke(s) added — send incrementally
      for (let i = prevLen; i < currLen; i++) {
        sendMessage({
          type: 'canvas',
          action: 'stroke',
          stroke: drawingStrokes[i],
        });
      }
    } else if (currLen !== prevLen && sendMessage) {
      // Strokes removed (undo/clear) — send full sync
      sendMessage({
        type: 'canvas-sync',
        strokes: drawingStrokes,
      });
    }

    previousStrokesLenRef.current = currLen;
  }, [drawingStrokes, sendMessage]);

  // Detect in-place stroke updates (same length, version bumped)
  useEffect(() => {
    if (isRemoteUpdateRef.current) {
      previousVersionRef.current = strokeVersion;
      return;
    }

    if (strokeVersion > previousVersionRef.current && sendMessage) {
      sendMessage({
        type: 'canvas-sync',
        strokes: drawingStrokes,
      });
    }
    previousVersionRef.current = strokeVersion;
  }, [strokeVersion, drawingStrokes, sendMessage]);

  const sendStroke = useCallback((stroke: Stroke) => {
    if (sendMessage) {
      sendMessage({
        type: 'canvas',
        action: 'stroke',
        stroke,
      });
    }
  }, [sendMessage]);

  const sendCanvasView = useCallback((zoom: number, panOffset: Point) => {
    if (sendMessage) {
      sendMessage({
        type: 'canvas-view',
        zoom,
        panOffset,
      });
    }
  }, [sendMessage]);

  const sendCanvasClear = useCallback(() => {
    if (sendMessage) {
      sendMessage({ type: 'canvas-clear' });
    }
  }, [sendMessage]);

  const handleMessage = useCallback((message: DataChannelMessage) => {
    switch (message.type) {
      case 'canvas': {
        if (message.action === 'stroke' && 'stroke' in message) {
          isRemoteUpdateRef.current = true;
          addStroke(message.stroke);
        } else if (message.action === 'drawing' && 'peerId' in message) {
          updateRemoteDrawer(message.peerId, message.data as Record<string, unknown>);
        }
        break;
      }

      case 'canvas-view': {
        if (message.zoom != null) setZoom(message.zoom);
        if (message.panOffset) setPan(message.panOffset);
        break;
      }

      case 'canvas-clear': {
        isRemoteUpdateRef.current = true;
        clear();
        break;
      }

      case 'canvas-sync': {
        // Full canvas state from host (late joiner sync)
        if (message.strokes) {
          isRemoteUpdateRef.current = true;
          setStrokes(message.strokes);
        }
        if (message.zoom != null) setZoom(message.zoom);
        if (message.panOffset) setPan(message.panOffset);
        break;
      }

      case 'state-request': {
        // Peer requesting full state — send canvas data
        const state = useCanvasStore.getState();
        if (sendMessage) {
          sendMessage({
            type: 'canvas-sync',
            strokes: state.drawingStrokes,
            zoom: state.zoom,
            panOffset: state.panOffset,
          });
        }
        break;
      }

      default:
        break;
    }
  }, [addStroke, clear, sendMessage, setPan, setStrokes, setZoom, updateRemoteDrawer]);

  return { handleMessage, sendStroke, sendCanvasView, sendCanvasClear };
}
