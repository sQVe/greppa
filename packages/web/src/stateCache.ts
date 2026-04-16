import { nanoid } from 'nanoid';

export interface StatePayload {
  file: string[];
  wt: string[];
  commits: string[];
  commitFile: string[];
}

export const stateCache = new Map<string, StatePayload>();
export const reverseCache = new Map<string, string>();

export const clearAllStateCaches = () => {
  stateCache.clear();
  reverseCache.clear();
};

const stateKey = (state: StatePayload) =>
  JSON.stringify([state.file, state.wt, state.commits, state.commitFile]);

export const findExistingId = (state: StatePayload): string | null =>
  reverseCache.get(stateKey(state)) ?? null;

export const cacheState = (id: string, state: StatePayload) => {
  stateCache.set(id, state);
  reverseCache.set(stateKey(state), id);
};

export const postState = (id: string, state: StatePayload) => {
  fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...state }),
  }).catch(() => {
    console.warn(`[greppa] Failed to persist state ${id}. Shared links may not resolve on reload.`);
  });
};

export const getOrCreateStateId = (state: StatePayload): string => {
  const existing = findExistingId(state);
  if (existing != null) {
    return existing;
  }
  const id = nanoid(4);
  cacheState(id, state);
  postState(id, state);
  return id;
};
