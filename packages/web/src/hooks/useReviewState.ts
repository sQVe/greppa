import { Schema } from 'effect';
import { useCallback, useSyncExternalStore } from 'react';

const ReviewStateSchema = Schema.Struct({
  collapsedPaths: Schema.Array(Schema.String),
  reviewedPaths: Schema.Array(Schema.String),
});

type ReviewState = typeof ReviewStateSchema.Type;

const DEFAULTS: ReviewState = { collapsedPaths: [], reviewedPaths: [] };

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

const cache = new Map<string, { raw: string | null | undefined; snapshot: ReviewState }>();

const readSnapshot = (key: string): ReviewState => {
  try {
    const raw = localStorage.getItem(key);
    const cached = cache.get(key);
    if (cached != null && raw === cached.raw) {
      return cached.snapshot;
    }

    if (raw == null) {
      cache.set(key, { raw, snapshot: DEFAULTS });
      return DEFAULTS;
    }

    const parsed: unknown = JSON.parse(raw);
    const snapshot = Schema.decodeUnknownSync(ReviewStateSchema)(parsed);
    cache.set(key, { raw, snapshot });
    return snapshot;
  } catch {
    cache.set(key, { raw: undefined, snapshot: DEFAULTS });
    return DEFAULTS;
  }
};

const SERVER_SNAPSHOT = (): ReviewState => DEFAULTS;

export const useReviewState = (sessionId: string) => {
  const key = `gr-review:${sessionId}`;

  const getSnapshot = useCallback(() => readSnapshot(key), [key]);

  const state = useSyncExternalStore(subscribe, getSnapshot, SERVER_SNAPSHOT);

  const set = useCallback(
    (partial: Partial<ReviewState>) => {
      try {
        const current = readSnapshot(key);
        const next = { ...current, ...partial };
        localStorage.setItem(key, JSON.stringify(next));
        cache.delete(key);
      } catch {
        // Ignore storage errors (private browsing, quota exceeded).
      }
      emitChange();
    },
    [key],
  );

  return { state, set };
};
