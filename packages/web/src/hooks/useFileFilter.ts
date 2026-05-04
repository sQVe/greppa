import { useSyncExternalStore } from 'react';

interface FilterState {
  query: string;
}

interface SessionStore {
  state: FilterState;
  listeners: (() => void)[];
}

interface UseFileFilterResult {
  query: string;
  setQuery: (query: string) => void;
  reset: () => void;
  isActive: boolean;
}

const stores = new Map<string, SessionStore>();

const getStore = (sessionId: string): SessionStore => {
  let store = stores.get(sessionId);
  if (store == null) {
    store = { state: { query: '' }, listeners: [] };
    stores.set(sessionId, store);
  }
  return store;
};

const subscribeFor = (sessionId: string) => (listener: () => void) => {
  const store = getStore(sessionId);
  store.listeners = [...store.listeners, listener];
  return () => {
    store.listeners = store.listeners.filter((existing) => existing !== listener);
  };
};

const getSnapshotFor = (sessionId: string) => () => getStore(sessionId).state;

const emitChange = (store: SessionStore) => {
  for (const listener of store.listeners) {
    listener();
  }
};

const setQueryFor = (sessionId: string, query: string) => {
  const store = getStore(sessionId);
  if (store.state.query === query) return;
  store.state = { query };
  emitChange(store);
};

export const useFileFilter = (sessionId: string): UseFileFilterResult => {
  const state = useSyncExternalStore(subscribeFor(sessionId), getSnapshotFor(sessionId));

  return {
    query: state.query,
    setQuery: (query) => {
      setQueryFor(sessionId, query);
    },
    reset: () => {
      setQueryFor(sessionId, '');
    },
    isActive: state.query.length > 0,
  };
};
