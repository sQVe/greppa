import { Schema } from 'effect';

import { createPersistedStore } from './createPersistedStore';

const ReviewStateSchema = Schema.Struct({
  collapsedPaths: Schema.Array(Schema.String),
  reviewedPaths: Schema.Array(Schema.String),
  reviewedCommitFiles: Schema.Array(Schema.String),
});

type ReviewState = typeof ReviewStateSchema.Type;

const DEFAULTS: ReviewState = {
  collapsedPaths: [],
  reviewedPaths: [],
  reviewedCommitFiles: [],
};

const stores = new Map<string, ReturnType<typeof createPersistedStore<ReviewState>>>();

const getOrCreateStore = (sessionId: string) => {
  const existing = stores.get(sessionId);
  if (existing != null) {
    return existing;
  }

  const store = createPersistedStore({
    key: `gr-review:${sessionId}`,
    schema: ReviewStateSchema,
    defaults: DEFAULTS,
  });
  stores.set(sessionId, store);
  return store;
};

export const useReviewState = (sessionId: string) => getOrCreateStore(sessionId)();
