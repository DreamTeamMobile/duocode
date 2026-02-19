import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextInputOverlay from '../../src/components/DiagramCanvas/TextInputOverlay';

describe('TextInputOverlay', () => {
  const defaultProps = {
    position: { left: 100, top: 200 },
    onCommit: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an input with correct positioning', () => {
    render(<TextInputOverlay {...defaultProps} />);
    const overlay = screen.getByPlaceholderText('Enter text...').closest('.text-input-overlay') as HTMLElement;
    expect(overlay.style.left).toBe('100px');
    expect(overlay.style.top).toBe('200px');
  });

  it('focuses the input on mount', () => {
    render(<TextInputOverlay {...defaultProps} />);
    const input = screen.getByPlaceholderText('Enter text...');
    expect(document.activeElement).toBe(input);
  });

  it('calls onCommit with text when Ctrl+Enter is pressed', () => {
    render(<TextInputOverlay {...defaultProps} />);
    const input = screen.getByPlaceholderText('Enter text...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(defaultProps.onCommit).toHaveBeenCalledWith('Hello');
  });

  it('calls onDismiss when Escape is pressed', () => {
    render(<TextInputOverlay {...defaultProps} />);
    const input = screen.getByPlaceholderText('Enter text...');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(defaultProps.onDismiss).toHaveBeenCalled();
  });

  it('calls onCommit with text on blur when input has value', () => {
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    render(<TextInputOverlay {...defaultProps} />);
    const input = screen.getByPlaceholderText('Enter text...');
    fireEvent.change(input, { target: { value: 'World' } });
    // Advance past the 300ms blur grace period
    spy.mockReturnValue(now + 400);
    fireEvent.blur(input);
    expect(defaultProps.onCommit).toHaveBeenCalledWith('World');
    spy.mockRestore();
  });

  it('calls onDismiss on blur when input is empty', () => {
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    render(<TextInputOverlay {...defaultProps} />);
    const input = screen.getByPlaceholderText('Enter text...');
    // Advance past the 300ms blur grace period
    spy.mockReturnValue(now + 400);
    fireEvent.blur(input);
    expect(defaultProps.onDismiss).toHaveBeenCalled();
    spy.mockRestore();
  });
});
