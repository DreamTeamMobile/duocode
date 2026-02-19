import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useCanvasStore } from '../../src/stores/canvasStore';
import TextInputOverlay from '../../src/components/DiagramCanvas/TextInputOverlay';
import { getShapeCenter } from '../../src/services/canvas-logic';

/**
 * Tests for double-click on shapes to add/edit text.
 *
 * Requirements:
 * - Double-click on rectangle/circle opens text overlay at shape center
 * - Existing shape text pre-fills the overlay (initialText prop)
 * - Committing updates the shape's text via updateStrokeAt
 */

describe('Canvas shape text', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  describe('getShapeCenter', () => {
    it('should return center of rectangle', () => {
      const center = getShapeCenter({
        tool: 'rectangle',
        start: { x: 100, y: 100 },
        end: { x: 300, y: 200 },
      });
      expect(center).toEqual({ x: 200, y: 150 });
    });

    it('should return center of circle (its start point)', () => {
      const center = getShapeCenter({
        tool: 'circle',
        start: { x: 250, y: 250 },
        end: { x: 350, y: 250 },
      });
      expect(center).toEqual({ x: 250, y: 250 });
    });
  });

  describe('TextInputOverlay with initialText', () => {
    it('should pre-fill textarea with initialText', () => {
      const onCommit = vi.fn();
      const onDismiss = vi.fn();

      render(
        <TextInputOverlay
          position={{ left: 200, top: 150 }}
          onCommit={onCommit}
          onDismiss={onDismiss}
          initialText="Existing Label"
        />,
      );

      const textarea = screen.getByPlaceholderText('Enter text...') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Existing Label');
    });

    it('should commit edited shape text', () => {
      const onCommit = vi.fn();
      const onDismiss = vi.fn();

      render(
        <TextInputOverlay
          position={{ left: 200, top: 150 }}
          onCommit={onCommit}
          onDismiss={onDismiss}
          initialText="Old Label"
        />,
      );

      const textarea = screen.getByPlaceholderText('Enter text...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'New Label' } });
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

      expect(onCommit).toHaveBeenCalledWith('New Label');
    });
  });

  describe('Store updateStrokeAt for shape text', () => {
    it('should update rectangle text via updateStrokeAt', () => {
      const store = useCanvasStore.getState();

      // Add a rectangle
      store.addStroke({
        tool: 'rectangle',
        color: '#ffffff',
        start: { x: 100, y: 100 },
        end: { x: 300, y: 200 },
      });

      // Update its text (like double-click → commit does)
      useCanvasStore.getState().updateStrokeAt(0, { text: 'Rectangle Label' });

      const updated = useCanvasStore.getState();
      expect(updated.drawingStrokes[0].text).toBe('Rectangle Label');
      expect(updated.drawingStrokes[0].tool).toBe('rectangle');
    });

    it('should update circle text via updateStrokeAt', () => {
      const store = useCanvasStore.getState();

      store.addStroke({
        tool: 'circle',
        color: '#ffffff',
        start: { x: 250, y: 250 },
        end: { x: 350, y: 250 },
      });

      useCanvasStore.getState().updateStrokeAt(0, { text: 'Circle Label' });

      const updated = useCanvasStore.getState();
      expect(updated.drawingStrokes[0].text).toBe('Circle Label');
    });

    it('should replace existing shape text', () => {
      const store = useCanvasStore.getState();

      store.addStroke({
        tool: 'rectangle',
        color: '#ffffff',
        start: { x: 100, y: 100 },
        end: { x: 300, y: 200 },
        text: 'Old Text',
      });

      useCanvasStore.getState().updateStrokeAt(0, { text: 'Updated Text' });

      const updated = useCanvasStore.getState();
      expect(updated.drawingStrokes[0].text).toBe('Updated Text');
    });
  });
});
