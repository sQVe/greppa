import { describe, expect, it } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { buildFilterPredicate } from './buildFilterPredicate';

const file = (overrides: Partial<FileNode> & Pick<FileNode, 'name' | 'path'>): FileNode => ({
  type: 'file',
  ...overrides,
});

const EMPTY_REVIEWED: ReadonlySet<string> = new Set();

describe('buildFilterPredicate', () => {
  it('returns null when every facet is empty', () => {
    const predicate = buildFilterPredicate(
      { query: '', extensions: [], changeTypes: [], statuses: [] },
      EMPTY_REVIEWED,
    );

    expect(predicate).toBeNull();
  });

  it('matches the query against node.name case-insensitively', () => {
    const predicate = buildFilterPredicate(
      { query: 'INDEX', extensions: [], changeTypes: [], statuses: [] },
      EMPTY_REVIEWED,
    );

    expect(predicate).not.toBeNull();
    expect(predicate?.(file({ name: 'index.ts', path: 'src/index.ts' }))).toBe(true);
    expect(predicate?.(file({ name: 'README.md', path: 'README.md' }))).toBe(false);
  });

  it('OR-combines extensions within the group', () => {
    const predicate = buildFilterPredicate(
      { query: '', extensions: ['ts', 'md'], changeTypes: [], statuses: [] },
      EMPTY_REVIEWED,
    );

    expect(predicate?.(file({ name: 'index.ts', path: 'a/index.ts' }))).toBe(true);
    expect(predicate?.(file({ name: 'README.md', path: 'README.md' }))).toBe(true);
    expect(predicate?.(file({ name: 'page.tsx', path: 'a/page.tsx' }))).toBe(false);
  });

  it('matches files with no extension when "" is selected', () => {
    const predicate = buildFilterPredicate(
      { query: '', extensions: [''], changeTypes: [], statuses: [] },
      EMPTY_REVIEWED,
    );

    expect(predicate?.(file({ name: 'Makefile', path: 'Makefile' }))).toBe(true);
    expect(predicate?.(file({ name: 'a.ts', path: 'a.ts' }))).toBe(false);
  });

  it('OR-combines change types within the group', () => {
    const predicate = buildFilterPredicate(
      { query: '', extensions: [], changeTypes: ['added', 'deleted'], statuses: [] },
      EMPTY_REVIEWED,
    );

    expect(predicate?.(file({ name: 'a.ts', path: 'a.ts', changeType: 'added' }))).toBe(true);
    expect(predicate?.(file({ name: 'b.ts', path: 'b.ts', changeType: 'deleted' }))).toBe(true);
    expect(predicate?.(file({ name: 'c.ts', path: 'c.ts', changeType: 'modified' }))).toBe(false);
  });

  it('reviewed status uses reviewedPaths membership', () => {
    const reviewed = new Set(['a.ts']);
    const predicate = buildFilterPredicate(
      { query: '', extensions: [], changeTypes: [], statuses: ['reviewed'] },
      reviewed,
    );

    expect(predicate?.(file({ name: 'a.ts', path: 'a.ts' }))).toBe(true);
    expect(predicate?.(file({ name: 'b.ts', path: 'b.ts' }))).toBe(false);
  });

  it('unreviewed status excludes files present in reviewedPaths', () => {
    const reviewed = new Set(['a.ts']);
    const predicate = buildFilterPredicate(
      { query: '', extensions: [], changeTypes: [], statuses: ['unreviewed'] },
      reviewed,
    );

    expect(predicate?.(file({ name: 'a.ts', path: 'a.ts' }))).toBe(false);
    expect(predicate?.(file({ name: 'b.ts', path: 'b.ts' }))).toBe(true);
  });

  it('selecting both reviewed and unreviewed matches everything (OR within group)', () => {
    const reviewed = new Set(['a.ts']);
    const predicate = buildFilterPredicate(
      { query: '', extensions: [], changeTypes: [], statuses: ['reviewed', 'unreviewed'] },
      reviewed,
    );

    expect(predicate?.(file({ name: 'a.ts', path: 'a.ts' }))).toBe(true);
    expect(predicate?.(file({ name: 'b.ts', path: 'b.ts' }))).toBe(true);
  });

  it('AND-combines facets across groups', () => {
    const reviewed = new Set<string>();
    const predicate = buildFilterPredicate(
      {
        query: 'index',
        extensions: ['ts'],
        changeTypes: ['modified'],
        statuses: ['unreviewed'],
      },
      reviewed,
    );

    expect(
      predicate?.(file({ name: 'index.ts', path: 'src/index.ts', changeType: 'modified' })),
    ).toBe(true);
    expect(
      predicate?.(file({ name: 'index.tsx', path: 'src/index.tsx', changeType: 'modified' })),
    ).toBe(false);
    expect(predicate?.(file({ name: 'index.ts', path: 'src/index.ts', changeType: 'added' }))).toBe(
      false,
    );
    expect(
      predicate?.(file({ name: 'config.ts', path: 'src/config.ts', changeType: 'modified' })),
    ).toBe(false);
  });

  it('extension match is case-insensitive', () => {
    const predicate = buildFilterPredicate(
      { query: '', extensions: ['ts'], changeTypes: [], statuses: [] },
      EMPTY_REVIEWED,
    );

    expect(predicate?.(file({ name: 'index.TS', path: 'a/index.TS' }))).toBe(true);
  });
});
