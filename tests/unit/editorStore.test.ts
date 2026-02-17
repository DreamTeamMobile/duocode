import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/stores/editorStore';

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have correct defaults', () => {
      const state = useEditorStore.getState();
      expect(state.code).toBe('');
      expect(state.language).toBe('javascript');
      expect(state.localOperationCount).toBe(0);
      expect(state.remoteOperationCount).toBe(0);
      expect(state.remoteCursors).toEqual({});
    });
  });

  describe('setCode', () => {
    it('should update the code', () => {
      useEditorStore.getState().setCode('console.log("hello")');
      expect(useEditorStore.getState().code).toBe('console.log("hello")');
    });
  });

  describe('applyLocalOperation', () => {
    it('should increment localOperationCount', () => {
      useEditorStore.getState().applyLocalOperation();
      useEditorStore.getState().applyLocalOperation();
      expect(useEditorStore.getState().localOperationCount).toBe(2);
    });
  });

  describe('applyRemoteOperation', () => {
    it('should update code and increment remoteOperationCount', () => {
      useEditorStore.getState().applyRemoteOperation('new code');
      const state = useEditorStore.getState();
      expect(state.code).toBe('new code');
      expect(state.remoteOperationCount).toBe(1);
    });
  });

  describe('setLanguage', () => {
    it('should update the language', () => {
      useEditorStore.getState().setLanguage('python');
      expect(useEditorStore.getState().language).toBe('python');
    });
  });

  describe('updateRemoteCursor', () => {
    it('should add a remote cursor', () => {
      useEditorStore.getState().updateRemoteCursor('peer1', {
        position: 10,
        selectionEnd: 15,
        color: '#FF6B6B',
        line: 0,
        column: 10,
      });
      const { remoteCursors } = useEditorStore.getState();
      expect(remoteCursors.peer1).toEqual({
        position: 10,
        selectionEnd: 15,
        color: '#FF6B6B',
        line: 0,
        column: 10,
      });
    });

    it('should update an existing cursor', () => {
      useEditorStore.getState().updateRemoteCursor('peer1', {
        position: 10,
        selectionEnd: 10,
        color: '#FF6B6B',
        line: 0,
        column: 10,
      });
      useEditorStore.getState().updateRemoteCursor('peer1', {
        position: 25,
        selectionEnd: 30,
        color: '#FF6B6B',
        line: 1,
        column: 25,
      });
      expect(useEditorStore.getState().remoteCursors.peer1.position).toBe(25);
    });
  });

  describe('removeRemoteCursor', () => {
    it('should remove a remote cursor', () => {
      useEditorStore.getState().updateRemoteCursor('peer1', {
        position: 10,
        selectionEnd: 10,
        color: '#FF6B6B',
        line: 0,
        column: 10,
      });
      useEditorStore.getState().updateRemoteCursor('peer2', {
        position: 20,
        selectionEnd: 20,
        color: '#4ECDC4',
        line: 1,
        column: 20,
      });
      useEditorStore.getState().removeRemoteCursor('peer1');
      const { remoteCursors } = useEditorStore.getState();
      expect(remoteCursors.peer1).toBeUndefined();
      expect(remoteCursors.peer2).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should restore all defaults', () => {
      useEditorStore.getState().setCode('some code');
      useEditorStore.getState().setLanguage('python');
      useEditorStore.getState().applyLocalOperation();
      useEditorStore.getState().applyRemoteOperation('remote code');
      useEditorStore.getState().updateRemoteCursor('peer1', {
        position: 5,
        selectionEnd: 5,
        color: '#FF6B6B',
        line: 0,
        column: 5,
      });
      useEditorStore.getState().reset();
      const state = useEditorStore.getState();
      expect(state.code).toBe('');
      expect(state.language).toBe('javascript');
      expect(state.localOperationCount).toBe(0);
      expect(state.remoteOperationCount).toBe(0);
      expect(state.remoteCursors).toEqual({});
    });
  });
});
