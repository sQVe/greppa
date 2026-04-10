// @vitest-environment happy-dom
import 'fake-indexeddb/auto';

import { renderHook, waitFor } from '@testing-library/react';
import { clear, createStore } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FileNode } from '../fixtures/types';
import * as diffCache from './diffCache';
import { fetchDiffContent } from './useDiffContent';
import { useWarmup } from './useWarmup';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readyState = 1;
  url: string;
  close = vi.fn(() => {
    this.readyState = 2;
  });
  private readonly _listeners = new Map<string, Set<(event: Event) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    let set = this._listeners.get(type);
    if (set == null) {
      set = new Set();
      this._listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this._listeners.get(type)?.delete(listener);
  }

  emit(payload: unknown) {
    const event = { data: JSON.stringify(payload) } as MessageEvent<string>;
    for (const listener of this._listeners.get('message') ?? []) {
      listener(event);
    }
  }

  emitDone() {
    const event = { data: '{}' } as MessageEvent<string>;
    for (const listener of this._listeners.get('done') ?? []) {
      listener(event);
    }
  }

  emitError() {
    const event = {} as Event;
    for (const listener of this._listeners.get('error') ?? []) {
      listener(event);
    }
  }
}

const file = (path: string): FileNode => ({
  path,
  name: path,
  type: 'file',
  changeType: 'modified',
  sizeTier: 'small',
});

describe('useWarmup', () => {
  beforeEach(async () => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    await clear(createStore('greppa-diff-cache', 'diffs'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('after a warm-up pass, fetchDiffContent for a warmed file makes zero fetch calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderHook(() => {
      useWarmup('refA', 'refB', [file('src/warmed.ts')]);
    });

    const eventSource = FakeEventSource.instances[0]!;
    const warmedDiff = {
      path: 'src/warmed.ts',
      changeType: 'modified' as const,
      oldContent: 'before',
      newContent: 'after',
    };
    eventSource.emit(warmedDiff);

    await waitFor(async () => {
      const stored = await diffCache.getDiff({
        oldRef: 'refA',
        newRef: 'refB',
        path: 'src/warmed.ts',
      });
      expect(stored).toEqual(warmedDiff);
    });

    const result = await fetchDiffContent('refA', 'refB', 'src/warmed.ts');

    expect(result).toEqual(warmedDiff);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips pushed diffs whose triple is already cached in diffCache', async () => {
    vi.spyOn(diffCache, 'getDiff').mockResolvedValue({
      path: 'src/already.ts',
      changeType: 'modified',
      oldContent: 'prev-old',
      newContent: 'prev-new',
    });
    const setSpy = vi.spyOn(diffCache, 'setDiff').mockResolvedValue(undefined);

    renderHook(() => {
      useWarmup('refOld', 'refNew', [file('src/already.ts')]);
    });

    const eventSource = FakeEventSource.instances[0]!;
    eventSource.emit({
      path: 'src/already.ts',
      changeType: 'modified',
      oldContent: 'new-old',
      newContent: 'new-new',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('writes each pushed diff to diffCache.setDiff with the matching triple', async () => {
    vi.spyOn(diffCache, 'getDiff').mockResolvedValue(null);
    const setSpy = vi.spyOn(diffCache, 'setDiff').mockResolvedValue(undefined);

    renderHook(() => {
      useWarmup('refOld', 'refNew', [file('src/a.ts'), file('src/b.ts')]);
    });

    expect(FakeEventSource.instances).toHaveLength(1);
    const eventSource = FakeEventSource.instances[0]!;
    expect(eventSource.url).toContain('/api/warmup/refOld/refNew');

    eventSource.emit({
      path: 'src/a.ts',
      changeType: 'modified',
      oldContent: 'old-a',
      newContent: 'new-a',
    });

    await waitFor(() => {
      expect(setSpy).toHaveBeenCalledWith(
        { oldRef: 'refOld', newRef: 'refNew', path: 'src/a.ts' },
        {
          path: 'src/a.ts',
          changeType: 'modified',
          oldContent: 'old-a',
          newContent: 'new-a',
        },
      );
    });
  });

  it('closes the EventSource when the server emits a done event', () => {
    renderHook(() => {
      useWarmup('refOld', 'refNew', [file('src/a.ts')]);
    });

    const eventSource = FakeEventSource.instances[0]!;
    expect(eventSource.close).not.toHaveBeenCalled();

    eventSource.emitDone();

    expect(eventSource.close).toHaveBeenCalledTimes(1);
  });

  it('closes the EventSource on error instead of letting it auto-reconnect', () => {
    renderHook(() => {
      useWarmup('refOld', 'refNew', [file('src/a.ts')]);
    });

    const eventSource = FakeEventSource.instances[0]!;
    expect(eventSource.close).not.toHaveBeenCalled();

    eventSource.emitError();

    expect(eventSource.close).toHaveBeenCalledTimes(1);
  });

  it('does not open a new EventSource when only the files array identity changes', () => {
    const firstFiles = [file('src/a.ts')];
    const { rerender } = renderHook(
      ({ files }) => {
        useWarmup('refOld', 'refNew', files);
      },
      { initialProps: { files: firstFiles } },
    );

    expect(FakeEventSource.instances).toHaveLength(1);

    rerender({ files: [file('src/a.ts')] });
    rerender({ files: [file('src/a.ts')] });

    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
