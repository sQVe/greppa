import type { ChangeType, FileNode } from '../fixtures/types';
import type { FilterPredicate } from './applyFilter';
import type { FilterState } from './useFileFilter';

type ReviewedStatus = 'reviewed' | 'unreviewed';

const getExtension = (name: string): string => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot + 1).toLowerCase();
};

const queryMatcher = (query: string): FilterPredicate | null => {
  if (query.length === 0) {
    return null;
  }
  const needle = query.toLowerCase();
  return (file) => file.name.toLowerCase().includes(needle);
};

const extensionMatcher = (extensions: string[]): FilterPredicate | null => {
  if (extensions.length === 0) {
    return null;
  }
  const set = new Set(extensions.map((ext) => ext.toLowerCase()));
  return (file) => set.has(getExtension(file.name));
};

const changeTypeMatcher = (changeTypes: ChangeType[]): FilterPredicate | null => {
  if (changeTypes.length === 0) {
    return null;
  }
  const set = new Set(changeTypes);
  return (file) => file.changeType != null && set.has(file.changeType);
};

const statusMatcher = (
  statuses: ReviewedStatus[],
  reviewedPaths: ReadonlySet<string>,
): FilterPredicate | null => {
  if (statuses.length === 0) {
    return null;
  }
  const set = new Set(statuses);
  return (file) => set.has(reviewedPaths.has(file.path) ? 'reviewed' : 'unreviewed');
};

export const buildFilterPredicate = (
  state: FilterState,
  reviewedPaths: ReadonlySet<string>,
): FilterPredicate | null => {
  const matchers = [
    queryMatcher(state.query),
    extensionMatcher(state.extensions),
    changeTypeMatcher(state.changeTypes),
    statusMatcher(state.statuses, reviewedPaths),
  ].filter((m): m is FilterPredicate => m !== null);

  if (matchers.length === 0) {
    return null;
  }
  return (file: FileNode) => matchers.every((m) => m(file));
};
