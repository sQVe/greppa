export interface StatePayload {
  file: string[];
  wt: string[];
  commits: string[];
}

export const stateCache = new Map<string, StatePayload>();
export const reverseCache = new Map<string, string>();

export const clearAllStateCaches = () => {
  stateCache.clear();
  reverseCache.clear();
};

const stateKey = (state: StatePayload) =>
  JSON.stringify([state.file, state.wt, state.commits]);

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
    // eslint-disable-next-line no-empty-function -- fire-and-forget by design
  }).catch(() => { /* fire-and-forget */ });
};
