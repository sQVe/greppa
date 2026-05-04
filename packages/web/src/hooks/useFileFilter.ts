import { useCallback, useSyncExternalStore } from 'react';

import type { ChangeType } from '../fixtures/types';

export type ReviewedStatus = 'reviewed' | 'unreviewed';

export interface FilterState {
  query: string;
  extensions: string[];
  changeTypes: ChangeType[];
  statuses: ReviewedStatus[];
}

interface SessionStore {
  state: FilterState;
  listeners: (() => void)[];
}

interface UseFileFilterResult extends FilterState {
  setQuery: (query: string) => void;
  setExtensions: (extensions: string[]) => void;
  setChangeTypes: (changeTypes: ChangeType[]) => void;
  setStatuses: (statuses: ReviewedStatus[]) => void;
  reset: () => void;
  isActive: boolean;
}

const EMPTY_STATE: FilterState = {
  query: '',
  extensions: [],
  changeTypes: [],
  statuses: [],
};

const stores = new Map<string, SessionStore>();

const getStore = (sessionId: string): SessionStore => {
  let store = stores.get(sessionId);
  if (store == null) {
    store = { state: EMPTY_STATE, listeners: [] };
    stores.set(sessionId, store);
  }
  return store;
};

const emitChange = (store: SessionStore) => {
  for (const listener of store.listeners) {
    listener();
  }
};

const updateState = (sessionId: string, patch: Partial<FilterState>) => {
  const store = getStore(sessionId);
  store.state = { ...store.state, ...patch };
  emitChange(store);
};

const isActiveState = (state: FilterState) =>
  state.query.length > 0
  || state.extensions.length > 0
  || state.changeTypes.length > 0
  || state.statuses.length > 0;

export const useFileFilter = (sessionId: string): UseFileFilterResult => {
  const subscribe = useCallback(
    (listener: () => void) => {
      const store = getStore(sessionId);
      store.listeners = [...store.listeners, listener];
      return () => {
        store.listeners = store.listeners.filter((existing) => existing !== listener);
      };
    },
    [sessionId],
  );
  const getSnapshot = useCallback(() => getStore(sessionId).state, [sessionId]);
  const state = useSyncExternalStore(subscribe, getSnapshot);

  return {
    query: state.query,
    extensions: state.extensions,
    changeTypes: state.changeTypes,
    statuses: state.statuses,
    setQuery: (query) => {
      if (getStore(sessionId).state.query === query) return;
      updateState(sessionId, { query });
    },
    setExtensions: (extensions) => {
      updateState(sessionId, { extensions });
    },
    setChangeTypes: (changeTypes) => {
      updateState(sessionId, { changeTypes });
    },
    setStatuses: (statuses) => {
      updateState(sessionId, { statuses });
    },
    reset: () => {
      const store = getStore(sessionId);
      if (store.state === EMPTY_STATE) return;
      store.state = EMPTY_STATE;
      emitChange(store);
    },
    isActive: isActiveState(state),
  };
};
