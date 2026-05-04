// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FileNode } from '../../fixtures/types';
import { FileTreePanel } from './FileTreePanel';

const committedFiles: FileNode[] = [
  {
    path: 'src/auth.ts',
    name: 'auth.ts',
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
        }}
      />,
    );

    expect(screen.getByText(/no files match/i)).toBeDefined();
    const clearButton = screen.getByRole('button', { name: /clear filter/i });
    await userEvent.click(clearButton);
    expect(reset).toHaveBeenCalled();
  });

  it('omits the filter bar when no committedFilter prop is supplied', () => {
    render(<FileTreePanel {...baseProps} />);
    expect(screen.queryByRole('searchbox', { name: /filter files/i })).toBeNull();
  });
});
