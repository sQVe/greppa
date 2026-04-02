import { Schema } from 'effect';
import { useCallback, useSyncExternalStore } from 'react';

interface StoreConfig<T> {
  key: string;
  schema: Schema.Decoder<T>;
  defaults: T;
}

export const createPersistedStore = <T>(config: StoreConfig<T>) => {
  let listeners: (() => void)[] = [];

  const subscribe = (listener: () => void) => {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((existing) => existing !== listener);
    };
  };

  const emitChange = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  let cachedRaw: string | null | undefined;
  let cachedSnapshot: T = config.defaults;

  const getSnapshot = (): T => {
    try {
      const raw = localStorage.getItem(config.key);
      if (raw === cachedRaw) {
        return cachedSnapshot;
      }
      cachedRaw = raw;
      if (raw == null) {
        cachedSnapshot = config.defaults;
        return cachedSnapshot;
      }
      const parsed: unknown = JSON.parse(raw);
      cachedSnapshot = Schema.decodeUnknownSync(config.schema)(parsed);
      return cachedSnapshot;
    } catch {
      cachedRaw = undefined;
      cachedSnapshot = config.defaults;
      return cachedSnapshot;
    }
  };

  const getServerSnapshot = (): T => config.defaults;

  const useStore = () => {
    const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const set = useCallback((partial: Partial<T>) => {
      try {
        const current = getSnapshot();
        const next = { ...current, ...partial };
        localStorage.setItem(config.key, JSON.stringify(next));
      } catch {
        // Ignore storage errors (private browsing, quota exceeded).
      }
      emitChange();
    }, []);

    return { state, set, get: getSnapshot };
  };

  return useStore;
};
