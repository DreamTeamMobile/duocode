/**
 * Layout Components Unit Tests
 *
 * Tests for the new layout system including:
 * - Tab switching logic
 * - FAB toggle and panel state
 * - Unread message counter/badge logic
 * - Device-aware default states
 * - User preference storage
 * - Edge cases (rapid switching, animations)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Tab Management Implementation (mirrors src/components/)
// ============================================================================

const ACTIVE_TAB_KEY = 'duocode_active_tab';

type TabChangeCallback = (newTab: string, prevTab: string) => void;

interface TabManager {
  ACTIVE_TAB_KEY: string;
  getActiveTab(): string;
  setActiveTab(tabName: string): boolean;
  loadSavedTab(): string;
  saveActiveTab(): boolean;
  onTabChange(callback: TabChangeCallback): () => void;
  isValidTab(tabName: unknown): boolean;
}

/**
 * Tab Manager - handles tab switching logic
 */
const createTabManager = (): TabManager => {
  let activeTab: string = 'code';
  const listeners: TabChangeCallback[] = [];

  return {
    ACTIVE_TAB_KEY,

    getActiveTab(): string {
      return activeTab;
    },

    setActiveTab(tabName: string): boolean {
      if (tabName !== 'code' && tabName !== 'diagram') {
        return false;
      }
      const prevTab = activeTab;
      activeTab = tabName;
      listeners.forEach((fn: TabChangeCallback) => fn(tabName, prevTab));
      return true;
    },

    loadSavedTab(): string {
      try {
        const saved = localStorage.getItem(ACTIVE_TAB_KEY);
        if (saved === 'code' || saved === 'diagram') {
          activeTab = saved;
          return saved;
        }
      } catch (e) {
        // Ignore storage errors
      }
      return 'code';
    },

    saveActiveTab(): boolean {
      try {
        localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
        return true;
      } catch (e) {
        return false;
      }
    },

    onTabChange(callback: TabChangeCallback): () => void {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },

    isValidTab(tabName: unknown): boolean {
      return tabName === 'code' || tabName === 'diagram';
    }
  };
};

// ============================================================================
// Messages Panel & FAB Implementation (mirrors src/components/)
// ============================================================================

const MESSAGES_PREF_KEY = 'duocode_messages_panel_open';

type PanelStateCallback = (state: string, count?: number) => void;

interface MessagesPanelManager {
  PREF_KEY: string;
  isOpen(): boolean;
  open(savePreference?: boolean): void;
  close(savePreference?: boolean): void;
  toggle(savePreference?: boolean): void;
  getUnreadCount(): number;
  incrementUnread(): boolean;
  clearUnread(): void;
  getSavedPreference(): boolean | null;
  savePreference(isOpenPref: boolean): boolean;
  clearPreference(): boolean;
  getDefaultState(isMobileDevice?: boolean): boolean;
  getInitialState(isMobileDevice?: boolean): boolean;
  initialize(isMobileDevice?: boolean): boolean;
  onStateChange(callback: PanelStateCallback): () => void;
}

/**
 * Messages Panel Manager - handles FAB toggle, unread badge, panel state
 */
const createMessagesPanelManager = (isMobile: boolean = false): MessagesPanelManager => {
  let isOpen = false;
  let unreadCount = 0;
  const listeners: PanelStateCallback[] = [];

  const manager: MessagesPanelManager = {
    PREF_KEY: MESSAGES_PREF_KEY,

    isOpen(): boolean {
      return isOpen;
    },

    open(savePreference: boolean = true): void {
      isOpen = true;
      unreadCount = 0; // Clear unread on open
      if (savePreference) {
        manager.savePreference(true);
      }
      listeners.forEach((fn: PanelStateCallback) => fn('open'));
    },

    close(savePreference: boolean = true): void {
      isOpen = false;
      if (savePreference) {
        manager.savePreference(false);
      }
      listeners.forEach((fn: PanelStateCallback) => fn('close'));
    },

    toggle(savePreference: boolean = true): void {
      if (isOpen) {
        manager.close(savePreference);
      } else {
        manager.open(savePreference);
      }
    },

    getUnreadCount(): number {
      return unreadCount;
    },

    incrementUnread(): boolean {
      if (!isOpen) {
        unreadCount++;
        listeners.forEach((fn: PanelStateCallback) => fn('unread', unreadCount));
        return true;
      }
      return false;
    },

    clearUnread(): void {
      unreadCount = 0;
      listeners.forEach((fn: PanelStateCallback) => fn('unread', 0));
    },

    getSavedPreference(): boolean | null {
      try {
        const pref = localStorage.getItem(manager.PREF_KEY);
        if (pref !== null) {
          return pref === 'true';
        }
      } catch (e) {
        // Ignore
      }
      return null;
    },

    savePreference(isOpenPref: boolean): boolean {
      try {
        localStorage.setItem(manager.PREF_KEY, String(isOpenPref));
        return true;
      } catch (e) {
        return false;
      }
    },

    clearPreference(): boolean {
      try {
        localStorage.removeItem(manager.PREF_KEY);
        return true;
      } catch (e) {
        return false;
      }
    },

    getDefaultState(isMobileDevice: boolean = isMobile): boolean {
      return !isMobileDevice; // Desktop: open, Mobile: closed
    },

    getInitialState(isMobileDevice: boolean = isMobile): boolean {
      const saved = manager.getSavedPreference();
      if (saved !== null) {
        return saved;
      }
      return manager.getDefaultState(isMobileDevice);
    },

    initialize(isMobileDevice: boolean = isMobile): boolean {
      const shouldBeOpen = manager.getInitialState(isMobileDevice);
      if (shouldBeOpen) {
        manager.open(false); // Don't save on init
      }
      return shouldBeOpen;
    },

    onStateChange(callback: PanelStateCallback): () => void {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }
  };

  return manager;
};

