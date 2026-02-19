import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextInputOverlay from '../../src/components/DiagramCanvas/TextInputOverlay';

/**
 * Tests for shape text editing overlay.
 *
 * Covers:
 * - CSS class toggling for shape-editing mode
 * - Multi-line text entry (textarea auto-resize for all modes)
 * - Overlay width/height applied when editing shapes
 * - Commit/dismiss keyboard shortcuts with multi-line content
 */

describe('TextInputOverlay shapeEditing prop', () => {
  const defaultProps = {
    position: { left: 100, top: 100 },
    onCommit: () => {},
    onDismiss: () => {},
  };

  it('should NOT have shape-editing class by default', () => {
    const { container } = render(<TextInputOverlay {...defaultProps} />);
    const overlay = container.querySelector('.text-input-overlay');
    expect(overlay?.classList.contains('shape-editing')).toBe(false);
  });

  it('should have shape-editing class when shapeEditing is true', () => {
    const { container } = render(<TextInputOverlay {...defaultProps} shapeEditing />);
    const overlay = container.querySelector('.text-input-overlay');
    expect(overlay?.classList.contains('shape-editing')).toBe(true);
  });

  it('should NOT have shape-editing class when shapeEditing is false', () => {
    const { container } = render(<TextInputOverlay {...defaultProps} shapeEditing={false} />);
    const overlay = container.querySelector('.text-input-overlay');
    expect(overlay?.classList.contains('shape-editing')).toBe(false);
  });

  it('should render textarea with placeholder', () => {
    render(<TextInputOverlay {...defaultProps} shapeEditing />);
    const textarea = screen.getByPlaceholderText('Enter text...');
    expect(textarea).toBeInTheDocument();
  });

  it('should pre-fill text when initialText and shapeEditing are set', () => {
    render(<TextInputOverlay {...defaultProps} shapeEditing initialText="API Server" />);
    const textarea = screen.getByPlaceholderText('Enter text...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('API Server');
  });
});

describe('TextInputOverlay multi-line editing', () => {
  const defaultProps = {
    position: { left: 100, top: 100 },
    onCommit: vi.fn(),
    onDismiss: vi.fn(),
  };

  it('should auto-resize textarea height on input in shape-editing mode', () => {
    const { container } = render(
      <TextInputOverlay {...defaultProps} shapeEditing position={{ left: 0, top: 0, width: 200, height: 100 }} />,
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    // Simulate typing multi-line text
    textarea.value = 'Line 1\nLine 2\nLine 3';

    // Mock scrollHeight to simulate content growing
    Object.defineProperty(textarea, 'scrollHeight', { value: 72, configurable: true });

    fireEvent.input(textarea);

    // handleInput should set height to scrollHeight — NOT be skipped for shape editing
    expect(textarea.style.height).toBe('72px');
  });

  it('should auto-resize textarea height on input in non-shape mode', () => {
    const { container } = render(<TextInputOverlay {...defaultProps} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = 'Line 1\nLine 2';
    Object.defineProperty(textarea, 'scrollHeight', { value: 48, configurable: true });

    fireEvent.input(textarea);

    expect(textarea.style.height).toBe('48px');
  });

  it('plain Enter should NOT commit (allows newline in textarea)', () => {
    const onCommit = vi.fn();
    render(<TextInputOverlay {...defaultProps} onCommit={onCommit} shapeEditing />);
    const textarea = screen.getByPlaceholderText('Enter text...');

    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Ctrl+Enter should commit multi-line text', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <TextInputOverlay {...defaultProps} onCommit={onCommit} shapeEditing />,
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    // Type multi-line content
    textarea.value = 'Line 1\nLine 2\nLine 3';

    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    expect(onCommit).toHaveBeenCalledWith('Line 1\nLine 2\nLine 3');
  });

  it('Cmd+Enter should commit multi-line text', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <TextInputOverlay {...defaultProps} onCommit={onCommit} shapeEditing />,
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = 'First\nSecond';

    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

    expect(onCommit).toHaveBeenCalledWith('First\nSecond');
  });

  it('Escape should dismiss without committing', () => {
    const onCommit = vi.fn();
    const onDismiss = vi.fn();
    const { container } = render(
      <TextInputOverlay {...defaultProps} onCommit={onCommit} onDismiss={onDismiss} shapeEditing />,
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = 'Some text\nSecond line';

    fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('should pre-fill multi-line initialText', () => {
    render(
      <TextInputOverlay {...defaultProps} shapeEditing initialText={'Line A\nLine B\nLine C'} />,
    );
    const textarea = screen.getByPlaceholderText('Enter text...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Line A\nLine B\nLine C');
  });
});

describe('TextInputOverlay overlay dimensions for shape editing', () => {
  const baseProps = {
    onCommit: () => {},
    onDismiss: () => {},
  };

  it('should apply width and height when shapeEditing with dimensions', () => {
    const { container } = render(
      <TextInputOverlay
        {...baseProps}
        shapeEditing
        position={{ left: 50, top: 60, width: 200, height: 150 }}
      />,
    );
    const overlay = container.querySelector('.text-input-overlay') as HTMLElement;

    expect(overlay.style.left).toBe('50px');
    expect(overlay.style.top).toBe('60px');
    expect(overlay.style.width).toBe('200px');
    expect(overlay.style.height).toBe('150px');
  });

  it('should NOT apply width/height when not in shapeEditing mode', () => {
    const { container } = render(
      <TextInputOverlay
        {...baseProps}
        position={{ left: 50, top: 60, width: 200, height: 150 }}
      />,
    );
    const overlay = container.querySelector('.text-input-overlay') as HTMLElement;

    expect(overlay.style.left).toBe('50px');
    expect(overlay.style.top).toBe('60px');
    expect(overlay.style.width).toBe('');
    expect(overlay.style.height).toBe('');
  });

  it('should NOT apply width/height when dimensions are missing', () => {
    const { container } = render(
      <TextInputOverlay {...baseProps} shapeEditing position={{ left: 50, top: 60 }} />,
    );
    const overlay = container.querySelector('.text-input-overlay') as HTMLElement;

    expect(overlay.style.width).toBe('');
    expect(overlay.style.height).toBe('');
  });
});
