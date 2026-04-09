import type { DiffResponse } from '@greppa/core';
import { createStore, get, set } from 'idb-keyval';

const DB_NAME = 'greppa-diff-cache';
const STORE_NAME = 'diffs';

const store = createStore(DB_NAME, STORE_NAME);

export interface DiffCacheKey {
  oldRef: string;
  newRef: string;
  path: string;
}

const buildKey = ({ oldRef, newRef, path }: DiffCacheKey): string =>
  `${oldRef}\u0000${newRef}\u0000${path}`;

export const getDiff = async (key: DiffCacheKey): Promise<DiffResponse | null> => {
  const value = await get<DiffResponse>(buildKey(key), store);
  return value ?? null;
};

export const setDiff = async (key: DiffCacheKey, value: DiffResponse): Promise<void> => {
  await set(buildKey(key), value, store);
};
