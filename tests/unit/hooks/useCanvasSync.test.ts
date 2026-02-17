import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasSync } from '../../../src/hooks/useCanvasSync.js';
import { useCanvasStore } from '../../../src/stores/canvasStore.js';
import type { DataChannelMessage } from '../../../src/services/connection-manager.js';
import type { Stroke } from '../../../src/services/canvas-logic.js';

describe('useCanvasSync', () => {
  let sendMessage: ReturnType<typeof vi.fn<(data: DataChannelMessage) => boolean>>;

  beforeEach(() => {
    sendMessage = vi.fn(() => true);
    useCanvasStore.getState().reset();
  });

  it('returns handleMessage and action helpers', () => {
    const { result } = renderHook(() => useCanvasSync({ sendMessage }));
    expect(typeof result.current.handleMessage).toBe('function');
    expect(typeof result.current.sendStroke).toBe('function');
    expect(typeof result.current.sendCanvasView).toBe('function');
    expect(typeof result.current.sendCanvasClear).toBe('function');
  });

  describe('sendStroke', () => {
    it('sends a canvas stroke message', () => {
      const { result } = renderHook(() => useCanvasSync({ sendMessage }));

      const stroke: Stroke = { tool: 'pen', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] };
      act(() => {
        result.current.sendStroke(stroke);
      });

      expect(sendMessage).toHaveBeenCalledWith({
        type: 'canvas',
        action: 'stroke',
        stroke,
      });
    });
  });

  describe('sendCanvasView', () => {
    it('sends a canvas-view message', () => {
      const { result } = renderHook(() => useCanvasSync({ sendMessage }));

      act(() => {
        result.current.sendCanvasView(2.0, { x: 100, y: 50 });
      });

      expect(sendMessage).toHaveBeenCalledWith({
        type: 'canvas-view',
        zoom: 2.0,
        panOffset: { x: 100, y: 50 },
      });
    });
  });

  describe('sendCanvasClear', () => {
    it('sends a canvas-clear message', () => {
      const { result } = renderHook(() => useCanvasSync({ sendMessage }));

      act(() => {
        result.current.sendCanvasClear();
      });

      expect(sendMessage).toHaveBeenCalledWith({ type: 'canvas-clear' });
    });
  });

  describe('incoming canvas messages', () => {
    it('adds a stroke from remote peer', () => {
      const { result } = renderHook(() => useCanvasSync({ sendMessage }));

      const stroke: Stroke = { tool: 'pen', points: [{ x: 5, y: 5 }], color: '#ff0000' };
      act(() => {
        result.current.handleMessage({
          type: 'canvas',
          action: 'stroke',
          stroke,
        });
      });

      const strokes = useCanvasStore.getState().drawingStrokes;
      expect(strokes).toHaveLength(1);
      expect(strokes[0]).toEqual(stroke);
    });

    it('updates remote drawer data', () => {
      const { result } = renderHook(() => useCanvasSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'canvas',
          action: 'drawing',
          peerId: 'peer1',
          data: { x: 100, y: 200, tool: 'pen' },
        });
      });

      expect(useCanvasStore.getState().remoteDrawers.peer1).toEqual({
        x: 100,
        y: 200,
        tool: 'pen',
      });
    });
  });

  describe('canvas-view messages', () => {
    it('updates zoom and pan', () => {
      const { result } = renderHook(() => useCanvasSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'canvas-view',
          zoom: 3.0,
          panOffset: { x: 50, y: 75 },
        });
      });

      expect(useCanvasStore.getState().zoom).toBe(3.0);
      expect(useCanvasStore.getState().panOffset).toEqual({ x: 50, y: 75 });
    });
  });

  describe('canvas-clear messages', () => {
    it('clears the canvas', () => {
      // Pre-populate some strokes
      useCanvasStore.getState().addStroke({ tool: 'pen', points: [] });

      const { result } = renderHook(() => useCanvasSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({ type: 'canvas-clear' });
      });

      expect(useCanvasStore.getState().drawingStrokes).toHaveLength(0);
    });
  });

  describe('canvas-sync messages', () => {
    it('replaces strokes, zoom, and pan from full sync', () => {
      const { result } = renderHook(() => useCanvasSync({ sendMessage }));

      const strokes: Stroke[] = [
        { tool: 'pen', points: [{ x: 1, y: 1 }] },
        { tool: 'line', points: [{ x: 0, y: 0 }, { x: 50, y: 50 }] },
      ];

      act(() => {
        result.current.handleMessage({
          type: 'canvas-sync',
          strokes,
          zoom: 1.5,
          panOffset: { x: 10, y: 20 },
        });
      });

      expect(useCanvasStore.getState().drawingStrokes).toEqual(strokes);
      expect(useCanvasStore.getState().zoom).toBe(1.5);
      expect(useCanvasStore.getState().panOffset).toEqual({ x: 10, y: 20 });
    });
  });

  describe('state-request handling', () => {
    it('sends full canvas state when requested', () => {
      // Set up some canvas state
      useCanvasStore.setState({
        drawingStrokes: [{ tool: 'pen', points: [{ x: 1, y: 1 }] }],
        zoom: 2.0,
        panOffset: { x: 30, y: 40 },
      });

      const { result } = renderHook(() => useCanvasSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({ type: 'state-request' });
      });

      expect(sendMessage).toHaveBeenCalledWith({
        type: 'canvas-sync',
        strokes: [{ tool: 'pen', points: [{ x: 1, y: 1 }] }],
        zoom: 2.0,
        panOffset: { x: 30, y: 40 },
      });
    });
  });

  describe('unknown message types', () => {
    it('ignores unknown types', () => {
      const { result } = renderHook(() => useCanvasSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({ type: 'unknown' } as unknown as DataChannelMessage);
      });

      // No errors, no state changes
      expect(useCanvasStore.getState().drawingStrokes).toHaveLength(0);
    });
  });
});
