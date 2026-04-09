import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheService, CacheServiceLive } from './CacheService';
import type { CacheConfig } from './CacheService';

const run = <A, E>(
  config: CacheConfig,
  program: Effect.Effect<A, E, CacheService>,
): Promise<A> => Effect.runPromise(Effect.provide(program, CacheServiceLive(config)));

describe('CacheService', () => {
  describe('get / set', () => {
    it('returns the value previously stored for the same key', async () => {
      const value = await run(
        { ttlMs: 60_000, max: 10 },
        Effect.gen(function* () {
          const cache = yield* CacheService;
          yield* cache.set('k', 'hello');
          return yield* cache.get('k');
        }),
      );

      expect(value).toBe('hello');
    });
  });

  describe('TTL', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns null for an entry older than ttlMs', async () => {
      const value = await run(
        { ttlMs: 1_000, max: 10 },
        Effect.gen(function* () {
          const cache = yield* CacheService;
          yield* cache.set('k', 'hello');
          vi.advanceTimersByTime(1_001);
          return yield* cache.get('k');
        }),
      );

      expect(value).toBeNull();
    });
  });

  describe('max-entries capacity', () => {
    it('evicts the least-recently-used entry when inserting above capacity', async () => {
      const result = await run(
        { ttlMs: 60_000, max: 2 },
        Effect.gen(function* () {
          const cache = yield* CacheService;
          yield* cache.set('a', 'A');
          yield* cache.set('b', 'B');
          // Touch 'a' so 'b' becomes least-recently used.
          yield* cache.get('a');
          yield* cache.set('c', 'C');
          return {
            a: yield* cache.get('a'),
            b: yield* cache.get('b'),
            c: yield* cache.get('c'),
          };
        }),
      );

      expect(result.a).toBe('A');
      expect(result.b).toBeNull();
      expect(result.c).toBe('C');
    });
  });

  describe('invalidate', () => {
    it('makes a subsequent get for the same key return null', async () => {
      const value = await run(
        { ttlMs: 60_000, max: 10 },
        Effect.gen(function* () {
          const cache = yield* CacheService;
          yield* cache.set('k', 'hello');
          yield* cache.invalidate('k');
          return yield* cache.get('k');
        }),
      );

      expect(value).toBeNull();
    });
  });
});
