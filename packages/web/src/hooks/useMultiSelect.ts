import { useNavigate, useRouterState } from '@tanstack/react-router';
import { nanoid } from 'nanoid';
import { useCallback, useMemo, useRef } from 'react';

import type { FileSource } from '../useFileSelection';
import type { StatePayload } from '../stateCache';
import { cacheState, findExistingId, postState } from '../stateCache';
import { toStringArray } from '../toStringArray';

const SELECT_ALL = '*';

interface MultiSelectOptions {
  committedFilePaths: string[];
  worktreeFilePaths: string[];
}

const resolveParams = (params: string[], allPaths: string[]): Set<string> => {
  if (params.length === 1 && params[0] === SELECT_ALL) {
    return new Set(allPaths);
  }
  return new Set(params);
};

const buildState = (paths: string[], source: FileSource): StatePayload =>
  source === 'committed'
    ? { file: paths, wt: [], commits: [] }
    : { file: [], wt: paths, commits: [] };

const selectFileParams = (s: { location: { search: Record<string, unknown> } }) =>
  toStringArray(s.location.search.file);

const selectWtParams = (s: { location: { search: Record<string, unknown> } }) =>
  toStringArray(s.location.search.wt);

export const useMultiSelect = ({ committedFilePaths, worktreeFilePaths }: MultiSelectOptions) => {
  const fileParams = useRouterState({ select: selectFileParams });
  const wtParams = useRouterState({ select: selectWtParams });

  const navigate = useNavigate();
  const anchorRef = useRef<{ path: string; source: FileSource } | null>(null);

  const selectedPaths = useMemo(() => {
    if (fileParams.length > 0) {
      return resolveParams(fileParams, committedFilePaths);
    }
    if (wtParams.length > 0) {
      return resolveParams(wtParams, worktreeFilePaths);
    }
    return new Set<string>();
  }, [fileParams, wtParams, committedFilePaths, worktreeFilePaths]);

  const activeSource: FileSource | null = useMemo(() => {
    if (fileParams.length > 0) {
      return 'committed';
    }
    if (wtParams.length > 0) {
      return 'worktree';
    }
    return null;
  }, [fileParams, wtParams]);

  const isMultiSelect = useMemo(() => selectedPaths.size > 1, [selectedPaths]);

  const navigateWithState = useCallback(
    (state: StatePayload, source: FileSource, replace?: boolean, hash?: string) => {
      const existing = findExistingId(state);
      const id = existing ?? nanoid(4);
      if (existing == null) {
        cacheState(id, state);
        postState(id, state);
      }
      const to = source === 'committed' ? '/changes' as const : '/worktree' as const;
      const routeSearch = source === 'committed'
        ? { s: id, file: state.file }
        : { s: id, wt: state.wt };
      void navigate({ to, search: routeSearch, replace, hash });
    },
    [navigate],
  );

  const select = useCallback(
    (path: string, source: FileSource, hash?: string) => {
      anchorRef.current = { path, source };
      navigateWithState(buildState([path], source), source, false, hash);
    },
    [navigateWithState],
  );

  const toggle = useCallback(
    (path: string, source: FileSource, hash?: string) => {
      anchorRef.current = { path, source };
      if (activeSource !== source) {
        navigateWithState(buildState([path], source), source, true, hash);
        return;
      }
      const next = new Set(selectedPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      navigateWithState(buildState([...next], source), source, true, hash);
    },
    [navigateWithState, activeSource, selectedPaths],
  );

  const selectRange = useCallback(
    (path: string, orderedPaths: string[], source: FileSource, hash?: string) => {
      const anchor = anchorRef.current?.source === source ? anchorRef.current.path : null;
      if (anchor == null) {
        anchorRef.current = { path, source };
        navigateWithState(buildState([path], source), source, true, hash);
        return;
      }

      const anchorIndex = orderedPaths.indexOf(anchor);
      const targetIndex = orderedPaths.indexOf(path);
      if (anchorIndex === -1 || targetIndex === -1) {
        anchorRef.current = { path, source };
        navigateWithState(buildState([path], source), source, true, hash);
        return;
      }

      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      const rangePaths = orderedPaths.slice(start, end + 1);
      navigateWithState(buildState(rangePaths, source), source, true, hash);
    },
    [navigateWithState],
  );

  const selectAll = useCallback(
    (_paths: string[], source: FileSource) => {
      navigateWithState(buildState([SELECT_ALL], source), source, true);
    },
    [navigateWithState],
  );

  const toggleAll = useCallback(
    (paths: string[], source: FileSource, hash?: string) => {
      if (activeSource !== source) {
        navigateWithState(buildState(paths, source), source, true, hash);
        return;
      }
      const allSelected = paths.every((p) => selectedPaths.has(p));
      if (allSelected) {
        const next = new Set(selectedPaths);
        for (const p of paths) {
          next.delete(p);
        }
        navigateWithState(buildState([...next], source), source, true, hash);
        return;
      }
      const next = new Set(selectedPaths);
      for (const p of paths) {
        next.add(p);
      }
      navigateWithState(buildState([...next], source), source, true, hash);
    },
    [navigateWithState, activeSource, selectedPaths],
  );

  const pathname = useRouterState({ select: (s: { location: { pathname: string } }) => s.location.pathname });
  const clear = useCallback(() => {
    anchorRef.current = null;
    const to = pathname === '/worktree' ? '/worktree' as const : '/changes' as const;
    void navigate({ to, search: { s: '' }, replace: true });
  }, [navigate, pathname]);

  return {
    selectedPaths,
    activeSource,
    isMultiSelect,
    select,
    toggle,
    selectRange,
    selectAll,
    toggleAll,
    clear,
  };
};
