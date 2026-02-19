import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useCanvasStore } from '../../src/stores/canvasStore';
import TextInputOverlay from '../../src/components/DiagramCanvas/TextInputOverlay';
import { findTextAtPosition } from '../../src/services/canvas-logic';

/**
 * Tests for clicking existing text to edit.
 *
 * Requirements:
 * - Click on existing text stroke opens overlay with pre-filled text
 * - Editing and committing updates the stroke in-place via updateStrokeAt
 * - Click on empty canvas still creates new text
 * - findTextAtPosition correctly hit-tests text strokes
 */

describe('Canvas text edit (click to edit)', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  describe('findTextAtPosition', () => {
    it('should find text stroke at its position', () => {
      const strokes = [
        {
          tool: 'text' as const,
          text: 'Hello',
          position: { x: 100, y: 200 },
          fontSize: 16,
          color: '#fff',
        },
      ];

      const index = findTextAtPosition(strokes, 110, 208);
      expect(index).toBe(0);
    });

    it('should return null when clicking away from text', () => {
      const strokes = [
        {
          tool: 'text' as const,
          text: 'Hello',
          position: { x: 100, y: 200 },
          fontSize: 16,
          color: '#fff',
        },
      ];

      const index = findTextAtPosition(strokes, 500, 500);
      expect(index).toBeNull();
    });

    it('should find the topmost (last) text stroke when overlapping', () => {
      const strokes = [
        {
          tool: 'text' as const,
          text: 'Bottom',
          position: { x: 100, y: 200 },
          fontSize: 16,
          color: '#fff',
        },
        {
          tool: 'text' as const,
          text: 'Top',
          position: { x: 105, y: 205 },
          fontSize: 16,
          color: '#fff',
        },
      ];

      const index = findTextAtPosition(strokes, 110, 210);
      expect(index).toBe(1); // topmost
    });

    it('should not match non-text strokes', () => {
      const strokes = [
        {
          tool: 'rectangle' as const,
          start: { x: 100, y: 100 },
          end: { x: 200, y: 200 },
          color: '#fff',
        },
      ];

      const index = findTextAtPosition(strokes, 150, 150);
      expect(index).toBeNull();
    });
  });

  describe('Store update for text edits', () => {
    it('should update text stroke in-place via updateStrokeAt', () => {
      const store = useCanvasStore.getState();

      store.addStroke({
        tool: 'text',
        text: 'Original',
        color: '#ffffff',
        position: { x: 100, y: 200 },
        fontSize: 16,
      });

      useCanvasStore.getState().updateStrokeAt(0, { text: 'Edited' });

      const updated = useCanvasStore.getState();
      expect(updated.drawingStrokes[0].text).toBe('Edited');
      expect(updated.drawingStrokes[0].position).toEqual({ x: 100, y: 200 });
    });

    it('should update multi-line text in-place', () => {
      const store = useCanvasStore.getState();

      store.addStroke({
        tool: 'text',
        text: 'Line 1',
        color: '#ffffff',
        position: { x: 100, y: 200 },
        fontSize: 16,
      });

      useCanvasStore.getState().updateStrokeAt(0, { text: 'Line 1\nLine 2\nLine 3' });

      const updated = useCanvasStore.getState();
      expect(updated.drawingStrokes[0].text).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('TextInputOverlay pre-fill for editing', () => {
    it('should pre-fill with existing text when editing', () => {
      const onCommit = vi.fn();

      render(
        <TextInputOverlay
          position={{ left: 100, top: 200 }}
          onCommit={onCommit}
          onDismiss={() => {}}
          initialText="Existing text to edit"
        />,
      );

      const textarea = screen.getByPlaceholderText('Enter text...') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Existing text to edit');

      // Edit and commit
      fireEvent.change(textarea, { target: { value: 'Modified text' } });
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

      expect(onCommit).toHaveBeenCalledWith('Modified text');
    });
  });
});
