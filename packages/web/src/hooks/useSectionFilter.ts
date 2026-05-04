import { useCallback, useMemo } from 'react';

import type { ChangeType, FileNode } from '../fixtures/types';
import type { ApplyFilterResult, FilterPredicate } from './applyFilter';
import { applyFilter } from './applyFilter';
import { buildFilterPredicate } from './buildFilterPredicate';
import {
  collectChangeTypeCounts,
  collectExtensionCounts,
  collectStatusCounts,
} from './facetCounts';
import type { ReviewedStatus } from './useFileFilter';
import { useFileFilter } from './useFileFilter';

interface FacetRows {
  extensions: { extension: string; count: number }[];
  changeTypes: { type: ChangeType; count: number }[];
  statuses: { status: ReviewedStatus; count: number }[];
}

interface SelectedSets {
  extensions: ReadonlySet<string>;
  changeTypes: ReadonlySet<ChangeType>;
  statuses: ReadonlySet<ReviewedStatus>;
}

interface Toggles {
  toggleExtension: (extension: string) => void;
  toggleChangeType: (type: ChangeType) => void;
  toggleStatus: (status: ReviewedStatus) => void;
}

interface UseSectionFilterResult {
  filter: ReturnType<typeof useFileFilter>;
  predicate: FilterPredicate | null;
  filtered: ApplyFilterResult;
  rows: FacetRows;
  selectedSets: SelectedSets;
  toggles: Toggles;
}

const CHANGE_TYPE_ORDER: ChangeType[] = ['added', 'modified', 'deleted', 'renamed'];

export const useSectionFilter = (
  sessionId: string,
  files: FileNode[],
  reviewedSet: ReadonlySet<string>,
): UseSectionFilterResult => {
  const filter = useFileFilter(sessionId);

  const predicate = useMemo(
    () =>
      buildFilterPredicate(
        {
          query: filter.query,
          extensions: filter.extensions,
          changeTypes: filter.changeTypes,
          statuses: filter.statuses,
        },
        reviewedSet,
      ),
    [filter.query, filter.extensions, filter.changeTypes, filter.statuses, reviewedSet],
  );

  const filtered = useMemo(() => applyFilter(files, predicate), [files, predicate]);

  const extensionsRows = useMemo(() => collectExtensionCounts(files), [files]);
  const changeTypeRows = useMemo(() => {
    const counts = collectChangeTypeCounts(files);
    return CHANGE_TYPE_ORDER.map((type) => ({ type, count: counts[type] }));
  }, [files]);
  const statusRows = useMemo(() => {
    const counts = collectStatusCounts(files, reviewedSet);
    return [
      { status: 'reviewed' as const, count: counts.reviewed },
      { status: 'unreviewed' as const, count: counts.unreviewed },
    ];
  }, [files, reviewedSet]);

  const selectedExtensions = useMemo(() => new Set(filter.extensions), [filter.extensions]);
  const selectedChangeTypes = useMemo(() => new Set(filter.changeTypes), [filter.changeTypes]);
  const selectedStatuses = useMemo(() => new Set(filter.statuses), [filter.statuses]);

  const toggleExtension = useCallback(
    (extension: string) => {
      const next = selectedExtensions.has(extension)
        ? filter.extensions.filter((e) => e !== extension)
        : [...filter.extensions, extension];
      filter.setExtensions(next);
    },
    [selectedExtensions, filter],
  );
  const toggleChangeType = useCallback(
    (type: ChangeType) => {
      const next = selectedChangeTypes.has(type)
        ? filter.changeTypes.filter((t) => t !== type)
        : [...filter.changeTypes, type];
      filter.setChangeTypes(next);
    },
    [selectedChangeTypes, filter],
  );
  const toggleStatus = useCallback(
    (status: ReviewedStatus) => {
      const next = selectedStatuses.has(status)
        ? filter.statuses.filter((s) => s !== status)
        : [...filter.statuses, status];
      filter.setStatuses(next);
    },
    [selectedStatuses, filter],
  );

  return {
    filter,
    predicate,
    filtered,
    rows: { extensions: extensionsRows, changeTypes: changeTypeRows, statuses: statusRows },
    selectedSets: {
      extensions: selectedExtensions,
      changeTypes: selectedChangeTypes,
      statuses: selectedStatuses,
    },
    toggles: { toggleExtension, toggleChangeType, toggleStatus },
  };
};
