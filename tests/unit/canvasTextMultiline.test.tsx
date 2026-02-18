import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextInputOverlay from '../../src/components/DiagramCanvas/TextInputOverlay';

/**
 * Tests for multi-line text input behavior.
 *
 * Requirements:
 * - Enter key adds a newline (does NOT commit)
 * - Ctrl+Enter (or Cmd+Enter) commits the text
 * - Blur commits the text (after grace period)
 * - Escape dismisses without commit
 */

describe('Multi-line text input', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render a textarea (not an input)', () => {
    const onCommit = vi.fn();
    const onDismiss = vi.fn();

    render(
      <TextInputOverlay
        position={{ left: 100, top: 200 }}
        onCommit={onCommit}
        onDismiss={onDismiss}
      />,
    );

    const textarea = document.getElementById('canvasTextInput');
    expect(textarea).not.toBeNull();
    expect(textarea!.tagName.toLowerCase()).toBe('textarea');
  });

  it('Enter key should NOT commit (allows newline)', () => {
    const onCommit = vi.fn();
    const onDismiss = vi.fn();

    render(
      <TextInputOverlay
        position={{ left: 100, top: 200 }}
        onCommit={onCommit}
        onDismiss={onDismiss}
      />,
    );

    const textarea = screen.getByPlaceholderText('Enter text...');
    fireEvent.change(textarea, { target: { value: 'Line 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    // Enter should NOT trigger commit
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Ctrl+Enter should commit text', () => {
    const onCommit = vi.fn();
    const onDismiss = vi.fn();

    render(
      <TextInputOverlay
        position={{ left: 100, top: 200 }}
        onCommit={onCommit}
        onDismiss={onDismiss}
      />,
    );

    const textarea = screen.getByPlaceholderText('Enter text...');
    fireEvent.change(textarea, { target: { value: 'Multi\nLine' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    expect(onCommit).toHaveBeenCalledWith('Multi\nLine');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('Meta+Enter (Cmd) should commit text', () => {
    const onCommit = vi.fn();
    const onDismiss = vi.fn();

    render(
      <TextInputOverlay
        position={{ left: 100, top: 200 }}
        onCommit={onCommit}
        onDismiss={onDismiss}
      />,
    );

    const textarea = screen.getByPlaceholderText('Enter text...');
    fireEvent.change(textarea, { target: { value: 'Cmd Text' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

    expect(onCommit).toHaveBeenCalledWith('Cmd Text');
  });

  it('Escape should dismiss without committing', () => {
    const onCommit = vi.fn();
    const onDismiss = vi.fn();

    render(
      <TextInputOverlay
        position={{ left: 100, top: 200 }}
        onCommit={onCommit}
        onDismiss={onDismiss}
      />,
    );

    const textarea = screen.getByPlaceholderText('Enter text...');
    fireEvent.change(textarea, { target: { value: 'Will dismiss' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('blur should commit text after grace period', () => {
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

    const textarea = screen.getByPlaceholderText('Enter text...');
    fireEvent.change(textarea, { target: { value: 'Blur commit' } });

    dateSpy.mockReturnValue(now + 400);
    fireEvent.blur(textarea);

    expect(onCommit).toHaveBeenCalledWith('Blur commit');

    dateSpy.mockRestore();
  });

  it('should accept initialText prop and pre-fill the textarea', () => {
    const onCommit = vi.fn();
    const onDismiss = vi.fn();

    render(
      <TextInputOverlay
        position={{ left: 100, top: 200 }}
        onCommit={onCommit}
        onDismiss={onDismiss}
        initialText="Existing text"
      />,
    );

    const textarea = screen.getByPlaceholderText('Enter text...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Existing text');
  });
});
