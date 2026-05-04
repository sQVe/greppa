// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useFileFilter } from './useFileFilter';

describe('useFileFilter', () => {
  it('starts with an empty query and isActive false', () => {
    const { result } = renderHook(() => useFileFilter('committed-empty-init'));

    expect(result.current.query).toBe('');
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

  it('reset clears a previously set query', () => {
    const { result } = renderHook(() => useFileFilter('committed-reset'));

    act(() => {
      result.current.setQuery('foo');
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.query).toBe('');
    expect(result.current.isActive).toBe(false);
  });

  it('keeps separate state per session id', () => {
    const a = renderHook(() => useFileFilter('isolation-a'));
    const b = renderHook(() => useFileFilter('isolation-b'));

    act(() => {
      a.result.current.setQuery('left');
    });

    expect(a.result.current.query).toBe('left');
    expect(b.result.current.query).toBe('');
  });
});