// ============================================================================
// Unread Badge Formatter (mirrors updateUnreadBadge in app.js)
// ============================================================================

interface BadgeResult {
  visible: boolean;
  text: string;
}

function formatUnreadBadge(count: number): BadgeResult {
  if (count <= 0) {
    return { visible: false, text: '' };
  }
  if (count > 99) {
    return { visible: true, text: '99+' };
  }
  return { visible: true, text: String(count) };
}

// ============================================================================
// Tests
// ============================================================================

describe('Tab Switching Logic', () => {
  let tabManager: TabManager;

  beforeEach(() => {
    localStorage.clear();
    tabManager = createTabManager();
  });

  describe('Basic Tab Operations', () => {
    it('should default to code tab', () => {
      expect(tabManager.getActiveTab()).toBe('code');
    });

    it('should switch to diagram tab', () => {
      tabManager.setActiveTab('diagram');
      expect(tabManager.getActiveTab()).toBe('diagram');
    });

    it('should switch back to code tab', () => {
      tabManager.setActiveTab('diagram');
      tabManager.setActiveTab('code');
      expect(tabManager.getActiveTab()).toBe('code');
    });

    it('should reject invalid tab names', () => {
      const result = tabManager.setActiveTab('invalid');
      expect(result).toBe(false);
      expect(tabManager.getActiveTab()).toBe('code');
    });

    it('should validate tab names', () => {
      expect(tabManager.isValidTab('code')).toBe(true);
      expect(tabManager.isValidTab('diagram')).toBe(true);
      expect(tabManager.isValidTab('other')).toBe(false);
      expect(tabManager.isValidTab('')).toBe(false);
      expect(tabManager.isValidTab(null)).toBe(false);
    });
  });

  describe('Tab Persistence', () => {
    it('should save active tab to localStorage', () => {
      tabManager.setActiveTab('diagram');
      tabManager.saveActiveTab();
      expect(localStorage.getItem(ACTIVE_TAB_KEY)).toBe('diagram');
    });

    it('should load saved tab from localStorage', () => {
      localStorage.setItem(ACTIVE_TAB_KEY, 'diagram');
      const loaded = tabManager.loadSavedTab();
      expect(loaded).toBe('diagram');
      expect(tabManager.getActiveTab()).toBe('diagram');
    });

    it('should default to code when no saved preference', () => {
      const loaded = tabManager.loadSavedTab();
      expect(loaded).toBe('code');
    });

    it('should ignore invalid saved values', () => {
      localStorage.setItem(ACTIVE_TAB_KEY, 'invalid');
      const loaded = tabManager.loadSavedTab();
      expect(loaded).toBe('code');
    });
  });

  describe('Tab Change Events', () => {
    it('should notify listeners on tab change', () => {
      const listener = vi.fn();
      tabManager.onTabChange(listener);

      tabManager.setActiveTab('diagram');
      expect(listener).toHaveBeenCalledWith('diagram', 'code');
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      tabManager.onTabChange(listener1);
      tabManager.onTabChange(listener2);

      tabManager.setActiveTab('diagram');
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should allow unsubscribing listeners', () => {
      const listener = vi.fn();
      const unsubscribe = tabManager.onTabChange(listener);

      unsubscribe();
      tabManager.setActiveTab('diagram');
      expect(listener).not.toHaveBeenCalled();
    });

    it('should not notify on invalid tab switch', () => {
      const listener = vi.fn();
      tabManager.onTabChange(listener);

      tabManager.setActiveTab('invalid');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Rapid Tab Switching', () => {
    it('should handle rapid switches correctly', () => {
      for (let i = 0; i < 100; i++) {
        tabManager.setActiveTab(i % 2 === 0 ? 'diagram' : 'code');
      }
      // i=99 is last iteration, 99 % 2 = 1, so 'code' is set last
      expect(tabManager.getActiveTab()).toBe('code');
    });

    it('should notify for each rapid switch', () => {
      const listener = vi.fn();
      tabManager.onTabChange(listener);

      tabManager.setActiveTab('diagram');
      tabManager.setActiveTab('code');
      tabManager.setActiveTab('diagram');
      tabManager.setActiveTab('code');

      expect(listener).toHaveBeenCalledTimes(4);
    });
  });
});

describe('FAB Toggle and Panel State', () => {
  let panelManager: MessagesPanelManager;

  beforeEach(() => {
    localStorage.clear();
    panelManager = createMessagesPanelManager();
  });

  describe('Basic Panel Operations', () => {
    it('should start closed by default', () => {
      expect(panelManager.isOpen()).toBe(false);
    });

    it('should open panel', () => {
      panelManager.open();
      expect(panelManager.isOpen()).toBe(true);
    });

    it('should close panel', () => {
      panelManager.open();
      panelManager.close();
      expect(panelManager.isOpen()).toBe(false);
    });

    it('should toggle panel open', () => {
      panelManager.toggle();
      expect(panelManager.isOpen()).toBe(true);
    });

    it('should toggle panel closed', () => {
      panelManager.open();
      panelManager.toggle();
      expect(panelManager.isOpen()).toBe(false);
    });
  });

  describe('Preference Persistence', () => {
    it('should save open preference', () => {
      panelManager.open();
      expect(localStorage.getItem(MESSAGES_PREF_KEY)).toBe('true');
    });

    it('should save close preference', () => {
      panelManager.open();
      panelManager.close();
      expect(localStorage.getItem(MESSAGES_PREF_KEY)).toBe('false');
    });

    it('should not save when savePreference is false', () => {
      panelManager.open(false);
      expect(localStorage.getItem(MESSAGES_PREF_KEY)).toBeNull();
    });

    it('should load saved preference', () => {
      localStorage.setItem(MESSAGES_PREF_KEY, 'true');
      expect(panelManager.getSavedPreference()).toBe(true);

      localStorage.setItem(MESSAGES_PREF_KEY, 'false');
      expect(panelManager.getSavedPreference()).toBe(false);
    });

    it('should return null when no preference saved', () => {
      expect(panelManager.getSavedPreference()).toBeNull();
    });

    it('should clear preference', () => {
      localStorage.setItem(MESSAGES_PREF_KEY, 'true');
      panelManager.clearPreference();
      expect(localStorage.getItem(MESSAGES_PREF_KEY)).toBeNull();
    });
  });

  describe('State Change Events', () => {
    it('should notify on open', () => {
      const listener = vi.fn();
      panelManager.onStateChange(listener);

      panelManager.open();
      expect(listener).toHaveBeenCalledWith('open');
    });

    it('should notify on close', () => {
      const listener = vi.fn();
      panelManager.onStateChange(listener);

      panelManager.open();
      panelManager.close();
      expect(listener).toHaveBeenCalledWith('close');
    });

    it('should allow unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = panelManager.onStateChange(listener);

      unsubscribe();
      panelManager.open();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Rapid Toggle', () => {
    it('should handle rapid toggles', () => {
      for (let i = 0; i < 50; i++) {
        panelManager.toggle();
      }
      expect(panelManager.isOpen()).toBe(false); // 50 toggles = even = closed
    });

    it('should handle rapid open/close', () => {
      for (let i = 0; i < 100; i++) {
        panelManager.open();
        panelManager.close();
      }
      expect(panelManager.isOpen()).toBe(false);
    });
  });
});

describe('Unread Message Counter/Badge Logic', () => {
  let panelManager: MessagesPanelManager;

  beforeEach(() => {
    localStorage.clear();
    panelManager = createMessagesPanelManager();
  });

  describe('Unread Counter', () => {
    it('should start with zero unread', () => {
      expect(panelManager.getUnreadCount()).toBe(0);
    });

    it('should increment unread when panel is closed', () => {
      panelManager.incrementUnread();
      expect(panelManager.getUnreadCount()).toBe(1);
    });

    it('should not increment unread when panel is open', () => {
      panelManager.open();
      const result = panelManager.incrementUnread();
      expect(result).toBe(false);
      expect(panelManager.getUnreadCount()).toBe(0);
    });

    it('should accumulate multiple unread messages', () => {
      panelManager.incrementUnread();
      panelManager.incrementUnread();
      panelManager.incrementUnread();
      expect(panelManager.getUnreadCount()).toBe(3);
    });

    it('should clear unread on open', () => {
      panelManager.incrementUnread();
      panelManager.incrementUnread();
      panelManager.open();
      expect(panelManager.getUnreadCount()).toBe(0);
    });

    it('should clear unread manually', () => {
      panelManager.incrementUnread();
      panelManager.incrementUnread();
      panelManager.clearUnread();
      expect(panelManager.getUnreadCount()).toBe(0);
    });
  });

  describe('Badge Display Format', () => {
    it('should show no badge for zero', () => {
      expect(formatUnreadBadge(0)).toEqual({ visible: false, text: '' });
    });

    it('should show single digit', () => {
      expect(formatUnreadBadge(1)).toEqual({ visible: true, text: '1' });
      expect(formatUnreadBadge(9)).toEqual({ visible: true, text: '9' });
    });

    it('should show double digits', () => {
      expect(formatUnreadBadge(10)).toEqual({ visible: true, text: '10' });
      expect(formatUnreadBadge(99)).toEqual({ visible: true, text: '99' });
    });

    it('should cap at 99+', () => {
      expect(formatUnreadBadge(100)).toEqual({ visible: true, text: '99+' });
      expect(formatUnreadBadge(150)).toEqual({ visible: true, text: '99+' });
      expect(formatUnreadBadge(999)).toEqual({ visible: true, text: '99+' });
    });

    it('should handle negative numbers', () => {
      expect(formatUnreadBadge(-1)).toEqual({ visible: false, text: '' });
    });
  });

  describe('Unread Event Notifications', () => {
    it('should notify on increment', () => {
      const listener = vi.fn();
      panelManager.onStateChange(listener);

      panelManager.incrementUnread();
      expect(listener).toHaveBeenCalledWith('unread', 1);
    });

    it('should notify with accumulated count', () => {
      const listener = vi.fn();
      panelManager.onStateChange(listener);

      panelManager.incrementUnread();
      panelManager.incrementUnread();
      panelManager.incrementUnread();

      expect(listener).toHaveBeenLastCalledWith('unread', 3);
    });

    it('should notify on clear', () => {
      const listener = vi.fn();
      panelManager.onStateChange(listener);

      panelManager.incrementUnread();
      panelManager.clearUnread();

      expect(listener).toHaveBeenLastCalledWith('unread', 0);
    });
  });

  describe('Messages During Panel Transition', () => {
    it('should not count messages when panel is opening', () => {
      // Panel starts closed, message arrives, then panel opens
      panelManager.incrementUnread();
      expect(panelManager.getUnreadCount()).toBe(1);

      panelManager.open();
      // Opening should clear the count
      expect(panelManager.getUnreadCount()).toBe(0);
    });

    it('should count messages immediately after closing', () => {
      panelManager.open();
      panelManager.close();

      // Message arrives after close
      const result = panelManager.incrementUnread();
      expect(result).toBe(true);
      expect(panelManager.getUnreadCount()).toBe(1);
    });
  });
});

describe('Device-Aware Default States', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Desktop Defaults', () => {
    it('should default panel open on desktop', () => {
      const panelManager = createMessagesPanelManager(false);
      expect(panelManager.getDefaultState(false)).toBe(true);
    });

    it('should initialize open on desktop with no preference', () => {
      const panelManager = createMessagesPanelManager(false);
      const result = panelManager.initialize(false);
      expect(result).toBe(true);
      expect(panelManager.isOpen()).toBe(true);
    });
  });

  describe('Mobile Defaults', () => {
    it('should default panel closed on mobile', () => {
      const panelManager = createMessagesPanelManager(true);
      expect(panelManager.getDefaultState(true)).toBe(false);
    });

    it('should initialize closed on mobile with no preference', () => {
      const panelManager = createMessagesPanelManager(true);
      const result = panelManager.initialize(true);
      expect(result).toBe(false);
      expect(panelManager.isOpen()).toBe(false);
    });
  });

  describe('Saved Preference Override', () => {
    it('should open on mobile if user saved open preference', () => {
      localStorage.setItem(MESSAGES_PREF_KEY, 'true');
      const panelManager = createMessagesPanelManager(true);
      const result = panelManager.initialize(true);
      expect(result).toBe(true);
      expect(panelManager.isOpen()).toBe(true);
    });

    it('should close on desktop if user saved close preference', () => {
      localStorage.setItem(MESSAGES_PREF_KEY, 'false');
      const panelManager = createMessagesPanelManager(false);
      const result = panelManager.initialize(false);
      expect(result).toBe(false);
      expect(panelManager.isOpen()).toBe(false);
    });
  });

  describe('Initial State Logic', () => {
    it('should prefer saved preference over device default', () => {
      localStorage.setItem(MESSAGES_PREF_KEY, 'false');
      const panelManager = createMessagesPanelManager(false); // Desktop would default open
      expect(panelManager.getInitialState(false)).toBe(false);
    });

    it('should fall back to device default when no preference', () => {
      const panelManager = createMessagesPanelManager(false);
      expect(panelManager.getInitialState(false)).toBe(true); // Desktop default

      const mobileManager = createMessagesPanelManager(true);
      expect(mobileManager.getInitialState(true)).toBe(false); // Mobile default
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('localStorage Errors', () => {
    it('should handle localStorage.getItem failure gracefully', () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn((): string | null => {
        throw new Error('Storage error');
      });

      const panelManager = createMessagesPanelManager();
      expect(panelManager.getSavedPreference()).toBeNull();

      localStorage.getItem = originalGetItem;
    });

    it('should handle localStorage.setItem failure gracefully', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn((): void => {
        throw new Error('Storage full');
      });

      const panelManager = createMessagesPanelManager();
      const result = panelManager.savePreference(true);
      expect(result).toBe(false);

      localStorage.setItem = originalSetItem;
    });

    it('should handle localStorage.removeItem failure gracefully', () => {
      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = vi.fn((): void => {
        throw new Error('Storage error');
      });

      const panelManager = createMessagesPanelManager();
      const result = panelManager.clearPreference();
      expect(result).toBe(false);

      localStorage.removeItem = originalRemoveItem;
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle very high unread counts', () => {
      const panelManager = createMessagesPanelManager();
      for (let i = 0; i < 1000; i++) {
        panelManager.incrementUnread();
      }
      expect(panelManager.getUnreadCount()).toBe(1000);
      expect(formatUnreadBadge(1000)).toEqual({ visible: true, text: '99+' });
    });

    it('should handle concurrent state changes', () => {
      const panelManager = createMessagesPanelManager();
      const results: (boolean | number)[] = [];

      // Simulate rapid state changes
      results.push(panelManager.isOpen()); // false
      panelManager.open();
      results.push(panelManager.isOpen()); // true
      panelManager.incrementUnread();
      results.push(panelManager.getUnreadCount()); // 0 (panel open)
      panelManager.close();
      panelManager.incrementUnread();
      results.push(panelManager.getUnreadCount()); // 1
      panelManager.toggle();
      results.push(panelManager.getUnreadCount()); // 0 (opened, cleared)

      expect(results).toEqual([false, true, 0, 1, 0]);
    });
  });

  describe('Tab Switching During Animation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle rapid tab switches with delayed handlers', () => {
      const tabManager = createTabManager();
      const delayedHandler = vi.fn();

      tabManager.onTabChange((newTab: string, oldTab: string) => {
        // Simulate delayed operation (like canvas resize)
        setTimeout(() => delayedHandler(newTab, oldTab), 50);
      });

      // Rapid switches
      tabManager.setActiveTab('diagram');
      tabManager.setActiveTab('code');
      tabManager.setActiveTab('diagram');
      tabManager.setActiveTab('code');

      // All handlers scheduled but not executed
      expect(delayedHandler).not.toHaveBeenCalled();

      // Let all delayed handlers run
      vi.advanceTimersByTime(100);

      // All handlers should have run
      expect(delayedHandler).toHaveBeenCalledTimes(4);
    });

    it('should maintain correct final state after rapid switches', () => {
      const tabManager = createTabManager();

      vi.useFakeTimers();

      // Rapid switches with artificial delays
      tabManager.setActiveTab('diagram');
      vi.advanceTimersByTime(10);
      tabManager.setActiveTab('code');
      vi.advanceTimersByTime(10);
      tabManager.setActiveTab('diagram');

      expect(tabManager.getActiveTab()).toBe('diagram');

      vi.useRealTimers();
    });
  });

  describe('Concurrent Unread Updates', () => {
    it('should handle many messages arriving at once', () => {
      const panelManager = createMessagesPanelManager();
      const listener = vi.fn();
      panelManager.onStateChange(listener);

      // Simulate burst of messages
      for (let i = 0; i < 50; i++) {
        panelManager.incrementUnread();
      }

      expect(panelManager.getUnreadCount()).toBe(50);
      expect(listener).toHaveBeenCalledTimes(50);
    });

    it('should handle open during message burst', () => {
      const panelManager = createMessagesPanelManager();

      // Some messages before open
      panelManager.incrementUnread();
      panelManager.incrementUnread();
      expect(panelManager.getUnreadCount()).toBe(2);

      // Open panel
      panelManager.open();
      expect(panelManager.getUnreadCount()).toBe(0);

      // Try more increments while open
      panelManager.incrementUnread();
      panelManager.incrementUnread();
      expect(panelManager.getUnreadCount()).toBe(0);
    });
  });

  describe('Invalid Preference Values', () => {
    it('should handle non-boolean string values', () => {
      localStorage.setItem(MESSAGES_PREF_KEY, 'yes');
      const panelManager = createMessagesPanelManager();
      expect(panelManager.getSavedPreference()).toBe(false); // 'yes' !== 'true'
    });

    it('should handle empty string preference', () => {
      localStorage.setItem(MESSAGES_PREF_KEY, '');
      const panelManager = createMessagesPanelManager();
      // Our mock localStorage returns null for empty strings (falsy values)
      // This is reasonable behavior - treating empty string as "not set"
      expect(panelManager.getSavedPreference()).toBeNull();
    });

    it('should handle numeric string values', () => {
      localStorage.setItem(MESSAGES_PREF_KEY, '1');
      const panelManager = createMessagesPanelManager();
      expect(panelManager.getSavedPreference()).toBe(false); // '1' !== 'true'
    });
  });
});

