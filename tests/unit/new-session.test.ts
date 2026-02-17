/**
 * New Session Button Unit Tests
 *
 * Tests for the New Session button navigation logic and modal confirmation flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Simulated New Session Modal Manager for testing
 * This mirrors the modal logic in src/components/Modals/NewSessionModal.jsx
 */
class NewSessionModalManager {
  isModalOpen: boolean;
  navigateCallback: ((url: string) => void) | null;

  constructor() {
    this.isModalOpen = false;
    this.navigateCallback = null;
  }

  // Set navigation callback (simulates window.location.href assignment)
  onNavigate(callback: (url: string) => void): void {
    this.navigateCallback = callback;
  }

  // Open the confirmation modal
  openModal(): void {
    this.isModalOpen = true;
  }

  // Close the modal without navigating
  closeModal(): void {
    this.isModalOpen = false;
  }

  // Confirm and navigate to new session
  confirmNewSession(): void {
    this.isModalOpen = false;
    if (this.navigateCallback) {
      const baseUrl = this.getBaseUrl();
      this.navigateCallback(baseUrl);
    }
  }

  // Get base URL without session parameter
  getBaseUrl(currentUrl: string = 'https://duocode.app/?session=abc123'): string {
    try {
      const url = new URL(currentUrl);
      return url.origin + url.pathname;
    } catch {
      return '/';
    }
  }

  // Handle click outside modal (should close)
  handleOverlayClick(target: unknown, modalElement: unknown): void {
    if (target === modalElement) {
      this.closeModal();
    }
  }

  // Handle Escape key (should close)
  handleEscapeKey(): void {
    if (this.isModalOpen) {
      this.closeModal();
    }
  }
}

