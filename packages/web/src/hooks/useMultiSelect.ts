import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useMemo, useRef } from 'react';

import type { StatePayload } from '../stateCache';
import { getOrCreateStateId } from '../stateCache';
import { toStringArray } from '../toStringArray';
import type { FileSource } from '../useFileSelection';

interface MultiSelectOptions {
  committedFilePaths: string[];
  worktreeFilePaths: string[];
}

interface NavigateOptions {
  replace?: boolean;
  hash?: string;
}

const SELECT_ALL = '*';

const resolveParams = (params: string[], allPaths: string[]): Set<string> => {
  if (params.length === 1 && params[0] === SELECT_ALL) {
    return new Set(allPaths);
  }
  return new Set(params);
};

const buildState = (paths: string[], source: FileSource): StatePayload =>
  source === 'committed'
    ? { file: paths, wt: [], commits: [], commitFile: [] }
    : { file: [], wt: paths, commits: [], commitFile: [] };

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
    (state: StatePayload, source: FileSource, options?: NavigateOptions) => {
      const id = getOrCreateStateId(state);
      const to = source === 'committed' ? ('/changes' as const) : ('/worktree' as const);
      const routeSearch =
        source === 'committed' ? { s: id, file: state.file } : { s: id, wt: state.wt };
      void navigate({ to, search: routeSearch, replace: options?.replace, hash: options?.hash });
    },
    [navigate],
  );

  const pathname = useRouterState({
    select: (s: { location: { pathname: string } }) => s.location.pathname,
  });
  const clear = useCallback(() => {
    anchorRef.current = null;
    const to = pathname === '/worktree' ? ('/worktree' as const) : ('/changes' as const);
    void navigate({ to, search: { s: '' }, replace: true });
  }, [navigate, pathname]);

  const select = useCallback(
    (path: string, source: FileSource, hash?: string) => {
      anchorRef.current = { path, source };
      navigateWithState(buildState([path], source), source, { hash });
    },
    [navigateWithState],
  );

  const toggle = useCallback(
    (path: string, source: FileSource, hash?: string) => {
      anchorRef.current = { path, source };
      if (activeSource !== source) {
        navigateWithState(buildState([path], source), source, { replace: true, hash });
        return;
      }
      const next = new Set(selectedPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      if (next.size === 0) {
        clear();
        return;
      }
      navigateWithState(buildState([...next], source), source, { replace: true, hash });
    },
    [navigateWithState, activeSource, selectedPaths, clear],
  );

  const selectRange = useCallback(
    (path: string, orderedPaths: string[], source: FileSource, hash?: string) => {
      const anchor = anchorRef.current?.source === source ? anchorRef.current.path : null;
      if (anchor == null) {
        anchorRef.current = { path, source };
        navigateWithState(buildState([path], source), source, { replace: true, hash });
        return;
      }

      const anchorIndex = orderedPaths.indexOf(anchor);
      const targetIndex = orderedPaths.indexOf(path);
      if (anchorIndex === -1 || targetIndex === -1) {
        anchorRef.current = { path, source };
        navigateWithState(buildState([path], source), source, { replace: true, hash });
        return;
      }

      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      const rangePaths = orderedPaths.slice(start, end + 1);
      navigateWithState(buildState(rangePaths, source), source, { replace: true, hash });
    },
    [navigateWithState],
  );

  const selectAll = useCallback(
    (paths: string[], source: FileSource) => {
      const allPaths = source === 'committed' ? committedFilePaths : worktreeFilePaths;
      const isAll = paths.length === allPaths.length && paths.every((p) => allPaths.includes(p));
      const value = isAll ? [SELECT_ALL] : paths;
      navigateWithState(buildState(value, source), source, { replace: true });
    },
    [navigateWithState, committedFilePaths, worktreeFilePaths],
  );

  const toggleAll = useCallback(
    (paths: string[], source: FileSource, hash?: string) => {
      if (activeSource !== source) {
        navigateWithState(buildState(paths, source), source, { replace: true, hash });
        return;
      }
      const allSelected = paths.every((p) => selectedPaths.has(p));
      if (allSelected) {
        const next = new Set(selectedPaths);
        for (const p of paths) {
          next.delete(p);
        }
        if (next.size === 0) {
          clear();
          return;
        }
        navigateWithState(buildState([...next], source), source, { replace: true, hash });
        return;
      }
      const next = new Set(selectedPaths);
      for (const p of paths) {
        next.add(p);
      }
      navigateWithState(buildState([...next], source), source, { replace: true, hash });
    },
    [navigateWithState, activeSource, selectedPaths, clear],
  );

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
