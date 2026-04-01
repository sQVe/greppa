import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'gr-theme';
const THEMES = ['catppuccin-mocha', 'catppuccin-latte'] as const;

type Theme = (typeof THEMES)[number];

export const isTheme = (value: string): value is Theme =>
  (THEMES as readonly string[]).includes(value);

const getSnapshot = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored != null && isTheme(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage errors (private browsing, quota exceeded).
  }
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'catppuccin-mocha'
    : 'catppuccin-latte';
};

const getServerSnapshot = (): Theme => 'catppuccin-latte';

let listeners: (() => void)[] = [];

const subscribe = (listener: () => void) => {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((existingListener) => existingListener !== listener);
  };
};

const emitChange = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors (private browsing, quota exceeded).
    }
    document.documentElement.setAttribute('data-theme', next);
    emitChange();
  }, []);

  return { theme, setTheme, themes: THEMES } as const;
};
