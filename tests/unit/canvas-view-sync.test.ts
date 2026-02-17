/**
 * Canvas View Sync Unit Tests
 *
 * Tests for canvas zoom/pan state management and sync logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Constants matching the implementation in src/services/canvas-logic.js
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const CANVAS_TRANSFORM_SYNC_DELAY = 100; // ms debounce delay

interface CanvasTransform {
  scale: number;
  panX: number;
  panY: number;
}

type SyncCallback = (transform: CanvasTransform) => void;

/**
 * Simulated canvas view state manager for testing
 * This mirrors the zoom/pan logic in src/services/canvas-logic.js
 */
class CanvasViewManager {
  scale: number;
  panX: number;
  panY: number;
  syncTimeout: ReturnType<typeof setTimeout> | null;
  syncCallback: SyncCallback | null;
  syncDelay: number;

  constructor() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.syncTimeout = null;
    this.syncCallback = null;
    this.syncDelay = CANVAS_TRANSFORM_SYNC_DELAY;
  }

  // Set sync callback (simulates sendData)
  onSync(callback: SyncCallback): void {
    this.syncCallback = callback;
  }

  // Get current transform state
  getTransform(): CanvasTransform {
    return {
      scale: this.scale,
      panX: this.panX,
      panY: this.panY
    };
  }

  // Set transform from remote peer
  setTransformFromRemote(transform: Partial<CanvasTransform>): void {
    if (transform.scale !== undefined) {
      this.scale = this.clampScale(transform.scale);
    }
    if (transform.panX !== undefined) {
      this.panX = transform.panX;
    }
    if (transform.panY !== undefined) {
      this.panY = transform.panY;
    }
  }

  // Clamp scale to min/max bounds
  clampScale(scale: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  }

  // Zoom in/out by delta
  zoom(delta: number, centerX: number = 0, centerY: number = 0): boolean {
    const oldScale = this.scale;
    const newScale = this.clampScale(this.scale * delta);

    if (newScale !== oldScale) {
      // Adjust pan to zoom towards center point
      const scaleRatio = newScale / oldScale;
      this.panX = centerX - (centerX - this.panX) * scaleRatio;
      this.panY = centerY - (centerY - this.panY) * scaleRatio;
      this.scale = newScale;
    }

    return this.scale !== oldScale;
  }

  // Pan by delta
  pan(deltaX: number, deltaY: number): void {
    this.panX += deltaX;
    this.panY += deltaY;
  }

  // Reset to default view
  reset(): void {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  // Debounced sync to peers
  syncTransform(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      if (this.syncCallback) {
        this.syncCallback(this.getTransform());
      }
      this.syncTimeout = null;
    }, this.syncDelay);
  }

  // Immediate sync (bypass debounce)
  syncTransformImmediate(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    if (this.syncCallback) {
      this.syncCallback(this.getTransform());
    }
  }

  // Check if debounced sync is pending
  hasPendingSync(): boolean {
    return this.syncTimeout !== null;
  }

  // Cancel pending sync
  cancelPendingSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
  }
}

