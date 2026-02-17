import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../../src/stores/uiStore.js';

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have correct defaults', () => {
      const state = useUIStore.getState();
      expect(state.activeTab).toBe('code');
      expect(state.theme).toBe('dark');
      expect(state.isNameModalOpen).toBe(false);
      expect(state.isNewSessionModalOpen).toBe(false);
    });
  });

  describe('switchTab', () => {
    it('should update activeTab', () => {
      useUIStore.getState().switchTab('diagram');
      expect(useUIStore.getState().activeTab).toBe('diagram');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from dark to light', () => {
      useUIStore.getState().toggleTheme();
      expect(useUIStore.getState().theme).toBe('light');
    });

    it('should toggle from light to dark', () => {
      useUIStore.getState().toggleTheme(); // dark → light
      useUIStore.getState().toggleTheme(); // light → dark
      expect(useUIStore.getState().theme).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('should set theme directly', () => {
      useUIStore.getState().setTheme('light');
      expect(useUIStore.getState().theme).toBe('light');
    });
  });

  describe('showNameModal / hideNameModal', () => {
    it('should open the name modal', () => {
      useUIStore.getState().showNameModal();
      expect(useUIStore.getState().isNameModalOpen).toBe(true);
    });

    it('should close the name modal', () => {
      useUIStore.getState().showNameModal();
      useUIStore.getState().hideNameModal();
      expect(useUIStore.getState().isNameModalOpen).toBe(false);
    });
  });

  describe('showNewSessionModal / hideNewSessionModal', () => {
    it('should open the new session modal', () => {
      useUIStore.getState().showNewSessionModal();
      expect(useUIStore.getState().isNewSessionModalOpen).toBe(true);
    });

    it('should close the new session modal', () => {
      useUIStore.getState().showNewSessionModal();
      useUIStore.getState().hideNewSessionModal();
      expect(useUIStore.getState().isNewSessionModalOpen).toBe(false);
    });
  });

  describe('reset', () => {
    it('should restore all defaults', () => {
      useUIStore.getState().switchTab('diagram');
      useUIStore.getState().toggleTheme();
      useUIStore.getState().showNameModal();
      useUIStore.getState().showNewSessionModal();
      useUIStore.getState().reset();
      const state = useUIStore.getState();
      expect(state.activeTab).toBe('code');
      expect(state.theme).toBe('dark');
      expect(state.isNameModalOpen).toBe(false);
      expect(state.isNewSessionModalOpen).toBe(false);
    });
  });
});
