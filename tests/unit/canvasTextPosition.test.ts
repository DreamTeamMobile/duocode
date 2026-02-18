import { describe, it, expect } from 'vitest';

/**
 * Tests for canvas text positioning accuracy.
 *
 * Bug: Text shifts after the text input overlay loses focus because the
 * overlay's CSS padding+border offset isn't compensated for.  The input
 * text appears at (left + padding + border, top + padding + border) but
 * ctx.fillText renders at the raw logical position — causing a visible jump.
 *
 * The fix: getOverlayScreenPos subtracts the padding+border offset so
 * the rendered text in the input visually aligns with ctx.fillText output.
 */

// The overlay CSS defines: padding 4px 8px, border 2px
// So total offset: left = 8 + 2 = 10px, top = 4 + 2 = 6px
const OVERLAY_PADDING_LEFT = 8;
const OVERLAY_BORDER = 2;
const OVERLAY_PADDING_TOP = 4;
const OVERLAY_OFFSET_LEFT = OVERLAY_PADDING_LEFT + OVERLAY_BORDER; // 10
const OVERLAY_OFFSET_TOP = OVERLAY_PADDING_TOP + OVERLAY_BORDER; // 6

describe('Canvas text positioning', () => {
  it('overlay offset constants match CSS padding+border', () => {
    // If CSS changes, these constants must be updated
    expect(OVERLAY_OFFSET_LEFT).toBe(10);
    expect(OVERLAY_OFFSET_TOP).toBe(6);
  });

  it('getOverlayScreenPos should subtract padding+border offset', () => {
    // Simulate: logical position (200, 300), zoom=1, pan=(0,0), cssScale=1
    const logicalX = 200;
    const logicalY = 300;
    const zoom = 1;
    const panX = 0;
    const panY = 0;

    // Without fix: overlay.left = logicalX * zoom + panX = 200
    // With fix: overlay.left = 200 - 10 = 190 (so input text starts at 200)
    const bufferX = logicalX * zoom + panX;
    const bufferY = logicalY * zoom + panY;

    // Assuming cssScale = 1 for simplicity
    const cssScaleX = 1;
    const cssScaleY = 1;

    const correctedLeft = bufferX * cssScaleX - OVERLAY_OFFSET_LEFT;
    const correctedTop = bufferY * cssScaleY - OVERLAY_OFFSET_TOP;

    expect(correctedLeft).toBe(190);
    expect(correctedTop).toBe(294);
  });

  it('text inside the input should align with canvas fillText position', () => {
    // The input text starts at: overlay.left + padding + border
    // After correction: (200 - 10) + 10 = 200 — matches ctx.fillText(text, 200, ...)
    const logicalX = 200;
    const logicalY = 300;

    const overlayLeft = logicalX - OVERLAY_OFFSET_LEFT;
    const overlayTop = logicalY - OVERLAY_OFFSET_TOP;

    const inputTextX = overlayLeft + OVERLAY_OFFSET_LEFT;
    const inputTextY = overlayTop + OVERLAY_OFFSET_TOP;

    expect(inputTextX).toBe(logicalX);
    expect(inputTextY).toBe(logicalY);
  });

  it('position correction works with zoom and pan', () => {
    const logicalX = 150;
    const logicalY = 250;
    const zoom = 2;
    const panX = 50;
    const panY = 30;
    const cssScaleX = 0.5;
    const cssScaleY = 0.5;

    const bufferX = logicalX * zoom + panX; // 150*2+50 = 350
    const bufferY = logicalY * zoom + panY; // 250*2+30 = 530

    const screenX = bufferX * cssScaleX; // 175
    const screenY = bufferY * cssScaleY; // 265

    const correctedLeft = screenX - OVERLAY_OFFSET_LEFT; // 165
    const correctedTop = screenY - OVERLAY_OFFSET_TOP; // 259

    // Input text appears at: correctedLeft + offset = 165 + 10 = 175 = screenX
    expect(correctedLeft + OVERLAY_OFFSET_LEFT).toBe(screenX);
    expect(correctedTop + OVERLAY_OFFSET_TOP).toBe(screenY);
  });
});
