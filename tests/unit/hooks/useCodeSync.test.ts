import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCodeSync } from '../../../src/hooks/useCodeSync.js';
import { useEditorStore } from '../../../src/stores/editorStore.js';
import type { DataChannelMessage } from '../../../src/services/connection-manager.js';

describe('useCodeSync', () => {
  let sendMessage: ReturnType<typeof vi.fn<(data: DataChannelMessage) => boolean>>;

  beforeEach(() => {
    sendMessage = vi.fn(() => true);
    useEditorStore.getState().reset();
  });

  it('returns a handleMessage callback', () => {
    const { result } = renderHook(() => useCodeSync({ sendMessage }));
    expect(typeof result.current.handleMessage).toBe('function');
  });

  describe('incoming code-operation messages', () => {
    it('applies a remote insert operation', () => {
      useEditorStore.getState().setCode('hello');

      const { result } = renderHook(() => useCodeSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'code-operation',
          operation: [5, ' world'], // retain 5, insert ' world'
          operationCount: 1,
        });
      });

      expect(useEditorStore.getState().code).toBe('hello world');
    });

    it('applies a remote delete operation', () => {
      useEditorStore.getState().setCode('hello world');

      const { result } = renderHook(() => useCodeSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'code-operation',
          operation: [5, -6], // retain 5, delete 6 (' world')
          operationCount: 1,
        });
      });

      expect(useEditorStore.getState().code).toBe('hello');
    });

    it('increments remoteOperationCount', () => {
      useEditorStore.getState().setCode('test');

      const { result } = renderHook(() => useCodeSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'code-operation',
          operation: [4, '!'], // retain 4, insert '!'
          operationCount: 1,
        });
      });

      expect(useEditorStore.getState().remoteOperationCount).toBe(1);
    });
  });

  describe('incoming full code sync messages', () => {
    it('replaces code on "code" message', () => {
      useEditorStore.getState().setCode('old code');

      const { result } = renderHook(() => useCodeSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'code',
          code: 'new full code',
          language: 'python',
        });
      });

      expect(useEditorStore.getState().code).toBe('new full code');
      expect(useEditorStore.getState().language).toBe('python');
    });

    it('replaces code on "state-sync" message', () => {
      const { result } = renderHook(() => useCodeSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'state-sync',
          code: 'synced code',
          language: 'java',
        });
      });

      expect(useEditorStore.getState().code).toBe('synced code');
      expect(useEditorStore.getState().language).toBe('java');
    });
  });

  describe('state-request handling', () => {
    it('sends full state when receiving state-request', () => {
      useEditorStore.getState().setCode('my code');
      useEditorStore.getState().setLanguage('typescript');

      const { result } = renderHook(() => useCodeSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({ type: 'state-request' });
      });

      expect(sendMessage).toHaveBeenCalledWith({
        type: 'state-sync',
        code: 'my code',
        language: 'typescript',
      });
    });
  });

  describe('cursor handling', () => {
    it('updates remote cursor on "cursor" message', () => {
      const { result } = renderHook(() => useCodeSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'cursor',
          peerId: 'peer1',
          position: 42,
          name: 'Alice',
        });
      });

      expect(useEditorStore.getState().remoteCursors.peer1).toEqual({
        position: 42,
        name: 'Alice',
      });
    });
  });

  describe('language change handling', () => {
    it('updates language on "language" message', () => {
      const { result } = renderHook(() => useCodeSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'language',
          language: 'rust',
        });
      });

      expect(useEditorStore.getState().language).toBe('rust');
    });
  });

  describe('unknown message types', () => {
    it('ignores unknown message types', () => {
      const { result } = renderHook(() => useCodeSync({ sendMessage }));
      const codeBefore = useEditorStore.getState().code;

      act(() => {
        result.current.handleMessage({ type: 'unknown-type' } as unknown as DataChannelMessage);
      });

      expect(useEditorStore.getState().code).toBe(codeBefore);
    });
  });
});
