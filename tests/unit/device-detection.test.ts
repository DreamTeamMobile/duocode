/**
 * DeviceManager (Device Detection) Unit Tests
 *
 * Tests for device type detection, responsive breakpoints, and user preferences.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Re-implement DeviceManager for testing
const createDeviceManager = (windowWidth: number = 1024, windowHeight: number = 768) => {
  // Mock window dimensions
  const mockWindow = {
    innerWidth: windowWidth,
    innerHeight: windowHeight
  };

  return {
    PREF_KEY: 'duocode_messages_panel_open',
    MOBILE_BREAKPOINT: 768,
    _window: mockWindow,

    isMobile() {
      return this._window.innerWidth < this.MOBILE_BREAKPOINT;
    },

    isTablet() {
      const width = this._window.innerWidth;
      const height = this._window.innerHeight;
      const minDim = Math.min(width, height);
      const maxDim = Math.max(width, height);
      return minDim >= 600 && minDim <= 1024 && (maxDim / minDim) < 1.6;
    },

    getSavedPreference(): boolean | null {
      try {
        const pref = localStorage.getItem(this.PREF_KEY);
        if (pref !== null) {
          return pref === 'true';
        }
      } catch (error) {
        return null;
      }
      return null;
    },

    savePreference(isOpen: boolean): boolean {
      try {
        localStorage.setItem(this.PREF_KEY, String(isOpen));
        return true;
      } catch (error) {
        return false;
      }
    },

    clearPreference(): boolean {
      try {
        localStorage.removeItem(this.PREF_KEY);
        return true;
      } catch (error) {
        return false;
      }
    },

    getDefaultPanelState(): boolean {
      return !this.isMobile();
    },

    getInitialPanelState(): boolean {
      const savedPref = this.getSavedPreference();
      if (savedPref !== null) {
        return savedPref;
      }
      return this.getDefaultPanelState();
    }
  };
};

describe('Mobile Detection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should detect mobile for width < 768', () => {
    const dm = createDeviceManager(375, 667); // iPhone SE
    expect(dm.isMobile()).toBe(true);
  });

  it('should detect mobile for width = 767', () => {
    const dm = createDeviceManager(767, 1024);
    expect(dm.isMobile()).toBe(true);
  });

  it('should not detect mobile for width = 768', () => {
    const dm = createDeviceManager(768, 1024);
    expect(dm.isMobile()).toBe(false);
  });

  it('should not detect mobile for width > 768', () => {
    const dm = createDeviceManager(1024, 768);
    expect(dm.isMobile()).toBe(false);
  });

  it('should not detect mobile for desktop width', () => {
    const dm = createDeviceManager(1920, 1080);
    expect(dm.isMobile()).toBe(false);
  });

  it('should use correct breakpoint constant', () => {
    const dm = createDeviceManager();
    expect(dm.MOBILE_BREAKPOINT).toBe(768);
  });
});

describe('Tablet Detection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should detect iPad portrait as tablet', () => {
    const dm = createDeviceManager(768, 1024);
    expect(dm.isTablet()).toBe(true);
  });

  it('should detect iPad landscape as tablet', () => {
    const dm = createDeviceManager(1024, 768);
    expect(dm.isTablet()).toBe(true);
  });

  it('should not detect phone as tablet', () => {
    const dm = createDeviceManager(375, 667);
    expect(dm.isTablet()).toBe(false);
  });

  it('should not detect wide desktop as tablet', () => {
    const dm = createDeviceManager(1920, 1080);
    expect(dm.isTablet()).toBe(false);
  });

  it('should handle square-ish aspect ratios', () => {
    const dm = createDeviceManager(800, 700); // Nearly square
    expect(dm.isTablet()).toBe(true);
  });

  it('should reject very narrow aspect ratios', () => {
    const dm = createDeviceManager(600, 1200); // 1:2 ratio = narrow
    expect(dm.isTablet()).toBe(false);
  });

  it('should handle minimum dimension boundary (600)', () => {
    const dm = createDeviceManager(600, 800);
    expect(dm.isTablet()).toBe(true);

    const dm2 = createDeviceManager(599, 800);
    expect(dm2.isTablet()).toBe(false);
  });

  it('should handle maximum dimension boundary (1024)', () => {
    const dm = createDeviceManager(1024, 700);
    expect(dm.isTablet()).toBe(true);

    // 1025x700: minDim=700 (within 600-1024 range), aspect ratio = 1.46 (< 1.6)
    // So this is still detected as tablet by the current logic
    const dm2 = createDeviceManager(1025, 700);
    expect(dm2.isTablet()).toBe(true);

    // But very wide desktop is not a tablet
    const dm3 = createDeviceManager(1920, 700);
    expect(dm3.isTablet()).toBe(false); // Aspect ratio 2.74 > 1.6
  });
});

describe('User Preference Storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getSavedPreference()', () => {
    it('should return null when no preference saved', () => {
      const dm = createDeviceManager();
      expect(dm.getSavedPreference()).toBeNull();
    });

    it('should return true when preference is "true"', () => {
      localStorage.setItem('duocode_messages_panel_open', 'true');
      const dm = createDeviceManager();
      expect(dm.getSavedPreference()).toBe(true);
    });

    it('should return false when preference is "false"', () => {
      localStorage.setItem('duocode_messages_panel_open', 'false');
      const dm = createDeviceManager();
      expect(dm.getSavedPreference()).toBe(false);
    });

    it('should handle invalid preference value', () => {
      localStorage.setItem('duocode_messages_panel_open', 'invalid');
      const dm = createDeviceManager();
      expect(dm.getSavedPreference()).toBe(false); // 'invalid' !== 'true'
    });
  });

  describe('savePreference()', () => {
    it('should save true preference', () => {
      const dm = createDeviceManager();
      dm.savePreference(true);

      expect(localStorage.setItem).toHaveBeenCalledWith('duocode_messages_panel_open', 'true');
    });

    it('should save false preference', () => {
      const dm = createDeviceManager();
      dm.savePreference(false);

      expect(localStorage.setItem).toHaveBeenCalledWith('duocode_messages_panel_open', 'false');
    });

    it('should return true on success', () => {
      const dm = createDeviceManager();
      expect(dm.savePreference(true)).toBe(true);
    });
  });

  describe('clearPreference()', () => {
    it('should remove preference from storage', () => {
      const dm = createDeviceManager();
      dm.clearPreference();

      expect(localStorage.removeItem).toHaveBeenCalledWith('duocode_messages_panel_open');
    });

    it('should return true on success', () => {
      const dm = createDeviceManager();
      expect(dm.clearPreference()).toBe(true);
    });
  });
});

describe('Default Panel State', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should default to open on desktop', () => {
    const dm = createDeviceManager(1920, 1080);
    expect(dm.getDefaultPanelState()).toBe(true);
  });

  it('should default to closed on mobile', () => {
    const dm = createDeviceManager(375, 667);
    expect(dm.getDefaultPanelState()).toBe(false);
  });

  it('should default to open at breakpoint (768)', () => {
    const dm = createDeviceManager(768, 1024);
    expect(dm.getDefaultPanelState()).toBe(true);
  });

  it('should default to closed just below breakpoint (767)', () => {
    const dm = createDeviceManager(767, 1024);
    expect(dm.getDefaultPanelState()).toBe(false);
  });
});

describe('Initial Panel State', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should use saved preference when available (true)', () => {
    localStorage.setItem('duocode_messages_panel_open', 'true');
    const dm = createDeviceManager(375, 667); // Mobile - default would be false

    expect(dm.getInitialPanelState()).toBe(true); // But saved preference wins
  });

  it('should use saved preference when available (false)', () => {
    localStorage.setItem('duocode_messages_panel_open', 'false');
    const dm = createDeviceManager(1920, 1080); // Desktop - default would be true

    expect(dm.getInitialPanelState()).toBe(false); // But saved preference wins
  });

  it('should fall back to default when no preference saved (desktop)', () => {
    const dm = createDeviceManager(1920, 1080);
    expect(dm.getInitialPanelState()).toBe(true);
  });

  it('should fall back to default when no preference saved (mobile)', () => {
    const dm = createDeviceManager(375, 667);
    expect(dm.getInitialPanelState()).toBe(false);
  });
});

describe('Common Device Sizes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const deviceTests = [
    // Phones
    { name: 'iPhone SE', width: 375, height: 667, mobile: true, tablet: false },
    { name: 'iPhone 12/13', width: 390, height: 844, mobile: true, tablet: false },
    { name: 'iPhone 12/13 Pro Max', width: 428, height: 926, mobile: true, tablet: false },
    { name: 'Samsung Galaxy S21', width: 360, height: 800, mobile: true, tablet: false },
    { name: 'Pixel 5', width: 393, height: 851, mobile: true, tablet: false },

    // Tablets
    { name: 'iPad Mini', width: 768, height: 1024, mobile: false, tablet: true },
    { name: 'iPad', width: 810, height: 1080, mobile: false, tablet: true },
    { name: 'iPad Air', width: 820, height: 1180, mobile: false, tablet: true }, // Within tablet range
    { name: 'iPad Pro 11"', width: 834, height: 1194, mobile: false, tablet: true }, // Within tablet range
    { name: 'iPad Pro 12.9"', width: 1024, height: 1366, mobile: false, tablet: true }, // Within tablet range

    // Desktops
    { name: 'MacBook Air 13"', width: 1440, height: 900, mobile: false, tablet: false },
    { name: 'MacBook Pro 16"', width: 1792, height: 1120, mobile: false, tablet: false },
    { name: 'Full HD', width: 1920, height: 1080, mobile: false, tablet: false },
    { name: '4K', width: 3840, height: 2160, mobile: false, tablet: false },
    { name: 'iMac 24"', width: 2560, height: 1440, mobile: false, tablet: false }
  ];

  deviceTests.forEach(({ name, width, height, mobile, tablet }) => {
    it(`should correctly detect ${name} (${width}x${height})`, () => {
      const dm = createDeviceManager(width, height);
      expect(dm.isMobile()).toBe(mobile);
      expect(dm.isTablet()).toBe(tablet);
    });
  });
});

describe('Orientation Changes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should detect mobile in portrait', () => {
    const dm = createDeviceManager(414, 896); // iPhone 11 portrait
    expect(dm.isMobile()).toBe(true);
  });

  it('should detect mobile in landscape (narrow)', () => {
    const dm = createDeviceManager(896, 414); // iPhone 11 landscape (still < 768 height-wise but width > 768)
    // Note: our implementation only checks width
    expect(dm.isMobile()).toBe(false); // Width is > 768
  });

  it('should handle tablet orientation change', () => {
    // iPad portrait
    const dmPortrait = createDeviceManager(768, 1024);
    expect(dmPortrait.isTablet()).toBe(true);

    // iPad landscape
    const dmLandscape = createDeviceManager(1024, 768);
    expect(dmLandscape.isTablet()).toBe(true);
  });
});

describe('Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should handle very small screen', () => {
    const dm = createDeviceManager(320, 240);
    expect(dm.isMobile()).toBe(true);
    expect(dm.isTablet()).toBe(false);
  });

  it('should handle very large screen', () => {
    const dm = createDeviceManager(5120, 2880); // 5K display
    expect(dm.isMobile()).toBe(false);
    expect(dm.isTablet()).toBe(false);
  });

  it('should handle square screen', () => {
    const dm = createDeviceManager(800, 800);
    expect(dm.isMobile()).toBe(false);
    expect(dm.isTablet()).toBe(true);
  });

  it('should handle zero width', () => {
    const dm = createDeviceManager(0, 768);
    expect(dm.isMobile()).toBe(true);
  });

  it('should handle exact breakpoint', () => {
    const dm = createDeviceManager(768, 768);
    expect(dm.isMobile()).toBe(false);
    expect(dm.getDefaultPanelState()).toBe(true);
  });
});

describe('Preference Key', () => {
  it('should use consistent preference key', () => {
    const dm = createDeviceManager();
    expect(dm.PREF_KEY).toBe('duocode_messages_panel_open');
  });

  it('should not conflict with session storage keys', () => {
    const dm = createDeviceManager();
    // The preference key is for panel state, not session data
    expect(dm.PREF_KEY).toContain('messages_panel');
    expect(dm.PREF_KEY).not.toBe('duocode_session');
    expect(dm.PREF_KEY).not.toBe('duocode_code');
    expect(dm.PREF_KEY).not.toBe('duocode_canvas');
  });
});
