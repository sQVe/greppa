import type { CommitEntry } from '@greppa/core';

import { decodeCommitFileKey } from '../commitFileKey';
import type { FileNode } from '../fixtures/types';
import { buildFilterPredicate } from './buildFilterPredicate';
import type { FilterState } from './useFileFilter';

export interface CommitVisibility {
  visibleFilesBySha: Map<string, string[]>;
  totalVisible: number;
  totalFiles: number;
}

const makeFileNode = (path: string, lookup: ReadonlyMap<string, FileNode>): FileNode => {
  const existing = lookup.get(path);
  if (existing != null) {
    return existing;
  }
  const name = path.split('/').pop() ?? path;
  return { path, name, type: 'file' };
};

const buildReviewedBySha = (reviewedCommitFiles: ReadonlySet<string>): Map<string, Set<string>> => {
  const result = new Map<string, Set<string>>();
  for (const key of reviewedCommitFiles) {
    const decoded = decodeCommitFileKey(key);
    if (decoded == null) {
      continue;
    }
    let set = result.get(decoded.sha);
    if (set == null) {
      set = new Set();
      result.set(decoded.sha, set);
    }
    set.add(decoded.path);
  }
  return result;
};

export const computeCommitVisibility = (
  commits: readonly CommitEntry[],
  reviewedCommitFiles: ReadonlySet<string>,
  filterState: FilterState,
  fileLookup: ReadonlyMap<string, FileNode>,
): CommitVisibility => {
  const reviewedBySha = buildReviewedBySha(reviewedCommitFiles);
  const visibleFilesBySha = new Map<string, string[]>();
  let totalVisible = 0;
  let totalFiles = 0;

  for (const commit of commits) {
    totalFiles += commit.files.length;
    const reviewedSet = reviewedBySha.get(commit.sha) ?? new Set<string>();
    const predicate = buildFilterPredicate(filterState, reviewedSet);
    if (predicate == null) {
      const all = [...commit.files];
      visibleFilesBySha.set(commit.sha, all);
      totalVisible += all.length;
      continue;
    }
    const visible: string[] = [];
    for (const path of commit.files) {
      if (predicate(makeFileNode(path, fileLookup))) {
        visible.push(path);
      }
    }
    visibleFilesBySha.set(commit.sha, visible);
    totalVisible += visible.length;
  }

  return { visibleFilesBySha, totalVisible, totalFiles };
};
