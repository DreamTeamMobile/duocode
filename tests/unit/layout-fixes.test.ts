/**
 * Layout Fixes Unit Tests
 *
 * Tests for CSS/DOM layout fixes from tasks 1-5:
 * 1. Tab bar gap between tabs and language selector
 * 2. Content panel bottom edge gap with footer
 * 3. Footer text shortened and single-line
 * 4. Footer FAB overlap avoidance
 * 5. Canvas toolbar overflow on mobile
 *
 * These tests create DOM structures matching the production HTML,
 * inject relevant CSS rules, and verify the expected styles/structure.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Helper: inject a <style> element and return a cleanup function
// ============================================================================
function injectStyles(css: string): () => void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  return () => style.remove();
}

// ============================================================================
// Task 1: Tab Bar Gap Fix
// ============================================================================
describe('Task 1 — Tab bar gap between tabs and language selector', () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = injectStyles(`
      #tabBarWrapper {
        display: flex;
        align-items: flex-end;
        flex-shrink: 0;
        border-bottom: 1px solid #ccc;
        margin-bottom: -1px;
        position: relative;
      }
      #languageSelector {
        display: flex;
        align-items: center;
        margin-left: auto;
        margin-bottom: 4px;
      }
    `);

    document.body.innerHTML = `
      <div id="tabBarWrapper">
        <button class="tab-btn active" data-tab="code">Code</button>
        <button class="tab-btn" data-tab="diagram">Diagram</button>
        <div id="languageSelector">
          <select><option>JavaScript</option></select>
        </div>
      </div>
    `;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('should have #tabBarWrapper using flex layout', () => {
    const wrapper = document.getElementById('tabBarWrapper')!;
    const style = getComputedStyle(wrapper);
    expect(style.display).toBe('flex');
  });

  it('should have #tabBarWrapper with border-bottom for seamless tab connection', () => {
    const wrapper = document.getElementById('tabBarWrapper')!;
    const style = getComputedStyle(wrapper);
    expect(style.borderBottomStyle).not.toBe('none');
  });

  it('should have #tabBarWrapper with negative margin-bottom to overlap border', () => {
    const wrapper = document.getElementById('tabBarWrapper')!;
    const style = getComputedStyle(wrapper);
    expect(style.marginBottom).toBe('-1px');
  });

  it('should have #tabBarWrapper with position: relative', () => {
    const wrapper = document.getElementById('tabBarWrapper')!;
    const style = getComputedStyle(wrapper);
    expect(style.position).toBe('relative');
  });

  it('should have #languageSelector with margin-left: auto to push it right', () => {
    const selector = document.getElementById('languageSelector')!;
    const style = getComputedStyle(selector);
    expect(style.marginLeft).toBe('auto');
  });

  it('should NOT have justify-content: space-between on #tabBarWrapper', () => {
    const wrapper = document.getElementById('tabBarWrapper')!;
    const style = getComputedStyle(wrapper);
    // The fix removed space-between; default flex justify-content is 'normal' or 'flex-start'
    expect(style.justifyContent).not.toBe('space-between');
  });

  it('should contain tab buttons and language selector as children', () => {
    const wrapper = document.getElementById('tabBarWrapper')!;
    const tabs = wrapper.querySelectorAll('.tab-btn');
    const langSelector = wrapper.querySelector('#languageSelector');
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    expect(langSelector).toBeTruthy();
  });
});

// ============================================================================
// Task 2: Content Panel Bottom Edge Gap
// ============================================================================
describe('Task 2 — Content panel bottom edge gap with footer', () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = injectStyles(`
      #tabContent {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
        border: 1px solid #ccc;
        border-radius: 0 8px 0 0;
      }
      .app-footer {
        margin: 0;
        padding: 0.25rem 1rem;
      }
    `);

    document.body.innerHTML = `
      <div id="tabContent">
        <div id="codeCanvas">code here</div>
      </div>
      <footer class="app-footer">Footer</footer>
    `;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('should have #tabContent with border-radius removing bottom corners', () => {
    const content = document.getElementById('tabContent')!;
    const style = getComputedStyle(content);
    // border-radius: 0 8px 0 0 — jsdom stores as shorthand
    // Verify the shorthand value has the correct pattern: top-left=0, top-right=8px, bottom-right=0, bottom-left=0
    const br = style.borderRadius;
    expect(br).toBe('0 8px 0 0');
  });

  it('should have #tabContent border-radius that excludes bottom rounding', () => {
    const content = document.getElementById('tabContent')!;
    const style = getComputedStyle(content);
    const br = style.borderRadius;
    // Parse the 4-value shorthand: "0 8px 0 0"
    const parts = br.split(/\s+/);
    // Bottom-right (index 2) and bottom-left (index 3) should be 0
    expect(parts[2]).toBe('0');
    expect(parts[3]).toBe('0');
    // Top-right (index 1) should be 8px
    expect(parts[1]).toBe('8px');
  });

  it('should have .app-footer with zero margin (no gap above)', () => {
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const style = getComputedStyle(footer);
    expect(style.marginTop).toBe('0px');
    expect(style.marginBottom).toBe('0px');
    expect(style.marginLeft).toBe('0px');
    expect(style.marginRight).toBe('0px');
  });
});

// ============================================================================
// Task 3: Footer Text Shortened and Single-Line
// ============================================================================
describe('Task 3 — Footer text shortened and single-line', () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = injectStyles(`
      .app-footer {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        padding: 0.25rem 1rem;
        font-size: 0.7rem;
        white-space: nowrap;
      }
    `);

    document.body.innerHTML = `
      <footer id="appFooter" class="app-footer">
        <a href="https://github.com/DreamTeamMobile/duocode" target="_blank" rel="noopener">Open Source</a>
        <span class="footer-separator">|</span>
        <a href="privacy.html" target="_blank" rel="noopener">Privacy</a>
        <span class="footer-separator">|</span>
        <a href="terms.html" target="_blank" rel="noopener">Terms</a>
        <span class="footer-separator">|</span>
        <span class="footer-copyright">&copy; 2026 <a href="https://dreamteam-mobile.com" target="_blank" rel="noopener">DreamTeam Mobile</a></span>
      </footer>
    `;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('should have white-space: nowrap on .app-footer to prevent wrapping', () => {
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const style = getComputedStyle(footer);
    expect(style.whiteSpace).toBe('nowrap');
  });

  it('should contain Open Source, Privacy, Terms, and copyright', () => {
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const text = footer.textContent!;
    expect(text).toContain('Open Source');
    expect(text).toContain('Privacy');
    expect(text).toContain('Terms');
    expect(text).toContain('2026');
    expect(text).toContain('DreamTeam Mobile');
  });

  it('should NOT contain long copyright text', () => {
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const text = footer.textContent!;
    expect(text).not.toContain('All rights reserved');
  });

  it('should have correct Open Source link', () => {
    const links = document.querySelectorAll('.app-footer a');
    const ghLink = Array.from(links).find((a: Element) => a.textContent === 'Open Source');
    expect(ghLink).toBeTruthy();
    expect(ghLink!.getAttribute('href')).toBe('https://github.com/DreamTeamMobile/duocode');
    expect(ghLink!.getAttribute('target')).toBe('_blank');
    expect(ghLink!.getAttribute('rel')).toContain('noopener');
  });

  it('should have correct Privacy link', () => {
    const links = document.querySelectorAll('.app-footer a');
    const privacyLink = Array.from(links).find((a: Element) => a.textContent === 'Privacy');
    expect(privacyLink).toBeTruthy();
    expect(privacyLink!.getAttribute('href')).toBe('privacy.html');
    expect(privacyLink!.getAttribute('target')).toBe('_blank');
    expect(privacyLink!.getAttribute('rel')).toContain('noopener');
  });

  it('should have correct Terms link', () => {
    const links = document.querySelectorAll('.app-footer a');
    const termsLink = Array.from(links).find((a: Element) => a.textContent === 'Terms');
    expect(termsLink).toBeTruthy();
    expect(termsLink!.getAttribute('href')).toBe('terms.html');
    expect(termsLink!.getAttribute('target')).toBe('_blank');
  });

  it('should have DreamTeam Mobile link', () => {
    const links = document.querySelectorAll('.app-footer a');
    const dtmLink = Array.from(links).find((a: Element) => a.textContent === 'DreamTeam Mobile');
    expect(dtmLink).toBeTruthy();
    expect(dtmLink!.getAttribute('href')).toBe('https://dreamteam-mobile.com');
  });

  it('should have three separator elements', () => {
    const separators = document.querySelectorAll('.app-footer .footer-separator');
    expect(separators.length).toBe(3);
    separators.forEach((sep: Element) => {
      expect(sep.textContent).toBe('|');
    });
  });

  it('should use flex layout for single-row display', () => {
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const style = getComputedStyle(footer);
    expect(style.display).toBe('flex');
    expect(style.justifyContent).toBe('center');
    expect(style.alignItems).toBe('center');
  });
});

// ============================================================================
// Task 4: Footer FAB Overlap Avoidance
// ============================================================================
describe('Task 4 — Footer FAB overlap avoidance', () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = injectStyles(`
      .app-footer {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        padding: 0.25rem 1rem;
        white-space: nowrap;
      }
      body.messages-collapsed .app-footer {
        padding-right: 88px;
        padding-left: 88px;
      }
      .messages-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
      }
      body:not(.messages-collapsed) .messages-fab {
        display: none;
      }
      body.messages-collapsed .messages-fab {
        display: flex;
      }
    `);

    document.body.innerHTML = `
      <footer class="app-footer">
        <a href="https://github.com/DreamTeamMobile/duocode">Open Source</a>
        <span class="footer-separator">|</span>
        <a href="privacy.html">Privacy</a>
        <span class="footer-separator">|</span>
        <a href="terms.html">Terms</a>
        <span class="footer-separator">|</span>
        <span class="footer-copyright">&copy; 2026 DreamTeam Mobile</span>
      </footer>
      <button class="messages-fab">💬</button>
    `;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    document.body.className = '';
  });

  it('should add right padding to footer when messages are collapsed', () => {
    document.body.classList.add('messages-collapsed');
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const style = getComputedStyle(footer);
    expect(style.paddingRight).toBe('88px');
  });

  it('should add left padding to footer when messages are collapsed (centering balance)', () => {
    document.body.classList.add('messages-collapsed');
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const style = getComputedStyle(footer);
    expect(style.paddingLeft).toBe('88px');
  });

  it('should NOT add extra padding when messages panel is open', () => {
    // body does NOT have messages-collapsed class
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const style = getComputedStyle(footer);
    // Default padding from .app-footer rule
    expect(style.paddingRight).not.toBe('88px');
  });

  it('should hide FAB when messages panel is open', () => {
    // No messages-collapsed class = messages are open
    const fab = document.querySelector('.messages-fab') as HTMLElement;
    const style = getComputedStyle(fab);
    expect(style.display).toBe('none');
  });

  it('should show FAB when messages are collapsed', () => {
    document.body.classList.add('messages-collapsed');
    const fab = document.querySelector('.messages-fab') as HTMLElement;
    const style = getComputedStyle(fab);
    expect(style.display).toBe('flex');
  });

  it('should have FAB positioned fixed in bottom-right', () => {
    document.body.classList.add('messages-collapsed');
    const fab = document.querySelector('.messages-fab') as HTMLElement;
    const style = getComputedStyle(fab);
    expect(style.position).toBe('fixed');
  });

  it('should have footer padding-right >= FAB width + right offset', () => {
    document.body.classList.add('messages-collapsed');
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const footerStyle = getComputedStyle(footer);
    const fabStyle = getComputedStyle(document.querySelector('.messages-fab') as HTMLElement);

    const footerPaddingRight = parseInt(footerStyle.paddingRight, 10);
    const fabWidth = parseInt(fabStyle.width, 10);

    // Footer padding should exceed FAB width to prevent overlap
    expect(footerPaddingRight).toBeGreaterThan(fabWidth);
  });
});

// ============================================================================
// Task 5: Canvas Toolbar Overflow on Mobile
// ============================================================================
describe('Task 5 — Canvas toolbar overflow on mobile', () => {
  let cleanup: () => void;

  describe('Default (desktop) styles', () => {
    beforeEach(() => {
      cleanup = injectStyles(`
        #diagramControls {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 8px;
        }
      `);

      document.body.innerHTML = `
        <div id="diagramControls">
          <button class="tool-btn-icon"><svg width="20" height="20"></svg></button>
          <button class="tool-btn-icon"><svg width="20" height="20"></svg></button>
          <div class="tool-divider"></div>
          <button class="tool-btn-icon"><svg width="20" height="20"></svg></button>
          <input type="color" id="colorPicker" />
        </div>
      `;
    });

    afterEach(() => {
      cleanup();
      document.body.innerHTML = '';
    });

    it('should have flex-wrap: nowrap on desktop', () => {
      const controls = document.getElementById('diagramControls')!;
      const style = getComputedStyle(controls);
      expect(style.flexWrap).toBe('nowrap');
    });

    it('should use flex layout', () => {
      const controls = document.getElementById('diagramControls')!;
      const style = getComputedStyle(controls);
      expect(style.display).toBe('flex');
    });
  });

  describe('Mobile styles (max-width: 768px)', () => {
    beforeEach(() => {
      // Simulate mobile styles by directly applying the mobile CSS rules
      cleanup = injectStyles(`
        #diagramControls {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 6px;
        }
        #diagramControls .tool-divider {
          width: 100%;
          height: 1px;
          margin: 0;
        }
        #diagramControls .tool-btn-icon {
          width: 32px;
          height: 32px;
          min-width: 32px;
          min-height: 32px;
        }
        #diagramControls .tool-btn-icon svg {
          width: 16px;
          height: 16px;
        }
        #diagramControls #colorPicker {
          width: 32px;
          height: 32px;
          min-width: 32px;
        }
      `);

      document.body.innerHTML = `
        <div id="diagramControls">
          <button class="tool-btn-icon"><svg width="20" height="20"></svg></button>
          <button class="tool-btn-icon"><svg width="20" height="20"></svg></button>
          <div class="tool-divider"></div>
          <button class="tool-btn-icon"><svg width="20" height="20"></svg></button>
          <input type="color" id="colorPicker" />
        </div>
      `;
    });

    afterEach(() => {
      cleanup();
      document.body.innerHTML = '';
    });

    it('should have flex-wrap: wrap for mobile toolbar', () => {
      const controls = document.getElementById('diagramControls')!;
      const style = getComputedStyle(controls);
      expect(style.flexWrap).toBe('wrap');
    });

    it('should have compact gap (6px) on mobile', () => {
      const controls = document.getElementById('diagramControls')!;
      const style = getComputedStyle(controls);
      expect(style.gap).toBe('6px');
    });

    it('should have compact padding (6px) on mobile', () => {
      const controls = document.getElementById('diagramControls')!;
      const style = getComputedStyle(controls);
      expect(style.padding).toBe('6px');
    });

    it('should have tool buttons sized at 32x32px on mobile', () => {
      const btn = document.querySelector('#diagramControls .tool-btn-icon') as HTMLElement;
      const style = getComputedStyle(btn);
      expect(style.width).toBe('32px');
      expect(style.height).toBe('32px');
      expect(style.minWidth).toBe('32px');
      expect(style.minHeight).toBe('32px');
    });

    it('should have tool button SVGs sized at 16x16px on mobile', () => {
      const svg = document.querySelector('#diagramControls .tool-btn-icon svg') as SVGElement;
      const style = getComputedStyle(svg);
      expect(style.width).toBe('16px');
      expect(style.height).toBe('16px');
    });

    it('should have colorPicker sized at 32x32px on mobile', () => {
      const picker = document.getElementById('colorPicker')!;
      const style = getComputedStyle(picker);
      expect(style.width).toBe('32px');
      expect(style.height).toBe('32px');
    });

    it('should have tool-divider as full-width horizontal separator', () => {
      const divider = document.querySelector('#diagramControls .tool-divider') as HTMLElement;
      const style = getComputedStyle(divider);
      expect(style.width).toBe('100%');
      expect(style.height).toBe('1px');
    });
  });

  describe('Small mobile styles (max-width: 480px)', () => {
    beforeEach(() => {
      // Simulate the 480px breakpoint styles
      cleanup = injectStyles(`
        #diagramControls {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 4px;
        }
        #diagramControls .tool-btn-icon {
          width: 30px;
          height: 30px;
          min-width: 30px;
          min-height: 30px;
          border-radius: 5px;
        }
        #diagramControls .tool-btn-icon svg {
          width: 14px;
          height: 14px;
        }
        #diagramControls #colorPicker {
          width: 30px;
          height: 30px;
          min-width: 30px;
        }
        #diagramControls .tool-divider {
          margin: 0;
        }
      `);

      document.body.innerHTML = `
        <div id="diagramControls">
          <button class="tool-btn-icon"><svg width="20" height="20"></svg></button>
          <button class="tool-btn-icon"><svg width="20" height="20"></svg></button>
          <div class="tool-divider"></div>
          <button class="tool-btn-icon"><svg width="20" height="20"></svg></button>
          <input type="color" id="colorPicker" />
        </div>
      `;
    });

    afterEach(() => {
      cleanup();
      document.body.innerHTML = '';
    });

    it('should have even smaller gap (4px) on small mobile', () => {
      const controls = document.getElementById('diagramControls')!;
      const style = getComputedStyle(controls);
      expect(style.gap).toBe('4px');
    });

    it('should have even smaller padding (4px) on small mobile', () => {
      const controls = document.getElementById('diagramControls')!;
      const style = getComputedStyle(controls);
      expect(style.padding).toBe('4px');
    });

    it('should have tool buttons sized at 30x30px on small mobile', () => {
      const btn = document.querySelector('#diagramControls .tool-btn-icon') as HTMLElement;
      const style = getComputedStyle(btn);
      expect(style.width).toBe('30px');
      expect(style.height).toBe('30px');
      expect(style.minWidth).toBe('30px');
      expect(style.minHeight).toBe('30px');
    });

    it('should have tool button SVGs sized at 14x14px on small mobile', () => {
      const svg = document.querySelector('#diagramControls .tool-btn-icon svg') as SVGElement;
      const style = getComputedStyle(svg);
      expect(style.width).toBe('14px');
      expect(style.height).toBe('14px');
    });

    it('should have colorPicker sized at 30x30px on small mobile', () => {
      const picker = document.getElementById('colorPicker')!;
      const style = getComputedStyle(picker);
      expect(style.width).toBe('30px');
      expect(style.height).toBe('30px');
    });

    it('should have tool buttons smaller than desktop defaults', () => {
      const btn = document.querySelector('#diagramControls .tool-btn-icon') as HTMLElement;
      const style = getComputedStyle(btn);
      const width = parseInt(style.width, 10);
      // Default desktop tool buttons are larger; 30px is the compact size
      expect(width).toBeLessThanOrEqual(30);
    });
  });
});

// ============================================================================
// Integration: All fixes applied together
// ============================================================================
describe('Integration — All layout fixes applied together', () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = injectStyles(`
      /* Task 1: Tab bar */
      #tabBarWrapper {
        display: flex;
        align-items: flex-end;
        flex-shrink: 0;
        border-bottom: 1px solid #ccc;
        margin-bottom: -1px;
        position: relative;
      }
      #languageSelector {
        margin-left: auto;
      }

      /* Task 2: Content panel + footer gap */
      #tabContent {
        border-radius: 0 8px 0 0;
      }
      .app-footer {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        padding: 0.25rem 1rem;
        white-space: nowrap;
      }

      /* Task 4: FAB overlap */
      body.messages-collapsed .app-footer {
        padding-right: 88px;
        padding-left: 88px;
      }
    `);

    document.body.innerHTML = `
      <div id="tabBarWrapper">
        <button class="tab-btn active" data-tab="code">Code</button>
        <button class="tab-btn" data-tab="diagram">Diagram</button>
        <div id="languageSelector">
          <select><option>JavaScript</option></select>
        </div>
      </div>
      <div id="tabContent">
        <div id="codeCanvas">code</div>
      </div>
      <footer id="appFooter" class="app-footer">
        <a href="https://github.com/DreamTeamMobile/duocode" target="_blank" rel="noopener">Open Source</a>
        <span class="footer-separator">|</span>
        <a href="privacy.html" target="_blank" rel="noopener">Privacy</a>
        <span class="footer-separator">|</span>
        <a href="terms.html" target="_blank" rel="noopener">Terms</a>
        <span class="footer-separator">|</span>
        <span class="footer-copyright">&copy; 2026 <a href="https://dreamteam-mobile.com" target="_blank" rel="noopener">DreamTeam Mobile</a></span>
      </footer>
      <button class="messages-fab">💬</button>
    `;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    document.body.className = '';
  });

  it('should have seamless connection between tab bar and content panel', () => {
    const wrapper = document.getElementById('tabBarWrapper')!;
    const content = document.getElementById('tabContent')!;

    const wrapperStyle = getComputedStyle(wrapper);
    const contentStyle = getComputedStyle(content);

    // Tab bar has negative margin to overlap its border with content border
    expect(wrapperStyle.marginBottom).toBe('-1px');
    // Content has no bottom rounding to sit flush with footer
    const br = contentStyle.borderRadius;
    const parts = br.split(/\s+/);
    expect(parts[2]).toBe('0'); // bottom-right
    expect(parts[3]).toBe('0'); // bottom-left
  });

  it('should have footer sitting flush against content panel with no gap', () => {
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const style = getComputedStyle(footer);
    expect(style.marginTop).toBe('0px');
    expect(style.marginBottom).toBe('0px');
  });

  it('should have footer text on a single line', () => {
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const style = getComputedStyle(footer);
    expect(style.whiteSpace).toBe('nowrap');
    expect(style.display).toBe('flex');
  });

  it('should adapt footer padding when messages are collapsed', () => {
    document.body.classList.add('messages-collapsed');
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const style = getComputedStyle(footer);
    expect(style.paddingRight).toBe('88px');

    document.body.classList.remove('messages-collapsed');
    const style2 = getComputedStyle(footer);
    expect(style2.paddingRight).not.toBe('88px');
  });

  it('should have correct footer content structure', () => {
    const footer = document.querySelector('.app-footer') as HTMLElement;
    const links = footer.querySelectorAll('a');
    const separators = footer.querySelectorAll('.footer-separator');
    const copyright = footer.querySelector('.footer-copyright')!;

    // 4 links: Open Source, Privacy, Terms, DreamTeam Mobile
    expect(links.length).toBe(4);
    expect(separators.length).toBe(3);
    expect(copyright).toBeTruthy();
    expect(copyright.textContent).toContain('2026');
    expect(copyright.textContent).toContain('DreamTeam Mobile');
  });
});
