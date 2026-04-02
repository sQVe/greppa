// @vitest-environment happy-dom
import { Schema } from 'effect';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPersistedStore } from './createPersistedStore';

const TestSchema = Schema.Struct({
  color: Schema.String,
  count: Schema.Number,
});

const defaults = { color: 'red', count: 0 };

describe('createPersistedStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns defaults when localStorage key is missing', () => {
    const useStore = createPersistedStore({
      key: 'gr-test',
      schema: TestSchema,
      defaults,
    });

    const { result } = renderHook(() => useStore());
    expect(result.current.state).toEqual(defaults);
  });

  it('returns defaults when localStorage contains malformed JSON', () => {
    localStorage.setItem('gr-test', '{not valid json');
    const useStore = createPersistedStore({
      key: 'gr-test',
      schema: TestSchema,
      defaults,
    });

    const { result } = renderHook(() => useStore());
    expect(result.current.state).toEqual(defaults);
  });

  it('returns defaults when localStorage data fails Schema validation', () => {
    localStorage.setItem('gr-test', JSON.stringify({ color: 123, count: 'bad' }));
    const useStore = createPersistedStore({
      key: 'gr-test',
      schema: TestSchema,
      defaults,
    });

    const { result } = renderHook(() => useStore());
    expect(result.current.state).toEqual(defaults);
  });

  it('returns valid stored data when localStorage contains conforming JSON', () => {
    const stored = { color: 'blue', count: 42 };
    localStorage.setItem('gr-test', JSON.stringify(stored));
    const useStore = createPersistedStore({
      key: 'gr-test',
      schema: TestSchema,
      defaults,
    });

    const { result } = renderHook(() => useStore());
    expect(result.current.state).toEqual(stored);
  });

  it('set() writes partial updates to localStorage and notifies listeners', () => {
    const useStore = createPersistedStore({
      key: 'gr-test',
      schema: TestSchema,
      defaults,
    });

    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.set({ color: 'green' });
    });

    expect(result.current.state).toEqual({ color: 'green', count: 0 });
    expect(JSON.parse(localStorage.getItem('gr-test')!)).toEqual({
      color: 'green',
      count: 0,
    });
  });

  it('set() merges into existing state without replacing other fields', () => {
    localStorage.setItem('gr-test', JSON.stringify({ color: 'blue', count: 5 }));
    const useStore = createPersistedStore({
      key: 'gr-test',
      schema: TestSchema,
      defaults,
    });

    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.set({ count: 10 });
    });

    expect(result.current.state).toEqual({ color: 'blue', count: 10 });
  });

  it('multiple stores with different keys are independent', () => {
    const useStoreA = createPersistedStore({
      key: 'gr-a',
      schema: TestSchema,
      defaults,
    });
    const useStoreB = createPersistedStore({
      key: 'gr-b',
      schema: TestSchema,
      defaults: { color: 'yellow', count: 99 },
    });

    const { result: resultA } = renderHook(() => useStoreA());
    const { result: resultB } = renderHook(() => useStoreB());

    act(() => {
      resultA.current.set({ color: 'purple' });
    });

    expect(resultA.current.state).toEqual({ color: 'purple', count: 0 });
    expect(resultB.current.state).toEqual({ color: 'yellow', count: 99 });
  });

  it('returns defaults when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const useStore = createPersistedStore({
      key: 'gr-test',
      schema: TestSchema,
      defaults,
    });

    const { result } = renderHook(() => useStore());
    expect(result.current.state).toEqual(defaults);
  });
});