describe('Integration Scenarios', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('New User Flow', () => {
    it('should work correctly for new desktop user', () => {
      const tabManager = createTabManager();
      const panelManager = createMessagesPanelManager(false);

      // Load tabs (no saved preference)
      const savedTab = tabManager.loadSavedTab();
      expect(savedTab).toBe('code');

      // Initialize panel (no saved preference, desktop default)
      panelManager.initialize(false);
      expect(panelManager.isOpen()).toBe(true);

      // User switches to diagram
      tabManager.setActiveTab('diagram');
      tabManager.saveActiveTab();

      // User closes panel
      panelManager.close();

      // Verify persisted
      expect(localStorage.getItem(ACTIVE_TAB_KEY)).toBe('diagram');
      expect(localStorage.getItem(MESSAGES_PREF_KEY)).toBe('false');
    });

    it('should work correctly for new mobile user', () => {
      const tabManager = createTabManager();
      const panelManager = createMessagesPanelManager(true);

      // Initialize panel (no saved preference, mobile default)
      panelManager.initialize(true);
      expect(panelManager.isOpen()).toBe(false);

      // Messages arrive while panel is closed
      panelManager.incrementUnread();
      panelManager.incrementUnread();
      panelManager.incrementUnread();
      expect(panelManager.getUnreadCount()).toBe(3);

      // User opens panel
      panelManager.open();
      expect(panelManager.getUnreadCount()).toBe(0);
      expect(panelManager.isOpen()).toBe(true);

      // Verify preference saved
      expect(localStorage.getItem(MESSAGES_PREF_KEY)).toBe('true');
    });
  });

  describe('Returning User Flow', () => {
    it('should restore previous session state', () => {
      // Set up previous session state
      localStorage.setItem(ACTIVE_TAB_KEY, 'diagram');
      localStorage.setItem(MESSAGES_PREF_KEY, 'false');

      const tabManager = createTabManager();
      const panelManager = createMessagesPanelManager(false);

      // Load saved state
      const savedTab = tabManager.loadSavedTab();
      expect(savedTab).toBe('diagram');
      expect(tabManager.getActiveTab()).toBe('diagram');

      // Initialize panel with saved preference
      panelManager.initialize(false);
      expect(panelManager.isOpen()).toBe(false);
    });
  });

  describe('Cross-Device Sync Scenario', () => {
    it('should handle user opening on mobile then desktop', () => {
      // User sets preference on mobile
      localStorage.setItem(MESSAGES_PREF_KEY, 'true');

      // Load on desktop - should respect saved preference
      const panelManager = createMessagesPanelManager(false);
      expect(panelManager.getInitialState(false)).toBe(true);
    });

    it('should handle user closing on desktop then mobile', () => {
      // User sets preference on desktop
      localStorage.setItem(MESSAGES_PREF_KEY, 'false');

      // Load on mobile - should respect saved preference
      const panelManager = createMessagesPanelManager(true);
      expect(panelManager.getInitialState(true)).toBe(false);
    });
  });
});

