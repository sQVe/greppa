import { Schema } from 'effect';
import { useEffect } from 'react';

import { createPersistedStore } from './createPersistedStore';

const THEMES = ['catppuccin-mocha', 'catppuccin-latte'] as const;

type Theme = (typeof THEMES)[number];

const isTheme = (value: string): value is Theme =>
  (THEMES as readonly string[]).includes(value);

const ThemeSchema = Schema.Union([
  Schema.Literal('catppuccin-mocha'),
  Schema.Literal('catppuccin-latte'),
]);

const PreferencesSchema = Schema.Struct({
  theme: ThemeSchema,
});

const getDefaultTheme = (): Theme => {
  try {
    if (globalThis.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'catppuccin-mocha';
    }
  } catch {
    // matchMedia unavailable (SSR, tests).
  }
  return 'catppuccin-latte';
};

const usePreferencesStore = createPersistedStore({
  key: 'gr-preferences',
  schema: PreferencesSchema,
  defaults: { theme: getDefaultTheme() },
});

const usePreferences = () => {
  const { state, set } = usePreferencesStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  return { state, set } as const;
};

export { isTheme, THEMES, usePreferences };
export type { Theme };
