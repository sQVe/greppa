// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isTheme, THEMES, usePreferences } from './usePreferences';

describe('usePreferences', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isTheme', () => {
    it('returns true for valid theme names', () => {
      expect(isTheme('catppuccin-mocha')).toBe(true);
      expect(isTheme('catppuccin-latte')).toBe(true);
    });

    it('returns false for invalid theme names', () => {
      expect(isTheme('invalid')).toBe(false);
      expect(isTheme('')).toBe(false);
    });
  });

  describe('THEMES', () => {
    it('exposes available theme names', () => {
      expect(THEMES).toContain('catppuccin-mocha');
      expect(THEMES).toContain('catppuccin-latte');
    });
  });

  describe('theme persistence', () => {
    it('returns stored theme from localStorage', () => {
      localStorage.setItem('gr-preferences', JSON.stringify({ theme: 'catppuccin-mocha' }));

      const { result } = renderHook(() => usePreferences());
      expect(result.current.state.theme).toBe('catppuccin-mocha');
    });

    it('updates localStorage when theme is changed', () => {
      const { result } = renderHook(() => usePreferences());

      act(() => {
        result.current.set({ theme: 'catppuccin-mocha' });
      });

      const stored = JSON.parse(localStorage.getItem('gr-preferences')!);
      expect(stored.theme).toBe('catppuccin-mocha');
    });

    it('updates state.theme after set()', () => {
      const { result } = renderHook(() => usePreferences());

      act(() => {
        result.current.set({ theme: 'catppuccin-mocha' });
      });

      expect(result.current.state.theme).toBe('catppuccin-mocha');
    });
  });

  describe('data-theme attribute', () => {
    it('sets data-theme on document element on mount', () => {
      localStorage.setItem('gr-preferences', JSON.stringify({ theme: 'catppuccin-mocha' }));

      renderHook(() => usePreferences());
      expect(document.documentElement.getAttribute('data-theme')).toBe('catppuccin-mocha');
    });

    it('updates data-theme when theme changes', () => {
      const { result } = renderHook(() => usePreferences());

      act(() => {
        result.current.set({ theme: 'catppuccin-mocha' });
      });

      expect(document.documentElement.getAttribute('data-theme')).toBe('catppuccin-mocha');
    });
  });
});
