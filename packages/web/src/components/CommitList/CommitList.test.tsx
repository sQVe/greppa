// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CommitEntry } from '@greppa/core';

import { CommitList } from './CommitList';

const commits: CommitEntry[] = [
  { sha: 'aaa111', abbrevSha: 'aaa', subject: 'feat: first commit', author: 'Alice', date: '2026-04-03T10:00:00+00:00', files: ['src/a.ts'] },
  { sha: 'bbb222', abbrevSha: 'bbb', subject: 'fix: second commit', author: 'Bob', date: '2026-04-02T09:00:00+00:00', files: ['src/b.ts'] },
  { sha: 'ccc333', abbrevSha: 'ccc', subject: 'chore: third commit', author: 'Carol', date: '2026-04-01T08:00:00+00:00', files: ['src/c.ts'] },
];

const defaultProps = {
  commits,
  selectedShas: new Set<string>(),
  onSelectCommit: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CommitList', () => {
  it('should render commit items with hash and subject', () => {
    render(<CommitList {...defaultProps} />);

    screen.getByText('aaa');
    screen.getByText('feat: first commit');
    screen.getByText('bbb');
    screen.getByText('fix: second commit');
  });

  it('should call onSelectCommit with sha and shiftKey=false on click', async () => {
    const user = userEvent.setup();
    const onSelectCommit = vi.fn();
    render(<CommitList {...defaultProps} onSelectCommit={onSelectCommit} />);

    await user.click(screen.getByText('feat: first commit'));

    expect(onSelectCommit).toHaveBeenCalledWith('aaa111', { shiftKey: false, metaKey: false });
  });

  it('should call onSelectCommit with shiftKey=true on shift+click', async () => {
    const user = userEvent.setup();
    const onSelectCommit = vi.fn();
    render(<CommitList {...defaultProps} onSelectCommit={onSelectCommit} />);

    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('fix: second commit'));
    await user.keyboard('{/Shift}');

    expect(onSelectCommit).toHaveBeenCalledWith('bbb222', { shiftKey: true, metaKey: false });
  });

  it('should highlight selected commits', () => {
    render(<CommitList {...defaultProps} selectedShas={new Set(['aaa111'])} />);
    const items = screen.getAllByRole('row');

    expect(items[0]?.getAttribute('aria-selected')).toBe('true');
    expect(items[1]?.getAttribute('aria-selected')).toBe('false');
  });

  it('should render empty state when no commits', () => {
    render(<CommitList {...defaultProps} commits={[]} />);

    expect(screen.queryByRole('row')).toBeNull();
  });

  it('should toggle expansion on chevron click without calling onSelectCommit', async () => {
    const user = userEvent.setup();
    const onSelectCommit = vi.fn();
    render(<CommitList {...defaultProps} onSelectCommit={onSelectCommit} />);

    const row = screen.getByRole('row', { name: /feat: first commit/i });
    expect(row.getAttribute('aria-expanded')).toBe('false');

    const chevron = within(row).getByRole('button');
    await user.click(chevron);

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(onSelectCommit).not.toHaveBeenCalled();
  });

  it('should render files as flat children when commit is expanded', async () => {
    const user = userEvent.setup();
    render(<CommitList {...defaultProps} />);

    const row = screen.getByRole('row', { name: /feat: first commit/i });
    await user.click(within(row).getByRole('button'));

    expect(screen.getByText('src/a.ts')).toBeDefined();
  });

  it('should call onSelectCommitFile and not onSelectCommit when a file child is clicked', async () => {
    const user = userEvent.setup();
    const onSelectCommit = vi.fn();
    const onSelectCommitFile = vi.fn();
    render(
      <CommitList
        {...defaultProps}
        onSelectCommit={onSelectCommit}
        onSelectCommitFile={onSelectCommitFile}
      />,
    );

    const row = screen.getByRole('row', { name: /feat: first commit/i });
    await user.click(within(row).getByRole('button'));

    onSelectCommit.mockClear();
    await user.click(screen.getByText('src/a.ts'));

    expect(onSelectCommitFile).toHaveBeenCalledWith(
      'aaa111',
      'src/a.ts',
      ['src/a.ts'],
      { shiftKey: false, metaKey: false },
    );
    expect(onSelectCommit).not.toHaveBeenCalled();
  });

  it('should mark the matching child file row as aria-selected when it appears in selectedCommitFiles', async () => {
    const user = userEvent.setup();
    const commitsWithMultipleFiles: CommitEntry[] = [
      {
        sha: 'aaa111',
        abbrevSha: 'aaa',
        subject: 'feat: first commit',
        author: 'Alice',
        date: '2026-04-03T10:00:00+00:00',
        files: ['src/a.ts', 'src/b.ts'],
      },
    ];
    render(
      <CommitList
        {...defaultProps}
        commits={commitsWithMultipleFiles}
        selectedCommitFiles={new Set(['aaa111:src/a.ts'])}
      />,
    );

    const commitRow = screen.getByRole('row', { name: /feat: first commit/i });
    await user.click(within(commitRow).getByRole('button'));

    const selectedChild = screen.getByRole('row', { name: /src\/a\.ts/ });
    const unselectedChild = screen.getByRole('row', { name: /src\/b\.ts/ });
    expect(selectedChild.getAttribute('aria-selected')).toBe('true');
    expect(unselectedChild.getAttribute('aria-selected')).toBe('false');
  });

  it('should drop the commit highlight when any of its files is selected', () => {
    render(
      <CommitList
        {...defaultProps}
        selectedShas={new Set(['aaa111', 'bbb222'])}
        selectedCommitFiles={new Set(['aaa111:src/a.ts'])}
      />,
    );
    const rows = screen.getAllByRole('row');
    const firstCommitRow = rows.find((row) => row.textContent.includes('feat: first commit'));
    const secondCommitRow = rows.find((row) => row.textContent.includes('fix: second commit'));

    expect(firstCommitRow?.getAttribute('aria-selected')).toBe('false');
    expect(secondCommitRow?.getAttribute('aria-selected')).toBe('true');
  });

  it('should call onSelectAllFilesInCommit when a modifier is held and the commit is expanded', async () => {
    const user = userEvent.setup();
    const onSelectCommit = vi.fn();
    const onSelectAllFilesInCommit = vi.fn();
    render(
      <CommitList
        {...defaultProps}
        onSelectCommit={onSelectCommit}
        onSelectAllFilesInCommit={onSelectAllFilesInCommit}
      />,
    );

    const row = screen.getByRole('row', { name: /feat: first commit/i });
    await user.click(within(row).getByRole('button'));

    onSelectCommit.mockClear();
    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('feat: first commit'));
    await user.keyboard('{/Shift}');

    expect(onSelectAllFilesInCommit).toHaveBeenCalledWith(
      'aaa111',
      ['src/a.ts'],
      { shiftKey: true, metaKey: false },
    );
    expect(onSelectCommit).not.toHaveBeenCalled();
  });

  it('should still call onSelectCommit when a modifier is held but the commit is collapsed', async () => {
    const user = userEvent.setup();
    const onSelectCommit = vi.fn();
    const onSelectAllFilesInCommit = vi.fn();
    render(
      <CommitList
        {...defaultProps}
        onSelectCommit={onSelectCommit}
        onSelectAllFilesInCommit={onSelectAllFilesInCommit}
      />,
    );

    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('feat: first commit'));
    await user.keyboard('{/Shift}');

    expect(onSelectCommit).toHaveBeenCalledWith('aaa111', { shiftKey: true, metaKey: false });
    expect(onSelectAllFilesInCommit).not.toHaveBeenCalled();
  });
});
