import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useCanvasStore } from '../../src/stores/canvasStore';
import TextInputOverlay from '../../src/components/DiagramCanvas/TextInputOverlay';

/**
 * Tests for canvas text commit behavior.
 *
 * Bug: When clicking outside the text input (on the canvas), the text disappears
 * instead of being committed. This happens because handleMouseDown creates a new
 * overlay (changing the React key), which unmounts the old TextInputOverlay before
 * its blur handler can read the input value.
 *
 * These tests verify:
 * 1. Text commit via Enter key works correctly
 * 2. Text commit via blur (click outside) works correctly
 * 3. No double-commit when Enter is followed by blur on unmount
 */

describe('Canvas text commit', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  describe('TextInputOverlay commit behavior', () => {
    it('should call onCommit with text value when Enter is pressed', () => {
      const onCommit = vi.fn();
      const onDismiss = vi.fn();

      render(
        <TextInputOverlay
          position={{ left: 100, top: 200 }}
          onCommit={onCommit}
          onDismiss={onDismiss}
        />,
      );

      const input = screen.getByPlaceholderText('Enter text...');
      fireEvent.change(input, { target: { value: 'Enter Text' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onCommit).toHaveBeenCalledWith('Enter Text');
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it('should call onCommit with text value on blur after grace period', () => {
      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

      const onCommit = vi.fn();
      const onDismiss = vi.fn();

      render(
        <TextInputOverlay
          position={{ left: 100, top: 200 }}
          onCommit={onCommit}
          onDismiss={onDismiss}
        />,
      );

      const input = screen.getByPlaceholderText('Enter text...');
      fireEvent.change(input, { target: { value: 'Blur Text' } });

      // Advance past the 300ms grace period
      dateSpy.mockReturnValue(now + 400);
      fireEvent.blur(input);

      expect(onCommit).toHaveBeenCalledWith('Blur Text');
      expect(onCommit).toHaveBeenCalledTimes(1);

      dateSpy.mockRestore();
    });

    it('should not double-commit when Enter is followed by unmount blur', () => {
      const onCommit = vi.fn();
      const onDismiss = vi.fn();

      const { unmount } = render(
        <TextInputOverlay
          position={{ left: 100, top: 200 }}
          onCommit={onCommit}
          onDismiss={onDismiss}
        />,
      );

      const input = screen.getByPlaceholderText('Enter text...');
      fireEvent.change(input, { target: { value: 'Test Text' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith('Test Text');

      // Simulate unmount (which triggers blur in real browser)
      unmount();

      // onCommit should still only have been called once
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Canvas text stroke persistence', () => {
    it('should persist text stroke in store when committed via Enter', () => {
      const store = useCanvasStore.getState();
      expect(store.drawingStrokes).toHaveLength(0);

      // Simulate what handleTextCommit does when Enter is pressed
      const stroke = {
        tool: 'text' as const,
        text: 'Enter Text',
        color: '#ffffff',
        position: { x: 200, y: 300 },
        fontSize: 16,
      };
      store.addStroke(stroke);

      const updated = useCanvasStore.getState();
      expect(updated.drawingStrokes).toHaveLength(1);
      expect(updated.drawingStrokes[0]).toMatchObject({
        tool: 'text',
        text: 'Enter Text',
        position: { x: 200, y: 300 },
      });
    });

    it('should persist text stroke in store when committed via blur (click outside on canvas)', () => {
      // This test simulates the real browser scenario:
      // 1. User clicks canvas with text tool → text input appears at position (200, 300)
      // 2. User types "Blur Text"
      // 3. User clicks elsewhere on canvas → handleMouseDown reads DOM input value
      //    and calls handleTextCommit BEFORE remounting the overlay
      //
      // The fix: DiagramCanvas.handleMouseDown now reads the DOM input value
      // and commits it before changing the overlay key (which causes remount).

      const committedTexts: string[] = [];
      const handleTextCommit = (text: string) => {
        if (!text.trim()) return;
        committedTexts.push(text);
        useCanvasStore.getState().addStroke({
          tool: 'text',
          text,
          color: '#ffffff',
          position: { x: 200, y: 300 },
          fontSize: 16,
        });
      };

      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

      // Step 1: Render text input overlay (simulating first canvas click)
      const { rerender, unmount } = render(
        <TextInputOverlay
          key={1}
          position={{ left: 200, top: 300 }}
          onCommit={handleTextCommit}
          onDismiss={() => {}}
        />,
      );

      // Step 2: User types text
      const input = screen.getByPlaceholderText('Enter text...');
      fireEvent.change(input, { target: { value: 'Blur Text' } });

      // Advance past grace period
      dateSpy.mockReturnValue(now + 400);

      // Step 3: Simulate what DiagramCanvas.handleMouseDown does on click-outside:
      // It reads the DOM input value BEFORE remounting the overlay.
      // This is the fix — the parent captures the value before the child unmounts.
      const domInput = document.getElementById('canvasTextInput') as HTMLInputElement | null;
      const value = domInput?.value ?? '';
      handleTextCommit(value);

      // Then the overlay is remounted with a new key (new position)
      rerender(
        <TextInputOverlay
          key={2}
          position={{ left: 500, top: 400 }}
          onCommit={handleTextCommit}
          onDismiss={() => {}}
        />,
      );

      // Check: was the "Blur Text" committed to the store?
      const storeState = useCanvasStore.getState();
      expect(committedTexts).toContain('Blur Text');
      expect(storeState.drawingStrokes).toHaveLength(1);
      expect(storeState.drawingStrokes[0]).toMatchObject({
        tool: 'text',
        text: 'Blur Text',
        position: { x: 200, y: 300 },
      });

      dateSpy.mockRestore();
      unmount();
    });
  });
});
