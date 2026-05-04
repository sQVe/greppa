// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChangeType, FileNode } from '../../fixtures/types';
import type { ReviewedStatus } from '../../hooks/useFileFilter';
import { FileTreePanel } from './FileTreePanel';

const emptyFacets = {
  extensions: [] as { extension: string; count: number }[],
  changeTypes: [] as { type: ChangeType; count: number }[],
  statuses: [] as { status: ReviewedStatus; count: number }[],
  selectedExtensions: new Set<string>(),
  selectedChangeTypes: new Set<ChangeType>(),
  selectedStatuses: new Set<ReviewedStatus>(),
  onToggleExtension: vi.fn(),
  onToggleChangeType: vi.fn(),
  onToggleStatus: vi.fn(),
};

const committedFiles: FileNode[] = [
  {
    path: 'src/auth.ts',
    name: 'auth.ts',
    type: 'file',
    changeType: 'modified',
  },
];

const worktreeFiles: FileNode[] = [
  {
    path: 'src/draft.ts',
    name: 'draft.ts',
    type: 'file',
    changeType: 'modified',
  },
];

const baseProps = {
  expandedSection: 'committed' as const,
  committedFiles,
  worktreeFiles: [] as FileNode[],
  commits: [],
  selectedPaths: new Set<string>(),
  selectedSource: null,
  selectedCommitShas: new Set<string>(),
  committedExpandedKeys: new Set<string>(),
  worktreeExpandedKeys: new Set<string>(),
  onToggleSection: vi.fn(),
  onSelectCommittedFile: vi.fn(),
  onSelectWorktreeFile: vi.fn(),
  onSelectCommittedDirectory: vi.fn(),
  onSelectWorktreeDirectory: vi.fn(),
  onSelectCommit: vi.fn(),
  onCommittedExpandedKeysChange: vi.fn(),
  onWorktreeExpandedKeysChange: vi.fn(),
};

afterEach(() => {
  cleanup();
});

describe('FileTreePanel', () => {
  it('renders FileFilterBar above the Changes tree when a filter is supplied', () => {
    render(
      <FileTreePanel
        {...baseProps}
        committedFilter={{
          query: '',
          isActive: false,
          setQuery: vi.fn(),
          reset: vi.fn(),
          visibleCount: 1,
          totalCount: 1,
          ...emptyFacets,
        }}
      />,
    );

    expect(screen.getByRole('searchbox', { name: /filter files/i })).toBeDefined();
  });

  it('renders the No files match placeholder when filter narrows to zero', async () => {
    const reset = vi.fn();
    render(
      <FileTreePanel
        {...baseProps}
        committedFiles={[]}
        committedFilter={{
          query: 'zzz',
          isActive: true,
          setQuery: vi.fn(),
          reset,
          visibleCount: 0,
          totalCount: 1,
          ...emptyFacets,
        }}
      />,
    );

    const placeholder = screen.getByText(/no files match/i).parentElement;
    expect(placeholder).not.toBeNull();
    const clearButton = placeholder?.querySelector('button');
    expect(clearButton).not.toBeNull();
    await userEvent.click(clearButton as HTMLButtonElement);
    expect(reset).toHaveBeenCalled();
  });

  it('omits the filter bar when no committedFilter prop is supplied', () => {
    render(<FileTreePanel {...baseProps} />);
    expect(screen.queryByRole('searchbox', { name: /filter files/i })).toBeNull();
  });

  it('renders FileFilterBar above the Working tree when a worktreeFilter is supplied', () => {
    render(
      <FileTreePanel
        {...baseProps}
        expandedSection="worktree"
        worktreeFiles={worktreeFiles}
        worktreeFilter={{
          query: '',
          isActive: false,
          setQuery: vi.fn(),
          reset: vi.fn(),
          visibleCount: 1,
          totalCount: 1,
          ...emptyFacets,
        }}
      />,
    );

    expect(screen.getByRole('searchbox', { name: /filter files/i })).toBeDefined();
  });

  it('renders the No files match placeholder when worktree filter narrows to zero', async () => {
    const reset = vi.fn();
    render(
      <FileTreePanel
        {...baseProps}
        expandedSection="worktree"
        worktreeFiles={[]}
        worktreeFilter={{
          query: 'zzz',
          isActive: true,
          setQuery: vi.fn(),
          reset,
          visibleCount: 0,
          totalCount: 1,
          ...emptyFacets,
        }}
      />,
    );

    const placeholder = screen.getByText(/no files match/i).parentElement;
    expect(placeholder).not.toBeNull();
    const clearButton = placeholder?.querySelector('button');
    expect(clearButton).not.toBeNull();
    await userEvent.click(clearButton as HTMLButtonElement);
    expect(reset).toHaveBeenCalled();
  });

  it('omits the worktree filter bar when no worktreeFilter prop is supplied', () => {
    render(<FileTreePanel {...baseProps} expandedSection="worktree" />);
    expect(screen.queryByRole('searchbox', { name: /filter files/i })).toBeNull();
  });

  it('renders FileFilterBar above the Commits section when a commitsFilter is supplied', () => {
    render(
      <FileTreePanel
        {...baseProps}
        expandedSection="commits"
        commits={[
          {
            sha: 'aaa111',
            abbrevSha: 'aaa',
            subject: 'feat: x',
            author: 'Alice',
            date: '2026-04-03T10:00:00+00:00',
            files: ['src/a.ts'],
          },
        ]}
        commitsFilter={{
          query: '',
          isActive: false,
          setQuery: vi.fn(),
          reset: vi.fn(),
          visibleCount: 1,
          totalCount: 1,
          ...emptyFacets,
        }}
      />,
    );

    expect(screen.getByRole('searchbox', { name: /filter files/i })).toBeDefined();
  });

  it('renders the No files match placeholder when commits filter narrows to zero', async () => {
    const reset = vi.fn();
    render(
      <FileTreePanel
        {...baseProps}
        expandedSection="commits"
        commits={[
          {
            sha: 'aaa111',
            abbrevSha: 'aaa',
            subject: 'feat: x',
            author: 'Alice',
            date: '2026-04-03T10:00:00+00:00',
            files: ['src/a.ts'],
          },
        ]}
        commitsFilter={{
          query: 'zzz',
          isActive: true,
          setQuery: vi.fn(),
          reset,
          visibleCount: 0,
          totalCount: 1,
          ...emptyFacets,
        }}
      />,
    );

    const placeholder = screen.getByText(/no files match/i).parentElement;
    expect(placeholder).not.toBeNull();
    const clearButton = placeholder?.querySelector('button');
    await userEvent.click(clearButton as HTMLButtonElement);
    expect(reset).toHaveBeenCalled();
  });

  it('omits the commits filter bar when no commitsFilter prop is supplied', () => {
    render(<FileTreePanel {...baseProps} expandedSection="commits" />);
    expect(screen.queryByRole('searchbox', { name: /filter files/i })).toBeNull();
  });
});
