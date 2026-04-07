// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import { clearTokenStyles, getTokenColorClass } from './tokenStylesheet';

describe('tokenStylesheet', () => {
  afterEach(() => {
    clearTokenStyles();
  });

  describe('getTokenColorClass', () => {
    it('returns undefined for undefined color', () => {
      expect(getTokenColorClass(undefined)).toBeUndefined();
    });

    it('returns a class name for a hex color', () => {
      const className = getTokenColorClass('#cba6f7');
      expect(className).toBe('tk-cba6f7');
    });

    it('returns the same class name for the same color', () => {
      const first = getTokenColorClass('#ff0000');
      const second = getTokenColorClass('#ff0000');
      expect(first).toBe(second);
    });

    it('returns different class names for different colors', () => {
      const a = getTokenColorClass('#ff0000');
      const b = getTokenColorClass('#00ff00');
      expect(a).not.toBe(b);
    });

    it('injects a style rule into the document', () => {
      getTokenColorClass('#cba6f7');
      const styleElement = document.querySelector('style[data-token-styles]');
      expect(styleElement).not.toBeNull();

      const text = styleElement?.textContent ?? '';
      expect(text).toContain('.tk-cba6f7');
      expect(text).toContain('color: #cba6f7');
    });

    it('accumulates rules for multiple colors', () => {
      getTokenColorClass('#ff0000');
      getTokenColorClass('#00ff00');
      const styleElement = document.querySelector('style[data-token-styles]');

      const text = styleElement?.textContent ?? '';
      expect(text).toContain('.tk-ff0000');
      expect(text).toContain('.tk-00ff00');
    });

    it('does not duplicate rules for the same color', () => {
      getTokenColorClass('#ff0000');
      getTokenColorClass('#ff0000');
      const styleElement = document.querySelector('style[data-token-styles]');

      const matches = (styleElement?.textContent ?? '').match(/tk-ff0000/g);
      expect(matches).toHaveLength(1);
    });
  });

  describe('clearTokenStyles', () => {
    it('removes the style element from the document', () => {
      getTokenColorClass('#ff0000');
      clearTokenStyles();
      const styleElement = document.querySelector('style[data-token-styles]');
      expect(styleElement).toBeNull();
    });

    it('allows re-injection after clearing', () => {
      getTokenColorClass('#ff0000');
      clearTokenStyles();
      getTokenColorClass('#00ff00');
      const styleElement = document.querySelector('style[data-token-styles]');
      expect(styleElement).not.toBeNull();

      const text = styleElement?.textContent ?? '';
      expect(text).toContain('.tk-00ff00');
      expect(text).not.toContain('.tk-ff0000');
    });
  });
});
