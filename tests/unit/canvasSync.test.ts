import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../../src/stores/canvasStore';

/**
 * Tests for WebRTC sync of in-place stroke updates.
 *
 * Problem: useCanvasSync only detects array length changes.
 * updateStrokeAt creates a new array ref but same length — no sync.
 *
 * Fix: Add strokeVersion counter that increments on updateStrokeAt,
 * enabling useCanvasSync to detect in-place mutations.
 */

describe('Canvas sync for updateStrokeAt', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  it('should have strokeVersion starting at 0', () => {
    const state = useCanvasStore.getState();
    expect(state.strokeVersion).toBe(0);
  });

  it('should increment strokeVersion when updateStrokeAt is called', () => {
    const store = useCanvasStore.getState();

    store.addStroke({
      tool: 'rectangle',
      color: '#ffffff',
      start: { x: 100, y: 100 },
      end: { x: 200, y: 200 },
    });

    const before = useCanvasStore.getState().strokeVersion;
    useCanvasStore.getState().updateStrokeAt(0, { text: 'Hello' });
    const after = useCanvasStore.getState().strokeVersion;

    expect(after).toBe(before + 1);
  });

  it('should not change strokeVersion on addStroke', () => {
    const before = useCanvasStore.getState().strokeVersion;

    useCanvasStore.getState().addStroke({
      tool: 'text',
      text: 'Test',
      color: '#fff',
      position: { x: 0, y: 0 },
      fontSize: 16,
    });

    const after = useCanvasStore.getState().strokeVersion;
    expect(after).toBe(before);
  });

  it('should increment strokeVersion on each updateStrokeAt call', () => {
    const store = useCanvasStore.getState();

    store.addStroke({
      tool: 'text',
      text: 'A',
      color: '#fff',
      position: { x: 0, y: 0 },
      fontSize: 16,
    });

    useCanvasStore.getState().updateStrokeAt(0, { text: 'B' });
    useCanvasStore.getState().updateStrokeAt(0, { text: 'C' });
    useCanvasStore.getState().updateStrokeAt(0, { text: 'D' });

    expect(useCanvasStore.getState().strokeVersion).toBe(3);
  });

  it('should keep same array length after updateStrokeAt', () => {
    const store = useCanvasStore.getState();

    store.addStroke({
      tool: 'text',
      text: 'Original',
      color: '#fff',
      position: { x: 0, y: 0 },
      fontSize: 16,
    });

    const lengthBefore = useCanvasStore.getState().drawingStrokes.length;
    useCanvasStore.getState().updateStrokeAt(0, { text: 'Updated' });
    const lengthAfter = useCanvasStore.getState().drawingStrokes.length;

    expect(lengthAfter).toBe(lengthBefore);
  });
});
