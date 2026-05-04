// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useFileFilter } from './useFileFilter';

describe('useFileFilter', () => {
  it('starts with empty facets and isActive false', () => {
    const { result } = renderHook(() => useFileFilter('committed-empty-init'));

    expect(result.current.query).toBe('');
    expect(result.current.extensions).toEqual([]);
    expect(result.current.changeTypes).toEqual([]);
    expect(result.current.statuses).toEqual([]);
    expect(result.current.isActive).toBe(false);
  });

  it('setQuery updates the query and isActive flips when non-empty', () => {
    const { result } = renderHook(() => useFileFilter('committed-set'));

    act(() => {
      result.current.setQuery('foo');
    });

    expect(result.current.query).toBe('foo');
    expect(result.current.isActive).toBe(true);
  });

  it('setExtensions updates extensions and isActive becomes true', () => {
    const { result } = renderHook(() => useFileFilter('committed-ext'));

    act(() => {
      result.current.setExtensions(['ts', 'tsx']);
    });

    expect(result.current.extensions).toEqual(['ts', 'tsx']);
    expect(result.current.isActive).toBe(true);
  });

  it('setChangeTypes updates changeTypes and isActive becomes true', () => {
    const { result } = renderHook(() => useFileFilter('committed-ct'));

    act(() => {
      result.current.setChangeTypes(['added', 'modified']);
    });

    expect(result.current.changeTypes).toEqual(['added', 'modified']);
    expect(result.current.isActive).toBe(true);
  });

  it('setStatuses updates statuses and isActive becomes true', () => {
    const { result } = renderHook(() => useFileFilter('committed-status'));

    act(() => {
      result.current.setStatuses(['reviewed']);
    });

    expect(result.current.statuses).toEqual(['reviewed']);
    expect(result.current.isActive).toBe(true);
  });

  it('reset clears every facet at once', () => {
    const { result } = renderHook(() => useFileFilter('committed-reset'));

    act(() => {
      result.current.setQuery('foo');
      result.current.setExtensions(['ts']);
      result.current.setChangeTypes(['modified']);
      result.current.setStatuses(['unreviewed']);
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.query).toBe('');
    expect(result.current.extensions).toEqual([]);
    expect(result.current.changeTypes).toEqual([]);
    expect(result.current.statuses).toEqual([]);
    expect(result.current.isActive).toBe(false);
  });

  it('keeps separate state per session id across all facets', () => {
    const a = renderHook(() => useFileFilter('isolation-a'));
    const b = renderHook(() => useFileFilter('isolation-b'));

    act(() => {
      a.result.current.setQuery('left');
      a.result.current.setExtensions(['ts']);
    });

    expect(a.result.current.query).toBe('left');
    expect(a.result.current.extensions).toEqual(['ts']);
    expect(b.result.current.query).toBe('');
    expect(b.result.current.extensions).toEqual([]);
  });
});
