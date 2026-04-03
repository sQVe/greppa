import { useCallback, useMemo, useState } from 'react';

import type { FileSource } from '../useFileSelection';

interface MultiSelectState {
  paths: Set<string>;
  source: FileSource | null;
}

const EMPTY: MultiSelectState = { paths: new Set(), source: null };

export const useMultiSelect = () => {
  const [state, setState] = useState<MultiSelectState>(EMPTY);

  const select = useCallback((path: string, source: FileSource) => {
    setState({ paths: new Set([path]), source });
  }, []);

  const toggle = useCallback((path: string, source: FileSource) => {
    setState((prev) => {
      if (prev.source !== source) {
        return { paths: new Set([path]), source };
      }
      const next = new Set(prev.paths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { paths: next, source };
    });
  }, []);

  const selectAll = useCallback((paths: string[], source: FileSource) => {
    setState({ paths: new Set(paths), source });
  }, []);

  const toggleAll = useCallback((paths: string[], source: FileSource) => {
    setState((prev) => {
      if (prev.source !== source) {
        return { paths: new Set(paths), source };
      }
      const allSelected = paths.every((p) => prev.paths.has(p));
      if (allSelected) {
        const next = new Set(prev.paths);
        for (const p of paths) {
          next.delete(p);
        }
        return { paths: next, source };
      }
      const next = new Set(prev.paths);
      for (const p of paths) {
        next.add(p);
      }
      return { paths: next, source };
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
    selectAll,
    toggleAll,
    clear,
  };
};
