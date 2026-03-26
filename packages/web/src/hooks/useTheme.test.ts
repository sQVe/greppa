// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isTheme, useTheme } from './useTheme';

describe('useTheme', () => {
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

  describe('theme resolution', () => {
    it('returns catppuccin-mocha when OS prefers dark', () => {
      vi.spyOn(globalThis, 'matchMedia').mockReturnValue({
        matches: true,
      } as MediaQueryList);

      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('catppuccin-mocha');
    });

    it('returns catppuccin-latte when OS prefers light', () => {
      vi.spyOn(globalThis, 'matchMedia').mockReturnValue({
        matches: false,
      } as MediaQueryList);

      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('catppuccin-latte');
    });

    it('returns stored theme from localStorage', () => {
      localStorage.setItem('gr-theme', 'catppuccin-latte');

      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('catppuccin-latte');
    });

    it('ignores invalid localStorage values and falls back to OS preference', () => {
      localStorage.setItem('gr-theme', 'invalid-theme');
      vi.spyOn(globalThis, 'matchMedia').mockReturnValue({
        matches: true,
      } as MediaQueryList);

      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('catppuccin-mocha');
    });
  });

  describe('setTheme', () => {
    it('updates localStorage', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('catppuccin-mocha');
      });

      expect(localStorage.getItem('gr-theme')).toBe('catppuccin-mocha');
    });

    it('sets data-theme attribute on document element', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('catppuccin-mocha');
      });

      expect(document.documentElement.getAttribute('data-theme')).toBe('catppuccin-mocha');
    });

    it('updates the returned theme value', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('catppuccin-mocha');
      });

      expect(result.current.theme).toBe('catppuccin-mocha');
    });
  });

  describe('themes', () => {
    it('exposes available theme names', () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.themes).toContain('catppuccin-mocha');
      expect(result.current.themes).toContain('catppuccin-latte');
    });
  });
});
