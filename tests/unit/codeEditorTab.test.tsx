import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEditorStore } from '../../src/stores/editorStore';
import CodeEditor from '../../src/components/CodeEditor/CodeEditor';

/**
 * Tests for Tab key behavior in the code editor.
 *
 * Regression: Pressing Tab in the code textarea moves focus away from
 * the editor instead of inserting indentation.
 *
 * Fix: Intercept Tab keydown, preventDefault, insert 4 spaces at cursor.
 */

describe('Code editor Tab key', () => {
  beforeEach(() => {
    useEditorStore.getState().setCode('');
  });

  it('should prevent default Tab behavior (focus change)', () => {
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    const prevented = !textarea.dispatchEvent(event);

    expect(prevented).toBe(true);
  });

  it('should insert 4 spaces when Tab is pressed at start', () => {
    useEditorStore.getState().setCode('hello');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    // Cursor at start (default position 0)
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    fireEvent.keyDown(textarea, { key: 'Tab' });

    const updatedCode = useEditorStore.getState().code;
    expect(updatedCode).toBe('    hello');
  });

  it('should insert spaces at the cursor position', () => {
    useEditorStore.getState().setCode('abc');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    textarea.selectionStart = 1;
    textarea.selectionEnd = 1;

    fireEvent.keyDown(textarea, { key: 'Tab' });

    const updatedCode = useEditorStore.getState().code;
    expect(updatedCode).toBe('a    bc');
  });

  it('should replace selected text with 4 spaces', () => {
    useEditorStore.getState().setCode('hello world');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    // Select "llo wo"
    textarea.selectionStart = 2;
    textarea.selectionEnd = 8;

    fireEvent.keyDown(textarea, { key: 'Tab' });

    const updatedCode = useEditorStore.getState().code;
    expect(updatedCode).toBe('he    rld');
  });

  it('should not interfere with other key presses', () => {
    useEditorStore.getState().setCode('test');
    render(<CodeEditor />);
    const textarea = screen.getByLabelText('Code editor') as HTMLTextAreaElement;

    // Regular key should not be prevented
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      cancelable: true,
    });
    const prevented = !textarea.dispatchEvent(event);
    expect(prevented).toBe(false);
  });
});
