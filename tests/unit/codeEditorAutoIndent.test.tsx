import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEditorStore } from '../../src/stores/editorStore';
import CodeEditor from '../../src/components/CodeEditor/CodeEditor';
import { getLeadingWhitespace } from '../../src/services/code-editor-logic';

/**
 * Tests for Enter auto-indent behavior in the code editor.
 *
 * Requirements:
 * - Pressing Enter creates a new line with the same indentation as the current line
 * - Works with spaces and tabs
 * - No indentation if current line has none
 * - Ctrl+Enter / Shift+Enter are not intercepted
 */

describe('getLeadingWhitespace (pure function)', () => {
  it('should return 4 spaces for a 4-space indented line', () => {
    const text = '    hello world';
    expect(getLeadingWhitespace(text, 10)).toBe('    ');
  });

  it('should return empty string for unindented line', () => {
    const text = 'hello world';
    expect(getLeadingWhitespace(text, 5)).toBe('');
  });

  it('should return the indentation of the current line when cursor is at start', () => {
    const text = '    hello';
    expect(getLeadingWhitespace(text, 0)).toBe('    ');
  });

  it('should handle multi-line text and pick the correct line', () => {
    const text = 'no indent\n    indented\n        deep';
    // Cursor on second line (after "no indent\n")
    expect(getLeadingWhitespace(text, 14)).toBe('    ');
  });

  it('should handle cursor on third deeply indented line', () => {
    const text = 'no indent\n    indented\n        deep';
    // Cursor on third line (after "no indent\n    indented\n")
    expect(getLeadingWhitespace(text, 25)).toBe('        ');
  });

  it('should handle tab characters', () => {
    const text = '\t\thello';
    expect(getLeadingWhitespace(text, 5)).toBe('\t\t');
  });

  it('should handle mixed spaces and tabs', () => {
    const text = '\t  hello';
    expect(getLeadingWhitespace(text, 6)).toBe('\t  ');
  });

  it('should return empty string for empty text', () => {
    expect(getLeadingWhitespace('', 0)).toBe('');
  });

  it('should handle line with only whitespace', () => {
    const text = '    ';
    expect(getLeadingWhitespace(text, 4)).toBe('    ');
  });

  it('should handle cursor at very end of indented line', () => {
    const text = '    hello';
    expect(getLeadingWhitespace(text, 9)).toBe('    ');
  });
});

describe('Code editor Enter auto-indent integration', () => {
  beforeEach(() => {
    useEditorStore.getState().setCode('');
  });

  it('should auto-indent when pressing Enter on an indented line', () => {
    useEditorStore.getState().setCode('    hello');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    // Cursor at end of "    hello"
    textarea.selectionStart = 9;
    textarea.selectionEnd = 9;

    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(useEditorStore.getState().code).toBe('    hello\n    ');
  });

  it('should not auto-indent on unindented line', () => {
    useEditorStore.getState().setCode('hello');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    textarea.selectionStart = 5;
    textarea.selectionEnd = 5;

    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(useEditorStore.getState().code).toBe('hello\n');
  });

  it('should preserve deep indentation', () => {
    useEditorStore.getState().setCode('        deep');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    textarea.selectionStart = 12;
    textarea.selectionEnd = 12;

    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(useEditorStore.getState().code).toBe('        deep\n        ');
  });

  it('should not intercept Ctrl+Enter', () => {
    useEditorStore.getState().setCode('hello');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    textarea.selectionStart = 5;
    textarea.selectionEnd = 5;

    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    // Code should NOT change (Ctrl+Enter not intercepted)
    expect(useEditorStore.getState().code).toBe('hello');
  });

  it('should auto-indent in the middle of a line', () => {
    useEditorStore.getState().setCode('    hello world');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    // Cursor between "hello" and "world"
    textarea.selectionStart = 9;
    textarea.selectionEnd = 9;

    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(useEditorStore.getState().code).toBe('    hello\n     world');
  });

  it('should replace selected text with newline + indent', () => {
    useEditorStore.getState().setCode('    hello world');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    // Select "hello"
    textarea.selectionStart = 4;
    textarea.selectionEnd = 9;

    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(useEditorStore.getState().code).toBe('    \n     world');
  });
});
