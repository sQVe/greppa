import { useCallback, useMemo, useState } from 'react';

import type { FileSource } from '../useFileSelection';

interface MultiSelectState {
  paths: Set<string>;
  source: FileSource | null;
  anchorPath: string | null;
}

const EMPTY: MultiSelectState = { paths: new Set(), source: null, anchorPath: null };

export const useMultiSelect = () => {
  const [state, setState] = useState<MultiSelectState>(EMPTY);

  const select = useCallback((path: string, source: FileSource) => {
    setState({ paths: new Set([path]), source, anchorPath: path });
  }, []);

  const toggle = useCallback((path: string, source: FileSource) => {
    setState((prev) => {
      if (prev.source !== source) {
        return { paths: new Set([path]), source, anchorPath: path };
      }
      const next = new Set(prev.paths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { paths: next, source, anchorPath: path };
    });
  }, []);

  const selectRange = useCallback(
    (path: string, orderedPaths: string[], source: FileSource) => {
      setState((prev) => {
        const anchor = prev.source === source ? prev.anchorPath : null;
        if (anchor == null) {
          return { paths: new Set([path]), source, anchorPath: path };
        }

        const anchorIndex = orderedPaths.indexOf(anchor);
        const targetIndex = orderedPaths.indexOf(path);
        if (anchorIndex === -1 || targetIndex === -1) {
          return { paths: new Set([path]), source, anchorPath: path };
        }

        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        const rangePaths = new Set(orderedPaths.slice(start, end + 1));

        return { paths: rangePaths, source, anchorPath: anchor };
      });
    },
    [],
  );

  const selectAll = useCallback((paths: string[], source: FileSource) => {
    setState((prev) => ({ paths: new Set(paths), source, anchorPath: prev.anchorPath }));
  }, []);

  const toggleAll = useCallback((paths: string[], source: FileSource) => {
    setState((prev) => {
      if (prev.source !== source) {
        return { paths: new Set(paths), source, anchorPath: prev.anchorPath };
      }
      const allSelected = paths.every((p) => prev.paths.has(p));
      if (allSelected) {
        const next = new Set(prev.paths);
        for (const p of paths) {
          next.delete(p);
        }
        return { paths: next, source, anchorPath: prev.anchorPath };
      }
      const next = new Set(prev.paths);
      for (const p of paths) {
        next.add(p);
      }
      return { paths: next, source, anchorPath: prev.anchorPath };
    });
  }, []);

  const clear = useCallback(() => {
    setState(EMPTY);
  }, []);

  const isMultiSelect = useMemo(() => state.paths.size > 1, [state.paths]);

  return {
    selectedPaths: state.paths,
    activeSource: state.source,
    isMultiSelect,
    select,
    toggle,
    selectRange,
    selectAll,
    toggleAll,
    clear,
  };
};
