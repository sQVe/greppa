import { Effect, Layer, ServiceMap } from 'effect';

interface CacheEntry {
  value: unknown;
  timestamp: number;
}

export interface CacheConfig {
  ttlMs: number;
  max: number;
}

export const DEFAULT_DIFF_CACHE_CONFIG: CacheConfig = { ttlMs: 30_000, max: 100 };

export class CacheService extends ServiceMap.Service<
  CacheService,
  {
    get: (key: string) => Effect.Effect<unknown>;
    set: (key: string, value: unknown) => Effect.Effect<void>;
    invalidate: (key: string) => Effect.Effect<void>;
  }
>()('greppa/CacheService') {}

export const CacheServiceLive = (config: CacheConfig) =>
  Layer.sync(CacheService, () => {
    const { ttlMs, max } = config;
    const store = new Map<string, CacheEntry>();

    return CacheService.of({
      get: (key: string) =>
        Effect.sync(() => {
          const entry = store.get(key);
          if (entry == null) {
            return null;
          }
          if (Date.now() - entry.timestamp >= ttlMs) {
            store.delete(key);
            return null;
          }
          // Re-insert to move this key to the end: Map iteration is insertion-order,
          // so the first key is now least-recently used.
          store.delete(key);
          store.set(key, entry);
          return entry.value;
        }),
      set: (key: string, value: unknown) =>
        Effect.sync(() => {
          // Refreshing an existing key must not count toward capacity.
          store.delete(key);
          // Reclaim slots held by expired entries before treating capacity as
          // full — otherwise stale entries can push out valid ones despite
          // being ineligible for return via `get`.
          const now = Date.now();
          if (store.size >= max) {
            for (const [existingKey, entry] of store) {
              if (now - entry.timestamp >= ttlMs) {
                store.delete(existingKey);
              }
            }
          }
          if (store.size >= max) {
            const oldest = store.keys().next().value;
            if (oldest != null) {
              store.delete(oldest);
            }
          }
          store.set(key, { value, timestamp: now });
        }),
      invalidate: (key: string) =>
        Effect.sync(() => {
          store.delete(key);
        }),
    });
  });
