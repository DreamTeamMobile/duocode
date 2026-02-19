import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEditorStore } from '../../src/stores/editorStore';
import CodeEditor from '../../src/components/CodeEditor/CodeEditor';
import { dedentLines } from '../../src/services/code-editor-logic';

/**
 * Tests for Shift+Tab (dedent) behavior in the code editor.
 *
 * Requirements:
 * - Shift+Tab removes up to 4 leading spaces from the current line
 * - Only removes spaces, stops at non-space characters
 * - Works with multi-line selections (dedents all selected lines)
 * - Does nothing if line has no leading spaces
 */

describe('dedentLines (pure function)', () => {
  it('should remove 4 leading spaces from a single line', () => {
    const result = dedentLines('    hello', 0, 9);
    expect(result.text).toBe('hello');
    expect(result.newStart).toBe(0);
    expect(result.newEnd).toBe(5);
  });

  it('should remove only up to 4 spaces', () => {
    const result = dedentLines('      hello', 0, 11);
    expect(result.text).toBe('  hello');
  });

  it('should remove fewer than 4 spaces if that is all there is', () => {
    const result = dedentLines('  hello', 0, 7);
    expect(result.text).toBe('hello');
  });

  it('should not remove non-space characters', () => {
    const result = dedentLines('\thello', 0, 6);
    expect(result.text).toBe('\thello');
  });

  it('should do nothing if line has no leading spaces', () => {
    const result = dedentLines('hello', 0, 5);
    expect(result.text).toBe('hello');
  });

  it('should dedent multiple selected lines', () => {
    const code = '    line1\n    line2\n    line3';
    const result = dedentLines(code, 0, code.length);
    expect(result.text).toBe('line1\nline2\nline3');
  });

  it('should dedent lines with mixed indentation levels', () => {
    const code = '        deep\n    normal\n  shallow\nno indent';
    const result = dedentLines(code, 0, code.length);
    expect(result.text).toBe('    deep\nnormal\nshallow\nno indent');
  });

  it('should only dedent lines within selection range', () => {
    //        0123456789...
    const code = 'keep\n    dedent\n    also\nkeep2';
    // Select from "    dedent" to "    also" (positions 5 to 24)
    const result = dedentLines(code, 5, 24);
    expect(result.text).toBe('keep\ndedent\nalso\nkeep2');
  });

  it('should handle cursor on a single indented line (no selection)', () => {
    const code = '    hello world';
    // Cursor at position 8 (after "    hell")
    const result = dedentLines(code, 8, 8);
    expect(result.text).toBe('hello world');
    // Cursor should move back by 4 (the removed spaces)
    expect(result.newStart).toBe(4);
    expect(result.newEnd).toBe(4);
  });

  it('should handle line with exactly 1 space', () => {
    const result = dedentLines(' x', 0, 2);
    expect(result.text).toBe('x');
  });

  it('should handle line with exactly 3 spaces', () => {
    const result = dedentLines('   x', 0, 4);
    expect(result.text).toBe('x');
  });

  it('should handle empty lines in multi-line selection', () => {
    const code = '    a\n\n    b';
    const result = dedentLines(code, 0, code.length);
    expect(result.text).toBe('a\n\nb');
  });

  it('should adjust cursor position correctly when spaces are removed before cursor', () => {
    const code = '    hello';
    // Cursor at end of line
    const result = dedentLines(code, 9, 9);
    expect(result.newStart).toBe(5);
    expect(result.newEnd).toBe(5);
  });

  it('should not move cursor below 0', () => {
    const code = '  hi';
    // Cursor at position 1 (inside the leading spaces)
    const result = dedentLines(code, 1, 1);
    expect(result.newStart).toBe(0);
    expect(result.newEnd).toBe(0);
  });
});

describe('Code editor Shift+Tab integration', () => {
  beforeEach(() => {
    useEditorStore.getState().setCode('');
  });

  it('should prevent default Shift+Tab behavior', () => {
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const prevented = !textarea.dispatchEvent(event);
    expect(prevented).toBe(true);
  });

  it('should remove 4 leading spaces on Shift+Tab', () => {
    useEditorStore.getState().setCode('    hello');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: true });

    expect(useEditorStore.getState().code).toBe('hello');
  });

  it('should remove fewer spaces if line has less than 4', () => {
    useEditorStore.getState().setCode('  hello');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: true });

    expect(useEditorStore.getState().code).toBe('hello');
  });

  it('should dedent multiple selected lines', () => {
    const code = '    a\n    b\n    c';
    useEditorStore.getState().setCode(code);
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    textarea.selectionStart = 0;
    textarea.selectionEnd = code.length;

    fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: true });

    expect(useEditorStore.getState().code).toBe('a\nb\nc');
  });

  it('should not change code if no leading spaces', () => {
    useEditorStore.getState().setCode('hello');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: true });

    expect(useEditorStore.getState().code).toBe('hello');
  });
});