describe('Canvas View Sync', () => {
  let viewManager: CanvasViewManager;

  beforeEach(() => {
    viewManager = new CanvasViewManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start with default transform values', () => {
      const transform = viewManager.getTransform();
      expect(transform.scale).toBe(1);
      expect(transform.panX).toBe(0);
      expect(transform.panY).toBe(0);
    });

    it('should have no pending sync initially', () => {
      expect(viewManager.hasPendingSync()).toBe(false);
    });
  });

  describe('Scale Clamping', () => {
    it('should clamp scale to minimum value', () => {
      expect(viewManager.clampScale(0.1)).toBe(MIN_SCALE);
      expect(viewManager.clampScale(0)).toBe(MIN_SCALE);
      expect(viewManager.clampScale(-1)).toBe(MIN_SCALE);
    });

    it('should clamp scale to maximum value', () => {
      expect(viewManager.clampScale(5)).toBe(MAX_SCALE);
      expect(viewManager.clampScale(10)).toBe(MAX_SCALE);
      expect(viewManager.clampScale(100)).toBe(MAX_SCALE);
    });

    it('should not clamp scale within valid range', () => {
      expect(viewManager.clampScale(1)).toBe(1);
      expect(viewManager.clampScale(2)).toBe(2);
      expect(viewManager.clampScale(0.5)).toBe(0.5);
    });

    it('should clamp exactly at boundaries', () => {
      expect(viewManager.clampScale(MIN_SCALE)).toBe(MIN_SCALE);
      expect(viewManager.clampScale(MAX_SCALE)).toBe(MAX_SCALE);
    });
  });

  describe('Zoom Operation', () => {
    it('should zoom in by multiplying scale', () => {
      viewManager.zoom(1.5);
      expect(viewManager.scale).toBe(1.5);
    });

    it('should zoom out by multiplying scale', () => {
      viewManager.zoom(0.5);
      expect(viewManager.scale).toBe(0.5);
    });

    it('should not exceed maximum scale when zooming in', () => {
      viewManager.scale = 3;
      viewManager.zoom(2); // Would result in 6, but max is 4
      expect(viewManager.scale).toBe(MAX_SCALE);
    });

    it('should not go below minimum scale when zooming out', () => {
      viewManager.scale = 0.5;
      viewManager.zoom(0.25); // Would result in 0.125, but min is 0.25
      expect(viewManager.scale).toBe(MIN_SCALE);
    });

    it('should return true when scale changes', () => {
      const result = viewManager.zoom(2);
      expect(result).toBe(true);
    });

    it('should return false when scale is already at limit', () => {
      viewManager.scale = MAX_SCALE;
      const result = viewManager.zoom(2);
      expect(result).toBe(false);
    });

    it('should adjust pan when zooming towards center', () => {
      viewManager.panX = 100;
      viewManager.panY = 50;
      const oldPanX = viewManager.panX;
      const oldPanY = viewManager.panY;

      viewManager.zoom(2, 200, 100);

      // Pan should be adjusted based on zoom center
      expect(viewManager.panX).not.toBe(oldPanX);
      expect(viewManager.panY).not.toBe(oldPanY);
    });
  });

  describe('Pan Operation', () => {
    it('should pan by adding delta values', () => {
      viewManager.pan(50, 30);
      expect(viewManager.panX).toBe(50);
      expect(viewManager.panY).toBe(30);
    });

    it('should accumulate pan values', () => {
      viewManager.pan(10, 20);
      viewManager.pan(15, 25);
      expect(viewManager.panX).toBe(25);
      expect(viewManager.panY).toBe(45);
    });

    it('should handle negative pan values', () => {
      viewManager.pan(-100, -50);
      expect(viewManager.panX).toBe(-100);
      expect(viewManager.panY).toBe(-50);
    });

    it('should handle zero delta', () => {
      viewManager.pan(50, 50);
      viewManager.pan(0, 0);
      expect(viewManager.panX).toBe(50);
      expect(viewManager.panY).toBe(50);
    });
  });

  describe('Reset Operation', () => {
    it('should reset all values to defaults', () => {
      viewManager.scale = 2.5;
      viewManager.panX = 100;
      viewManager.panY = 200;

      viewManager.reset();

      expect(viewManager.scale).toBe(1);
      expect(viewManager.panX).toBe(0);
      expect(viewManager.panY).toBe(0);
    });
  });

  describe('Remote Transform Sync', () => {
    it('should apply remote transform values', () => {
      viewManager.setTransformFromRemote({
        scale: 2,
        panX: 100,
        panY: -50
      });

      expect(viewManager.scale).toBe(2);
      expect(viewManager.panX).toBe(100);
      expect(viewManager.panY).toBe(-50);
    });

    it('should clamp remote scale to valid range', () => {
      viewManager.setTransformFromRemote({
        scale: 10, // Exceeds MAX_SCALE
        panX: 0,
        panY: 0
      });

      expect(viewManager.scale).toBe(MAX_SCALE);
    });

    it('should handle partial transform updates', () => {
      viewManager.scale = 2;
      viewManager.panX = 100;
      viewManager.panY = 200;

      viewManager.setTransformFromRemote({
        panX: 50
      });

      expect(viewManager.scale).toBe(2); // Unchanged
      expect(viewManager.panX).toBe(50); // Updated
      expect(viewManager.panY).toBe(200); // Unchanged
    });

    it('should handle undefined values gracefully', () => {
      viewManager.scale = 2;
      viewManager.panX = 100;

      viewManager.setTransformFromRemote({
        scale: undefined,
        panX: 50
      });

      expect(viewManager.scale).toBe(2); // Unchanged due to undefined
      expect(viewManager.panX).toBe(50);
    });
  });

  describe('Debounced Sync', () => {
    it('should not call sync immediately', () => {
      const syncSpy = vi.fn();
      viewManager.onSync(syncSpy);

      viewManager.syncTransform();

      expect(syncSpy).not.toHaveBeenCalled();
      expect(viewManager.hasPendingSync()).toBe(true);
    });

    it('should call sync after delay', () => {
      const syncSpy = vi.fn();
      viewManager.onSync(syncSpy);

      viewManager.syncTransform();
      vi.advanceTimersByTime(CANVAS_TRANSFORM_SYNC_DELAY);

      expect(syncSpy).toHaveBeenCalledTimes(1);
      expect(viewManager.hasPendingSync()).toBe(false);
    });

    it('should debounce multiple rapid calls', () => {
      const syncSpy = vi.fn();
      viewManager.onSync(syncSpy);

      viewManager.syncTransform();
      vi.advanceTimersByTime(50);
      viewManager.syncTransform();
      vi.advanceTimersByTime(50);
      viewManager.syncTransform();
      vi.advanceTimersByTime(CANVAS_TRANSFORM_SYNC_DELAY);

      expect(syncSpy).toHaveBeenCalledTimes(1);
    });

    it('should send current transform values', () => {
      const syncSpy = vi.fn();
      viewManager.onSync(syncSpy);
      viewManager.scale = 2;
      viewManager.panX = 100;
      viewManager.panY = 50;

      viewManager.syncTransform();
      vi.advanceTimersByTime(CANVAS_TRANSFORM_SYNC_DELAY);

      expect(syncSpy).toHaveBeenCalledWith({
        scale: 2,
        panX: 100,
        panY: 50
      });
    });
  });

  describe('Immediate Sync', () => {
    it('should call sync immediately', () => {
      const syncSpy = vi.fn();
      viewManager.onSync(syncSpy);

      viewManager.syncTransformImmediate();

      expect(syncSpy).toHaveBeenCalledTimes(1);
    });

    it('should cancel pending debounced sync', () => {
      const syncSpy = vi.fn();
      viewManager.onSync(syncSpy);

      viewManager.syncTransform();
      expect(viewManager.hasPendingSync()).toBe(true);

      viewManager.syncTransformImmediate();

      expect(viewManager.hasPendingSync()).toBe(false);
      expect(syncSpy).toHaveBeenCalledTimes(1);

      // Advance time - should not trigger another sync
      vi.advanceTimersByTime(CANVAS_TRANSFORM_SYNC_DELAY);
      expect(syncSpy).toHaveBeenCalledTimes(1);
    });

    it('should send current transform values immediately', () => {
      const syncSpy = vi.fn();
      viewManager.onSync(syncSpy);
      viewManager.scale = 3;
      viewManager.panX = -50;
      viewManager.panY = 75;

      viewManager.syncTransformImmediate();

      expect(syncSpy).toHaveBeenCalledWith({
        scale: 3,
        panX: -50,
        panY: 75
      });
    });
  });

  describe('Cancel Pending Sync', () => {
    it('should cancel pending sync', () => {
      const syncSpy = vi.fn();
      viewManager.onSync(syncSpy);

      viewManager.syncTransform();
      viewManager.cancelPendingSync();

      vi.advanceTimersByTime(CANVAS_TRANSFORM_SYNC_DELAY);

      expect(syncSpy).not.toHaveBeenCalled();
      expect(viewManager.hasPendingSync()).toBe(false);
    });

    it('should be safe to call when no sync pending', () => {
      expect(() => {
        viewManager.cancelPendingSync();
      }).not.toThrow();
    });
  });

  describe('Integration Workflow', () => {
    it('should handle zoom then pan then sync workflow', () => {
      const syncSpy = vi.fn();
      viewManager.onSync(syncSpy);

      // User zooms in
      viewManager.zoom(2);
      expect(viewManager.scale).toBe(2);

      // User pans
      viewManager.pan(100, 50);
      expect(viewManager.panX).toBe(100);
      expect(viewManager.panY).toBe(50);

      // Sync triggered
      viewManager.syncTransformImmediate();

      expect(syncSpy).toHaveBeenCalledWith({
        scale: 2,
        panX: 100,
        panY: 50
      });
    });

    it('should handle remote sync then local modifications', () => {
      // Receive remote state
      viewManager.setTransformFromRemote({
        scale: 1.5,
        panX: 200,
        panY: 100
      });

      expect(viewManager.scale).toBe(1.5);
      expect(viewManager.panX).toBe(200);
      expect(viewManager.panY).toBe(100);

      // Local user pans (pan is additive)
      viewManager.pan(-50, -25);
      expect(viewManager.panX).toBe(150); // 200 - 50
      expect(viewManager.panY).toBe(75);  // 100 - 25

      // Zoom at origin adjusts pan based on scale ratio
      const oldPanX = viewManager.panX;
      const oldPanY = viewManager.panY;
      viewManager.zoom(2, 0, 0);
      expect(viewManager.scale).toBe(3);
      // Pan is adjusted proportionally when zooming at origin
      // newPan = center - (center - oldPan) * scaleRatio
      // newPan = 0 - (0 - 150) * 2 = 300
      expect(viewManager.panX).toBe(oldPanX * 2);
      expect(viewManager.panY).toBe(oldPanY * 2);
    });
  });
});
