import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import RemoteCursors from '../components/CodeEditor/RemoteCursors';
import { useEditorStore } from '../stores/editorStore';

function createMockTextareaRef(overrides: Record<string, unknown> = {}) {
  return {
    current: {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 600,
      clientWidth: 800,
      ...overrides,
    },
  } as React.RefObject<HTMLTextAreaElement>;
}

describe('RemoteCursors', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('renders nothing when there are no remote cursors', () => {
    const ref = createMockTextareaRef();
    const { container } = render(<RemoteCursors textareaRef={ref} />);
    expect(container.querySelector('.remote-cursor')).not.toBeInTheDocument();
  });

  it('renders a cursor for each remote peer', () => {
    act(() => {
      useEditorStore.getState().setCode('hello world');
      useEditorStore.getState().updateRemoteCursor('peer1', {
        position: 5,
        line: 0,
        column: 5,
        color: '#ff0000',
        name: 'Alice',
      });
      useEditorStore.getState().updateRemoteCursor('peer2', {
        position: 8,
        line: 0,
        column: 8,
        color: '#00ff00',
        name: 'Bob',
      });
    });

    const ref = createMockTextareaRef();
    const { container } = render(<RemoteCursors textareaRef={ref} />);
    const cursors = container.querySelectorAll('.remote-cursor');
    expect(cursors).toHaveLength(2);
  });

  it('displays peer name labels', () => {
    act(() => {
      useEditorStore.getState().setCode('hello world');
      useEditorStore.getState().updateRemoteCursor('peer1', {
        position: 5,
        line: 0,
        column: 5,
        color: '#ff0000',
        name: 'Alice',
      });
    });

    const ref = createMockTextareaRef();
    const { getByText } = render(<RemoteCursors textareaRef={ref} />);
    expect(getByText('Alice')).toBeInTheDocument();
  });

  it('uses cursor color for styling', () => {
    act(() => {
      useEditorStore.getState().setCode('hello');
      useEditorStore.getState().updateRemoteCursor('peer1', {
        position: 3,
        line: 0,
        column: 3,
        color: '#ff4444',
        name: 'Alice',
      });
    });

    const ref = createMockTextareaRef();
    const { container } = render(<RemoteCursors textareaRef={ref} />);
    const cursor = container.querySelector('.remote-cursor') as HTMLElement;
    expect(cursor.style.backgroundColor).toBe('rgb(255, 68, 68)');
  });

  it('positions cursor based on character offset', () => {
    act(() => {
      // "hello\nworld" — cursor at position 7 means line 1, column 1
      useEditorStore.getState().setCode('hello\nworld');
      useEditorStore.getState().updateRemoteCursor('peer1', {
        position: 7,
        line: 1,
        column: 1,
        color: '#ff0000',
        name: 'Alice',
      });
    });

    const ref = createMockTextareaRef();
    const { container } = render(<RemoteCursors textareaRef={ref} />);
    const cursor = container.querySelector('.remote-cursor') as HTMLElement;
    // Position should reflect line 1 (second line), column 1
    // top = padding(12) + lineNumber(1) * lineHeight(21) - scrollTop(0) = 33
    // left = padding(12) + column(1) * charWidth(8.4) - scrollLeft(0) = 20.4
    expect(cursor.style.top).toBe('33px');
    expect(cursor.style.left).toBe('20.4px');
  });

  it('hides cursor when scrolled out of view', () => {
    act(() => {
      useEditorStore.getState().setCode('hello');
      useEditorStore.getState().updateRemoteCursor('peer1', {
        position: 3,
        line: 0,
        column: 3,
        color: '#ff0000',
        name: 'Alice',
      });
    });

    // Scroll down far enough that the cursor is above the viewport
    const ref = createMockTextareaRef({ scrollTop: 5000 });
    const { container } = render(<RemoteCursors textareaRef={ref} />);
    expect(container.querySelector('.remote-cursor')).not.toBeInTheDocument();
  });

  it('falls back to peerId prefix when name is not provided', () => {
    act(() => {
      useEditorStore.getState().setCode('hello');
      useEditorStore.getState().updateRemoteCursor('abcdef123456', {
        position: 3,
        line: 0,
        column: 3,
        color: '#ff0000',
      });
    });

    const ref = createMockTextareaRef();
    const { getByText } = render(<RemoteCursors textareaRef={ref} />);
    expect(getByText('abcdef')).toBeInTheDocument();
  });
});
