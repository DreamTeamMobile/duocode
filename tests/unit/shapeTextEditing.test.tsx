import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TextInputOverlay from '../../src/components/DiagramCanvas/TextInputOverlay';

/**
 * Tests for shape text editing overlay styling.
 *
 * When editing text inside a shape (rect/circle), the overlay should
 * use a transparent, borderless textarea so the shape's selection
 * highlight (dashed blue border) is the only visual indicator.
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