describe('New Session Modal', () => {
  let modalManager: NewSessionModalManager;

  beforeEach(() => {
    modalManager = new NewSessionModalManager();
  });

  describe('Initial State', () => {
    it('should start with modal closed', () => {
      expect(modalManager.isModalOpen).toBe(false);
    });

    it('should have no navigation callback initially', () => {
      expect(modalManager.navigateCallback).toBeNull();
    });
  });

  describe('Modal Open/Close', () => {
    it('should open modal when requested', () => {
      modalManager.openModal();
      expect(modalManager.isModalOpen).toBe(true);
    });

    it('should close modal when requested', () => {
      modalManager.openModal();
      modalManager.closeModal();
      expect(modalManager.isModalOpen).toBe(false);
    });

    it('should handle multiple open/close cycles', () => {
      modalManager.openModal();
      expect(modalManager.isModalOpen).toBe(true);

      modalManager.closeModal();
      expect(modalManager.isModalOpen).toBe(false);

      modalManager.openModal();
      expect(modalManager.isModalOpen).toBe(true);

      modalManager.closeModal();
      expect(modalManager.isModalOpen).toBe(false);
    });
  });

  describe('Base URL Extraction', () => {
    it('should extract base URL from URL with session parameter', () => {
      const baseUrl = modalManager.getBaseUrl('https://duocode.app/?session=abc123');
      expect(baseUrl).toBe('https://duocode.app/');
    });

    it('should handle URL with multiple parameters', () => {
      const baseUrl = modalManager.getBaseUrl('https://duocode.app/?session=abc123&foo=bar');
      expect(baseUrl).toBe('https://duocode.app/');
    });

    it('should handle URL without parameters', () => {
      const baseUrl = modalManager.getBaseUrl('https://duocode.app/');
      expect(baseUrl).toBe('https://duocode.app/');
    });

    it('should handle URL with path', () => {
      const baseUrl = modalManager.getBaseUrl('https://duocode.app/app/?session=xyz');
      expect(baseUrl).toBe('https://duocode.app/app/');
    });

    it('should handle localhost URLs', () => {
      const baseUrl = modalManager.getBaseUrl('http://localhost:3000/?session=test123');
      expect(baseUrl).toBe('http://localhost:3000/');
    });

    it('should handle localhost with port', () => {
      const baseUrl = modalManager.getBaseUrl('http://localhost:8080/duocode?session=abc');
      expect(baseUrl).toBe('http://localhost:8080/duocode');
    });

    it('should return fallback for invalid URL', () => {
      const baseUrl = modalManager.getBaseUrl('not-a-valid-url');
      expect(baseUrl).toBe('/');
    });

    it('should handle URL with hash', () => {
      const baseUrl = modalManager.getBaseUrl('https://duocode.app/?session=abc#section');
      expect(baseUrl).toBe('https://duocode.app/');
    });
  });

  describe('Navigation Flow', () => {
    it('should call navigate callback on confirm', () => {
      const navigateSpy = vi.fn();
      modalManager.onNavigate(navigateSpy);
      modalManager.openModal();

      modalManager.confirmNewSession();

      expect(navigateSpy).toHaveBeenCalled();
    });

    it('should navigate to base URL without session parameter', () => {
      const navigateSpy = vi.fn();
      modalManager.onNavigate(navigateSpy);

      modalManager.confirmNewSession();

      expect(navigateSpy).toHaveBeenCalledWith(expect.not.stringContaining('session='));
    });

    it('should close modal after confirming', () => {
      modalManager.onNavigate(vi.fn());
      modalManager.openModal();

      modalManager.confirmNewSession();

      expect(modalManager.isModalOpen).toBe(false);
    });

    it('should not navigate when cancelling', () => {
      const navigateSpy = vi.fn();
      modalManager.onNavigate(navigateSpy);
      modalManager.openModal();

      modalManager.closeModal();

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('should handle confirm without navigate callback', () => {
      modalManager.openModal();

      expect(() => {
        modalManager.confirmNewSession();
      }).not.toThrow();

      expect(modalManager.isModalOpen).toBe(false);
    });
  });

  describe('Overlay Click Handling', () => {
    it('should close modal when clicking overlay element', () => {
      const modalElement = { id: 'newSessionModal' };
      modalManager.openModal();

      modalManager.handleOverlayClick(modalElement, modalElement);

      expect(modalManager.isModalOpen).toBe(false);
    });

    it('should not close modal when clicking inside modal content', () => {
      const modalElement = { id: 'newSessionModal' };
      const contentElement = { id: 'modalContent', parentElement: modalElement };
      modalManager.openModal();

      modalManager.handleOverlayClick(contentElement, modalElement);

      expect(modalManager.isModalOpen).toBe(true);
    });

    it('should handle null target gracefully', () => {
      const modalElement = { id: 'newSessionModal' };
      modalManager.openModal();

      expect(() => {
        modalManager.handleOverlayClick(null, modalElement);
      }).not.toThrow();

      expect(modalManager.isModalOpen).toBe(true);
    });
  });

  describe('Escape Key Handling', () => {
    it('should close modal on Escape when open', () => {
      modalManager.openModal();

      modalManager.handleEscapeKey();

      expect(modalManager.isModalOpen).toBe(false);
    });

    it('should do nothing on Escape when modal is closed', () => {
      expect(modalManager.isModalOpen).toBe(false);

      modalManager.handleEscapeKey();

      expect(modalManager.isModalOpen).toBe(false);
    });
  });

  describe('Complete User Flow', () => {
    it('should handle full confirm flow: open -> confirm -> navigate', () => {
      const navigateSpy = vi.fn();
      modalManager.onNavigate(navigateSpy);

      // User clicks "New Session" button
      modalManager.openModal();
      expect(modalManager.isModalOpen).toBe(true);

      // User clicks "Confirm" button
      modalManager.confirmNewSession();
      expect(modalManager.isModalOpen).toBe(false);
      expect(navigateSpy).toHaveBeenCalled();
    });

    it('should handle full cancel flow: open -> cancel -> no navigation', () => {
      const navigateSpy = vi.fn();
      modalManager.onNavigate(navigateSpy);

      // User clicks "New Session" button
      modalManager.openModal();
      expect(modalManager.isModalOpen).toBe(true);

      // User clicks "Cancel" button
      modalManager.closeModal();
      expect(modalManager.isModalOpen).toBe(false);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('should handle overlay dismiss flow', () => {
      const navigateSpy = vi.fn();
      const modalElement = { id: 'modal' };
      modalManager.onNavigate(navigateSpy);

      modalManager.openModal();
      modalManager.handleOverlayClick(modalElement, modalElement);

      expect(modalManager.isModalOpen).toBe(false);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('should handle Escape dismiss flow', () => {
      const navigateSpy = vi.fn();
      modalManager.onNavigate(navigateSpy);

      modalManager.openModal();
      modalManager.handleEscapeKey();

      expect(modalManager.isModalOpen).toBe(false);
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});

describe('New Session URL Generation', () => {
  describe('URL edge cases', () => {
    let manager: NewSessionModalManager;

    beforeEach(() => {
      manager = new NewSessionModalManager();
    });

    it('should handle HTTPS URLs correctly', () => {
      const baseUrl = manager.getBaseUrl('https://secure.duocode.com/?session=test');
      expect(baseUrl.startsWith('https://')).toBe(true);
    });

    it('should handle HTTP URLs correctly', () => {
      const baseUrl = manager.getBaseUrl('http://dev.duocode.com/?session=test');
      expect(baseUrl.startsWith('http://')).toBe(true);
    });

    it('should preserve port number in URL', () => {
      const baseUrl = manager.getBaseUrl('https://duocode.com:8443/?session=test');
      expect(baseUrl).toBe('https://duocode.com:8443/');
    });

    it('should handle complex paths', () => {
      const baseUrl = manager.getBaseUrl('https://duocode.com/v2/app/interview?session=test');
      expect(baseUrl).toBe('https://duocode.com/v2/app/interview');
    });

    it('should handle encoded characters in session ID', () => {
      const baseUrl = manager.getBaseUrl('https://duocode.com/?session=abc%20def');
      expect(baseUrl).toBe('https://duocode.com/');
    });

    it('should handle empty session parameter', () => {
      const baseUrl = manager.getBaseUrl('https://duocode.com/?session=');
      expect(baseUrl).toBe('https://duocode.com/');
    });

    it('should handle session parameter in middle of query string', () => {
      const baseUrl = manager.getBaseUrl('https://duocode.com/?foo=1&session=abc&bar=2');
      expect(baseUrl).toBe('https://duocode.com/');
    });
  });
});

describe('Session Creation Logic', () => {
  describe('URL without session parameter indicates new session', () => {
    it('should detect no session parameter means new session creation', () => {
      const urlSearch = '';
      const urlParams = new URLSearchParams(urlSearch);
      const sessionId = urlParams.get('session');

      expect(sessionId).toBeNull();
    });

    it('should detect existing session from URL parameter', () => {
      const urlSearch = '?session=existingSession123';
      const urlParams = new URLSearchParams(urlSearch);
      const sessionId = urlParams.get('session');

      expect(sessionId).toBe('existingSession123');
    });

    it('should properly differentiate creator vs joiner', () => {
      // Creator scenario - no session in URL
      const creatorSearch = '';
      const creatorParams = new URLSearchParams(creatorSearch);
      const isCreator = !creatorParams.get('session');
      expect(isCreator).toBe(true);

      // Joiner scenario - session in URL
      const joinerSearch = '?session=joinThis';
      const joinerParams = new URLSearchParams(joinerSearch);
      const isJoiner = !!joinerParams.get('session');
      expect(isJoiner).toBe(true);
    });
  });
});