describe('Stress Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should handle 1000 tab switches', () => {
    const tabManager = createTabManager();
    const changeCount: Record<string, number> = { code: 0, diagram: 0 };

    tabManager.onTabChange((tab: string) => {
      changeCount[tab]++;
    });

    for (let i = 0; i < 1000; i++) {
      tabManager.setActiveTab(i % 2 === 0 ? 'code' : 'diagram');
    }

    expect(changeCount.code).toBe(500);
    expect(changeCount.diagram).toBe(500);
  });

  it('should handle 1000 panel toggles', () => {
    const panelManager = createMessagesPanelManager();
    let openCount = 0;
    let closeCount = 0;

    panelManager.onStateChange((state: string) => {
      if (state === 'open') openCount++;
      if (state === 'close') closeCount++;
    });

    for (let i = 0; i < 1000; i++) {
      panelManager.toggle();
    }

    expect(openCount).toBe(500);
    expect(closeCount).toBe(500);
  });

  it('should handle mixed operations stress test', () => {
    const tabManager = createTabManager();
    const panelManager = createMessagesPanelManager();

    for (let i = 0; i < 500; i++) {
      // Tab switch
      tabManager.setActiveTab(i % 2 === 0 ? 'code' : 'diagram');

      // Panel operation
      if (i % 3 === 0) {
        panelManager.toggle();
      }

      // Message when closed
      if (!panelManager.isOpen()) {
        panelManager.incrementUnread();
      }
    }

    // Final state should be consistent
    expect(['code', 'diagram']).toContain(tabManager.getActiveTab());
    expect(typeof panelManager.isOpen()).toBe('boolean');
    expect(panelManager.getUnreadCount()).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Mobile Header Layout Tests
// ============================================================================

interface Rect {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  height?: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  elements?: {
    headerLeft: Element | null;
    headerRight: Element | null;
    title: Element | null;
    version: Element | null;
    syncIndicator: Element | null;
    timer: Element | null;
    connectionStatus: Element | null;
    buttons: Element[];
  };
}

interface AlignmentResult {
  valid: boolean;
  reason?: string;
  titleCenter?: number;
  buttonsCenter?: number;
  difference?: number;
}

interface PositionResult {
  valid: boolean;
  reason?: string;
  titleBottom?: number;
  statusTop?: number;
}

interface MobileHeaderLayoutValidator {
  MOBILE_BREAKPOINT: number;
  isMobileViewport(width: number): boolean;
  validateMobileHeaderStructure(headerElement: Element): ValidationResult;
  checkNoOverlap(rect1: Rect | null | undefined, rect2: Rect | null | undefined): boolean;
  validateFirstRowAlignment(titleRect: Rect | null | undefined, buttonsRect: Rect | null | undefined, tolerance?: number): AlignmentResult;
  validateSecondRowPosition(titleRect: Rect | null | undefined, statusRect: Rect | null | undefined, minGap?: number): PositionResult;
}

describe('Mobile Header Layout', () => {
  /**
   * Mobile Header Layout Manager
   * Validates the expected structure and behavior of the mobile header
   */
  const createMobileHeaderLayoutValidator = (): MobileHeaderLayoutValidator => {
    const MOBILE_BREAKPOINT = 768;

    return {
      MOBILE_BREAKPOINT,

      /**
       * Check if current viewport is mobile
       */
      isMobileViewport(width: number): boolean {
        return width <= MOBILE_BREAKPOINT;
      },

      /**
       * Validate header structure for mobile
       * Expected structure:
       * - Row 1: Title (left) + Buttons (right)
       * - Row 2: Version, Sync indicator, Timer, Connection status
       */
      validateMobileHeaderStructure(headerElement: Element): ValidationResult {
        const errors: string[] = [];

        // Check header-left exists
        const headerLeft = headerElement.querySelector('.header-left');
        if (!headerLeft) {
          errors.push('Missing .header-left element');
          return { valid: false, errors };
        }

        // Check header-right exists
        const headerRight = headerElement.querySelector('.header-right');
        if (!headerRight) {
          errors.push('Missing .header-right element');
          return { valid: false, errors };
        }

        // Check title exists in header-left
        const title = headerLeft.querySelector('h1');
        if (!title) {
          errors.push('Missing h1 title in header-left');
        }

        // Check status elements exist in header-left
        const version = headerLeft.querySelector('.app-version');
        const syncIndicator = headerLeft.querySelector('.sync-indicator');
        const timer = headerLeft.querySelector('.session-timer');
        const connectionStatus = headerLeft.querySelector('.connection-status');

        if (!version) errors.push('Missing .app-version element');
        if (!syncIndicator) errors.push('Missing .sync-indicator element');
        if (!timer) errors.push('Missing .session-timer element');
        if (!connectionStatus) errors.push('Missing .connection-status element');

        // Check buttons exist in header-right
        const buttons = headerRight.querySelectorAll('.icon-btn');
        if (buttons.length < 3) {
          errors.push(`Expected at least 3 icon buttons, found ${buttons.length}`);
        }

        return {
          valid: errors.length === 0,
          errors,
          elements: {
            headerLeft,
            headerRight,
            title,
            version,
            syncIndicator,
            timer,
            connectionStatus,
            buttons: Array.from(buttons)
          }
        };
      },

      /**
       * Check that elements don't visually overlap
       * Takes bounding rectangles of elements
       */
      checkNoOverlap(rect1: Rect | null | undefined, rect2: Rect | null | undefined): boolean {
        if (!rect1 || !rect2) return true; // Can't check if missing

        const horizontalOverlap = (rect1.left ?? 0) < (rect2.right ?? 0) && (rect1.right ?? 0) > (rect2.left ?? 0);
        const verticalOverlap = (rect1.top ?? 0) < (rect2.bottom ?? 0) && (rect1.bottom ?? 0) > (rect2.top ?? 0);

        return !(horizontalOverlap && verticalOverlap);
      },

      /**
       * Validate that title and buttons are on the same row
       * (their vertical centers should be approximately aligned)
       */
      validateFirstRowAlignment(titleRect: Rect | null | undefined, buttonsRect: Rect | null | undefined, tolerance: number = 20): AlignmentResult {
        if (!titleRect || !buttonsRect) return { valid: false, reason: 'Missing elements' };

        const titleCenter = (titleRect.top ?? 0) + (titleRect.height ?? 0) / 2;
        const buttonsCenter = (buttonsRect.top ?? 0) + (buttonsRect.height ?? 0) / 2;

        const aligned = Math.abs(titleCenter - buttonsCenter) <= tolerance;

        return {
          valid: aligned,
          titleCenter,
          buttonsCenter,
          difference: Math.abs(titleCenter - buttonsCenter)
        };
      },

      /**
       * Validate that status elements are below the title
       */
      validateSecondRowPosition(titleRect: Rect | null | undefined, statusRect: Rect | null | undefined, minGap: number = 0): PositionResult {
        if (!titleRect || !statusRect) return { valid: false, reason: 'Missing elements' };

        const statusBelowTitle = (statusRect.top ?? 0) >= (titleRect.bottom ?? 0) - minGap;

        return {
          valid: statusBelowTitle,
          titleBottom: titleRect.bottom,
          statusTop: statusRect.top
        };
      }
    };
  };

  describe('Structure Validation', () => {
    it('should identify mobile viewport correctly', () => {
      const validator = createMobileHeaderLayoutValidator();

      expect(validator.isMobileViewport(320)).toBe(true);
      expect(validator.isMobileViewport(768)).toBe(true);
      expect(validator.isMobileViewport(769)).toBe(false);
      expect(validator.isMobileViewport(1024)).toBe(false);
    });

    it('should validate header structure with all required elements', () => {
      const validator = createMobileHeaderLayoutValidator();

      // Create mock header DOM
      const header = document.createElement('header');
      header.innerHTML = `
        <div class="header-left">
          <h1>DuoCode</h1>
          <span class="app-version">v2.1</span>
          <span class="sync-indicator"></span>
          <span class="session-timer">00:00:00</span>
          <span class="connection-status">
            <span class="conn-mode">P2P</span>
            <span class="conn-latency">10ms</span>
          </span>
        </div>
        <div class="header-right">
          <button class="icon-btn">New</button>
          <button class="icon-btn">Theme</button>
          <button class="icon-btn">Export</button>
        </div>
      `;

      const result = validator.validateMobileHeaderStructure(header);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.elements!.title).toBeTruthy();
      expect(result.elements!.buttons).toHaveLength(3);
    });

    it('should detect missing elements', () => {
      const validator = createMobileHeaderLayoutValidator();

      // Create incomplete header
      const header = document.createElement('header');
      header.innerHTML = `
        <div class="header-left">
          <h1>DuoCode</h1>
        </div>
        <div class="header-right">
          <button class="icon-btn">New</button>
        </div>
      `;

      const result = validator.validateMobileHeaderStructure(header);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing .app-version element');
      expect(result.errors).toContain('Missing .sync-indicator element');
      expect(result.errors).toContain('Missing .session-timer element');
      expect(result.errors).toContain('Missing .connection-status element');
    });

    it('should detect missing header-left', () => {
      const validator = createMobileHeaderLayoutValidator();

      const header = document.createElement('header');
      header.innerHTML = `<div class="header-right"></div>`;

      const result = validator.validateMobileHeaderStructure(header);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing .header-left element');
    });
  });

  describe('Overlap Detection', () => {
    it('should detect overlapping rectangles', () => {
      const validator = createMobileHeaderLayoutValidator();

      const rect1: Rect = { left: 0, right: 100, top: 0, bottom: 50 };
      const rect2: Rect = { left: 50, right: 150, top: 25, bottom: 75 };

      expect(validator.checkNoOverlap(rect1, rect2)).toBe(false);
    });

    it('should pass for non-overlapping rectangles', () => {
      const validator = createMobileHeaderLayoutValidator();

      const rect1: Rect = { left: 0, right: 100, top: 0, bottom: 50 };
      const rect2: Rect = { left: 150, right: 250, top: 0, bottom: 50 };

      expect(validator.checkNoOverlap(rect1, rect2)).toBe(true);
    });

    it('should pass for vertically separated rectangles', () => {
      const validator = createMobileHeaderLayoutValidator();

      const rect1: Rect = { left: 0, right: 100, top: 0, bottom: 50 };
      const rect2: Rect = { left: 0, right: 100, top: 60, bottom: 110 };

      expect(validator.checkNoOverlap(rect1, rect2)).toBe(true);
    });

    it('should handle adjacent rectangles (no overlap)', () => {
      const validator = createMobileHeaderLayoutValidator();

      const rect1: Rect = { left: 0, right: 100, top: 0, bottom: 50 };
      const rect2: Rect = { left: 100, right: 200, top: 0, bottom: 50 };

      expect(validator.checkNoOverlap(rect1, rect2)).toBe(true);
    });
  });

  describe('Row Alignment', () => {
    it('should validate first row alignment when title and buttons are aligned', () => {
      const validator = createMobileHeaderLayoutValidator();

      // Title and buttons on same row (similar vertical position)
      const titleRect: Rect = { top: 10, bottom: 40, height: 30 };
      const buttonsRect: Rect = { top: 12, bottom: 42, height: 30 };

      const result = validator.validateFirstRowAlignment(titleRect, buttonsRect);

      expect(result.valid).toBe(true);
      expect(result.difference!).toBeLessThanOrEqual(20);
    });

    it('should fail alignment when title and buttons are on different rows', () => {
      const validator = createMobileHeaderLayoutValidator();

      // Title and buttons on different rows
      const titleRect: Rect = { top: 10, bottom: 40, height: 30 };
      const buttonsRect: Rect = { top: 50, bottom: 80, height: 30 };

      const result = validator.validateFirstRowAlignment(titleRect, buttonsRect);

      expect(result.valid).toBe(false);
    });

    it('should validate second row position when status is below title', () => {
      const validator = createMobileHeaderLayoutValidator();

      const titleRect: Rect = { bottom: 40 };
      const statusRect: Rect = { top: 45 };

      const result = validator.validateSecondRowPosition(titleRect, statusRect);

      expect(result.valid).toBe(true);
    });

    it('should fail when status overlaps with title vertically', () => {
      const validator = createMobileHeaderLayoutValidator();

      const titleRect: Rect = { bottom: 40 };
      const statusRect: Rect = { top: 30 }; // Overlaps with title

      const result = validator.validateSecondRowPosition(titleRect, statusRect);

      expect(result.valid).toBe(false);
    });
  });

  describe('Connection Status Display', () => {
    it('should have connection status visible in header-left', () => {
      const validator = createMobileHeaderLayoutValidator();

      const header = document.createElement('header');
      header.innerHTML = `
        <div class="header-left">
          <h1>DuoCode</h1>
          <span class="app-version">v2.1</span>
          <span class="sync-indicator"></span>
          <span class="session-timer">00:00:00</span>
          <span class="connection-status">
            <span class="conn-mode">P2P</span>
            <span class="conn-latency">10ms</span>
          </span>
        </div>
        <div class="header-right">
          <button class="icon-btn">New</button>
          <button class="icon-btn">Theme</button>
          <button class="icon-btn">Export</button>
        </div>
      `;

      const result = validator.validateMobileHeaderStructure(header);
      const connectionStatus = result.elements!.connectionStatus!;

      expect(connectionStatus).toBeTruthy();
      expect(connectionStatus.querySelector('.conn-mode')).toBeTruthy();
      expect(connectionStatus.querySelector('.conn-latency')).toBeTruthy();
    });

    it('should have connection mode and latency elements', () => {
      const header = document.createElement('header');
      header.innerHTML = `
        <div class="header-left">
          <span class="connection-status">
            <span class="conn-mode p2p">P2P</span>
            <span class="conn-latency low">10ms</span>
          </span>
        </div>
        <div class="header-right"></div>
      `;

      const connStatus = header.querySelector('.connection-status')!;
      const connMode = connStatus.querySelector('.conn-mode')!;
      const connLatency = connStatus.querySelector('.conn-latency')!;

      expect(connMode.textContent).toBe('P2P');
      expect(connMode.classList.contains('p2p')).toBe(true);
      expect(connLatency.textContent).toBe('10ms');
      expect(connLatency.classList.contains('low')).toBe(true);
    });
  });
});
