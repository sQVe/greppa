import type { CommitEntry } from '@greppa/core';
// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommitList } from './CommitList';

const commits: CommitEntry[] = [
  {
    sha: 'aaa111',
    abbrevSha: 'aaa',
    subject: 'feat: first commit',
    author: 'Alice',
    date: '2026-04-03T10:00:00+00:00',
    files: ['src/a.ts'],
  },
  {
    sha: 'bbb222',
    abbrevSha: 'bbb',
    subject: 'fix: second commit',
    author: 'Bob',
    date: '2026-04-02T09:00:00+00:00',
    files: ['src/b.ts'],
  },
  {
    sha: 'ccc333',
    abbrevSha: 'ccc',
    subject: 'chore: third commit',
    author: 'Carol',
    date: '2026-04-01T08:00:00+00:00',
    files: ['src/c.ts'],
  },
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
  it('should render commit subjects', () => {
    render(<CommitList {...defaultProps} />);

    screen.getByText('feat: first commit');
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

  it('marks commit-file rows whose sha:path key is in reviewedCommitFiles', async () => {
    const user = userEvent.setup();
    render(<CommitList {...defaultProps} reviewedCommitFiles={new Set(['aaa111:src/a.ts'])} />);

    const row = screen.getByRole('row', { name: /feat: first commit/i });
    await user.click(within(row).getByRole('button'));

    const reviewedRow = screen.getByRole('row', { name: /src\/a\.ts/ });
    expect(reviewedRow.getAttribute('data-reviewed')).toBe('true');
  });

  it('does not mark commit-file rows for the same path under a different sha', async () => {
    const user = userEvent.setup();
    const sharedPathCommits: CommitEntry[] = [
      {
        sha: 'aaa111',
        abbrevSha: 'aaa',
        subject: 'feat: first commit',
        author: 'Alice',
        date: '2026-04-03T10:00:00+00:00',
        files: ['src/shared.ts'],
      },
      {
        sha: 'bbb222',
        abbrevSha: 'bbb',
        subject: 'fix: second commit',
        author: 'Bob',
        date: '2026-04-02T09:00:00+00:00',
        files: ['src/shared.ts'],
      },
    ];
    render(
      <CommitList
        {...defaultProps}
        commits={sharedPathCommits}
        reviewedCommitFiles={new Set(['aaa111:src/shared.ts'])}
      />,
    );

    const firstCommitRow = screen.getByRole('row', { name: /feat: first commit/i });
    const secondCommitRow = screen.getByRole('row', { name: /fix: second commit/i });
    await user.click(within(firstCommitRow).getByRole('button'));
    await user.click(within(secondCommitRow).getByRole('button'));

    const fileRows = screen.getAllByRole('row', { name: /src\/shared\.ts/ });
    expect(fileRows).toHaveLength(2);
    const reviewedRows = fileRows.filter((r) => r.getAttribute('data-reviewed') === 'true');
    expect(reviewedRows).toHaveLength(1);
  });

  it('should render a file icon on each expanded commit file row', async () => {
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
    render(<CommitList {...defaultProps} commits={commitsWithMultipleFiles} />);

    const row = screen.getByRole('row', { name: /feat: first commit/i });
    await user.click(within(row).getByRole('button'));

    const firstFileRow = screen.getByRole('row', { name: /src\/a\.ts/ });
    const secondFileRow = screen.getByRole('row', { name: /src\/b\.ts/ });
    expect(firstFileRow.querySelector('img')).not.toBeNull();
    expect(secondFileRow.querySelector('img')).not.toBeNull();
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
      [
        { sha: 'aaa111', path: 'src/a.ts' },
        { sha: 'bbb222', path: 'src/b.ts' },
        { sha: 'ccc333', path: 'src/c.ts' },
      ],
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

  it("should drop commit highlights when only some of a commit's files are selected", () => {
    const commitsWithMultipleFiles: CommitEntry[] = [
      {
        sha: 'aaa111',
        abbrevSha: 'aaa',
        subject: 'feat: first commit',
        author: 'Alice',
        date: '2026-04-03T10:00:00+00:00',
        files: ['src/a.ts', 'src/a2.ts'],
      },
      {
        sha: 'bbb222',
        abbrevSha: 'bbb',
        subject: 'fix: second commit',
        author: 'Bob',
        date: '2026-04-02T09:00:00+00:00',
        files: ['src/b.ts'],
      },
    ];
    render(
      <CommitList
        {...defaultProps}
        commits={commitsWithMultipleFiles}
        selectedShas={new Set(['aaa111', 'bbb222'])}
        selectedCommitFiles={new Set(['aaa111:src/a.ts'])}
      />,
    );

    const rows = screen.getAllByRole('row');
    const firstCommitRow = rows.find((row) => row.textContent?.includes('feat: first commit'));
    const secondCommitRow = rows.find((row) => row.textContent?.includes('fix: second commit'));

    expect(firstCommitRow?.getAttribute('aria-selected')).toBe('false');
    expect(secondCommitRow?.getAttribute('aria-selected')).toBe('false');
  });

  it('should highlight a collapsed commit when all of its files are in selectedCommitFiles', () => {
    const commitsWithMultipleFiles: CommitEntry[] = [
      {
        sha: 'aaa111',
        abbrevSha: 'aaa',
        subject: 'feat: first commit',
        author: 'Alice',
        date: '2026-04-03T10:00:00+00:00',
        files: ['src/a.ts', 'src/a2.ts'],
      },
    ];
    render(
      <CommitList
        {...defaultProps}
        commits={commitsWithMultipleFiles}
        selectedCommitFiles={new Set(['aaa111:src/a.ts', 'aaa111:src/a2.ts'])}
      />,
    );

    const row = screen.getByRole('row', { name: /feat: first commit/i });
    expect(row.getAttribute('aria-selected')).toBe('true');
  });

  it('should call onSelectAllFilesInCommit on plain click when the commit is expanded', async () => {
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
    await user.click(screen.getByText('feat: first commit'));

    expect(onSelectAllFilesInCommit).toHaveBeenCalledWith('aaa111', ['src/a.ts'], {
      shiftKey: false,
      metaKey: false,
    });
    expect(onSelectCommit).not.toHaveBeenCalled();
  });

  it('should call onSelectAllFilesInCommit with modifier state when the commit is expanded', async () => {
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

    expect(onSelectAllFilesInCommit).toHaveBeenCalledWith('aaa111', ['src/a.ts'], {
      shiftKey: true,
      metaKey: false,
    });
    expect(onSelectCommit).not.toHaveBeenCalled();
  });

  it('should not highlight an expanded commit and should highlight all its files instead', async () => {
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
        selectedShas={new Set(['aaa111'])}
      />,
    );

    const commitRow = screen.getByRole('row', { name: /feat: first commit/i });
    await user.click(within(commitRow).getByRole('button'));

    expect(commitRow.getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('row', { name: /src\/a\.ts/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('row', { name: /src\/b\.ts/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('should not highlight an expanded commit when file selection moved to another commit', async () => {
    const user = userEvent.setup();
    render(
      <CommitList
        {...defaultProps}
        selectedShas={new Set(['aaa111'])}
        selectedCommitFiles={new Set(['bbb222:src/b.ts'])}
      />,
    );

    const firstRow = screen.getByRole('row', { name: /feat: first commit/i });
    const secondRow = screen.getByRole('row', { name: /fix: second commit/i });
    await user.click(within(firstRow).getByRole('button'));
    await user.click(within(secondRow).getByRole('button'));

    expect(firstRow.getAttribute('aria-selected')).toBe('false');
    expect(secondRow.getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('row', { name: /src\/a\.ts/ }).getAttribute('aria-selected')).toBe(
      'false',
    );
    expect(screen.getByRole('row', { name: /src\/b\.ts/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
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

  describe('with visibleFilesBySha (filter active)', () => {
    const filterCommits: CommitEntry[] = [
      {
        sha: 'aaa111',
        abbrevSha: 'aaa',
        subject: 'feat: a',
        author: 'Alice',
        date: '2026-04-03T10:00:00+00:00',
        files: ['src/a.ts', 'src/a2.ts', 'src/a3.ts'],
      },
      {
        sha: 'bbb222',
        abbrevSha: 'bbb',
        subject: 'fix: b',
        author: 'Bob',
        date: '2026-04-02T09:00:00+00:00',
        files: ['src/b.ts'],
      },
    ];

    it('annotates commit rows with (n / m matching) when filter is active', () => {
      render(
        <CommitList
          {...defaultProps}
          commits={filterCommits}
          visibleFilesBySha={
            new Map([
              ['aaa111', ['src/a.ts']],
              ['bbb222', []],
            ])
          }
        />,
      );

      expect(screen.getByText(/\(1 \/ 3 matching\)/)).toBeDefined();
      expect(screen.getByText(/\(0 \/ 1 matching\)/)).toBeDefined();
    });

    it('marks commits with zero visible files as dimmed', () => {
      render(
        <CommitList
          {...defaultProps}
          commits={filterCommits}
          visibleFilesBySha={
            new Map([
              ['aaa111', ['src/a.ts']],
              ['bbb222', []],
            ])
          }
        />,
      );

      const dimmedRow = screen.getByRole('row', { name: /fix: b/i });
      expect(dimmedRow.getAttribute('data-dimmed')).toBe('true');
      const visibleRow = screen.getByRole('row', { name: /feat: a/i });
      expect(visibleRow.getAttribute('data-dimmed')).toBeNull();
    });

    it('renders only visible files inside an expanded commit', async () => {
      const user = userEvent.setup();
      render(
        <CommitList
          {...defaultProps}
          commits={filterCommits}
          visibleFilesBySha={
            new Map([
              ['aaa111', ['src/a.ts', 'src/a3.ts']],
              ['bbb222', ['src/b.ts']],
            ])
          }
        />,
      );

      const row = screen.getByRole('row', { name: /feat: a/i });
      await user.click(within(row).getByRole('button'));

      expect(screen.queryByText('src/a2.ts')).toBeNull();
      expect(screen.getByText('src/a.ts')).toBeDefined();
      expect(screen.getByText('src/a3.ts')).toBeDefined();
    });

    it('passes only visible filtered entries to onSelectCommitFile (shift-range scope)', async () => {
      const user = userEvent.setup();
      const onSelectCommitFile = vi.fn();
      render(
        <CommitList
          {...defaultProps}
          commits={filterCommits}
          onSelectCommitFile={onSelectCommitFile}
          visibleFilesBySha={
            new Map([
              ['aaa111', ['src/a.ts', 'src/a3.ts']],
              ['bbb222', ['src/b.ts']],
            ])
          }
        />,
      );

      const row = screen.getByRole('row', { name: /feat: a/i });
      await user.click(within(row).getByRole('button'));
      await user.click(screen.getByText('src/a.ts'));

      expect(onSelectCommitFile).toHaveBeenCalledWith(
        'aaa111',
        'src/a.ts',
        [
          { sha: 'aaa111', path: 'src/a.ts' },
          { sha: 'aaa111', path: 'src/a3.ts' },
          { sha: 'bbb222', path: 'src/b.ts' },
        ],
        { shiftKey: false, metaKey: false },
      );
    });

    it('passes only visible filtered files to onSelectAllFilesInCommit', async () => {
      const user = userEvent.setup();
      const onSelectAllFilesInCommit = vi.fn();
      render(
        <CommitList
          {...defaultProps}
          commits={filterCommits}
          onSelectAllFilesInCommit={onSelectAllFilesInCommit}
          visibleFilesBySha={
            new Map([
              ['aaa111', ['src/a.ts']],
              ['bbb222', ['src/b.ts']],
            ])
          }
        />,
      );

      const row = screen.getByRole('row', { name: /feat: a/i });
      await user.click(within(row).getByRole('button'));
      await user.click(screen.getByText('feat: a'));

      expect(onSelectAllFilesInCommit).toHaveBeenCalledWith('aaa111', ['src/a.ts'], {
        shiftKey: false,
        metaKey: false,
      });
    });
  });
});
