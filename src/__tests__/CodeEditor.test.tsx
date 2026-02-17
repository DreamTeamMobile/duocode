import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CodeEditor from '../components/CodeEditor/CodeEditor';
import { useEditorStore } from '../stores/editorStore';

describe('CodeEditor', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('renders textarea and highlight overlay', () => {
    const { container } = render(<CodeEditor />);
    expect(container.querySelector('#codeInput')).toBeInTheDocument();
    expect(container.querySelector('#codeHighlight')).toBeInTheDocument();
  });

  it('displays current code from store in textarea', () => {
    act(() => {
      useEditorStore.getState().setCode('hello world');
    });
    const { container } = render(<CodeEditor />);
    const textarea = container.querySelector('#codeInput') as HTMLTextAreaElement;
    expect(textarea.value).toBe('hello world');
  });

  it('updates store and increments operation count on input', () => {
    const { container } = render(<CodeEditor />);
    const textarea = container.querySelector('#codeInput') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'const x = 1;' } });

    expect(useEditorStore.getState().code).toBe('const x = 1;');
    expect(useEditorStore.getState().localOperationCount).toBe(1);
  });

  it('does not increment operation count when value is unchanged', () => {
    act(() => {
      useEditorStore.getState().setCode('same');
    });
    const { container } = render(<CodeEditor />);
    const textarea = container.querySelector('#codeInput') as HTMLTextAreaElement;

    // Fire change with the same value
    fireEvent.change(textarea, { target: { value: 'same' } });

    expect(useEditorStore.getState().localOperationCount).toBe(0);
  });

  it('applies Prism syntax highlighting to the overlay', () => {
    act(() => {
      useEditorStore.getState().setCode('const x = 1;');
    });
    const { container } = render(<CodeEditor />);
    const codeOutput = container.querySelector('#codeOutput')!;
    // Prism should tokenize the code and create span elements
    expect(codeOutput.querySelectorAll('.token').length).toBeGreaterThan(0);
  });

  it('renders code output with language class', () => {
    const { container } = render(<CodeEditor />);
    const codeOutput = container.querySelector('#codeOutput');
    expect(codeOutput).toHaveClass('language-javascript');
  });

  it('changes language class when language changes', () => {
    act(() => {
      useEditorStore.getState().setLanguage('python');
      useEditorStore.getState().setCode('print("hello")');
    });
    const { container } = render(<CodeEditor />);
    const codeOutput = container.querySelector('#codeOutput')!;
    expect(codeOutput).toHaveClass('language-python');
    // Python syntax highlighting should produce tokens
    expect(codeOutput.querySelectorAll('.token').length).toBeGreaterThan(0);
  });

  it('syncs scroll between textarea and highlight', () => {
    const { container } = render(<CodeEditor />);
    const textarea = container.querySelector('#codeInput') as HTMLTextAreaElement;
    const highlight = container.querySelector('#codeHighlight') as HTMLElement;

    // Simulate setting scrollTop on textarea
    Object.defineProperty(textarea, 'scrollTop', { value: 100, writable: true });
    Object.defineProperty(textarea, 'scrollLeft', { value: 50, writable: true });

    fireEvent.scroll(textarea);

    expect(highlight.scrollTop).toBe(100);
    expect(highlight.scrollLeft).toBe(50);
  });
});
