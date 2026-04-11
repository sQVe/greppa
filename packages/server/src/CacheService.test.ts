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

    it('returns null for an entry at exactly ttlMs (boundary is exclusive)', async () => {
      const value = await run(
        { ttlMs: 1_000, max: 10 },
        Effect.gen(function* () {
          const cache = yield* CacheService;
          yield* cache.set('k', 'hello');
          vi.advanceTimersByTime(1_000);
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

    it('purges expired entries before evicting at capacity so fresh entries survive', async () => {
      // Reproduce the hidden bug: when a stale entry sits later in insertion
      // order than a fresh one, LRU-by-insertion evicts the fresh entry even
      // though the stale one already holds a dead slot. A pre-eviction purge
      // must reclaim the stale slot first.
      vi.useFakeTimers();
      try {
        const result = await run(
          { ttlMs: 1_000, max: 2 },
          Effect.gen(function* () {
            const cache = yield* CacheService;
            // t=0: stale seeded with its final timestamp.
            yield* cache.set('stale', 'STALE');
            // t=100: fresh inserted after stale. Order: [stale@0, fresh@100].
            vi.advanceTimersByTime(100);
            yield* cache.set('fresh', 'FRESH');
            // t=200: touch stale. get() re-inserts without refreshing its
            // timestamp, so order becomes [fresh@100, stale@0]. Stale is now
            // at the *end* of insertion order but will expire sooner.
            vi.advanceTimersByTime(100);
            yield* cache.get('stale');
            // t=1001: stale (age 1001) expired, fresh (age 901) valid. Insert
            // a new key — oldest-by-insertion is 'fresh', so without a prior
            // purge the valid entry would be evicted instead of the stale one.
            vi.advanceTimersByTime(801);
            yield* cache.set('new', 'NEW');
            return {
              stale: yield* cache.get('stale'),
              fresh: yield* cache.get('fresh'),
              new: yield* cache.get('new'),
            };
          }),
        );

        expect(result.stale).toBeNull();
        expect(result.fresh).toBe('FRESH');
        expect(result.new).toBe('NEW');
      } finally {
        vi.useRealTimers();
      }
    });

    it('refreshing an existing key at capacity does not evict a sibling', async () => {
      const result = await run(
        { ttlMs: 60_000, max: 2 },
        Effect.gen(function* () {
          const cache = yield* CacheService;
          yield* cache.set('a', 'A');
          yield* cache.set('b', 'B');
          // Re-set an existing key: must not count toward capacity, so 'a' must survive.
          yield* cache.set('b', 'B2');
          return {
            a: yield* cache.get('a'),
            b: yield* cache.get('b'),
          };
        }),
      );

      expect(result.a).toBe('A');
      expect(result.b).toBe('B2');
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
