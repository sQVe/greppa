// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CommitEntry } from '@greppa/core';

import { CommitList } from './CommitList';

const commits: CommitEntry[] = [
  { sha: 'aaa111', abbrevSha: 'aaa', subject: 'feat: first commit', author: 'Alice', date: '2026-04-03T10:00:00+00:00' },
  { sha: 'bbb222', abbrevSha: 'bbb', subject: 'fix: second commit', author: 'Bob', date: '2026-04-02T09:00:00+00:00' },
  { sha: 'ccc333', abbrevSha: 'ccc', subject: 'chore: third commit', author: 'Carol', date: '2026-04-01T08:00:00+00:00' },
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
  it('renders commit items with hash and subject', () => {
    render(<CommitList {...defaultProps} />);

    expect(screen.getByText('aaa')).toBeDefined();
    expect(screen.getByText('feat: first commit')).toBeDefined();
    expect(screen.getByText('bbb')).toBeDefined();
    expect(screen.getByText('fix: second commit')).toBeDefined();
  });

  it('calls onSelectCommit with sha and shiftKey=false on click', async () => {
    const user = userEvent.setup();
    const onSelectCommit = vi.fn();
    render(<CommitList {...defaultProps} onSelectCommit={onSelectCommit} />);

    await user.click(screen.getByText('feat: first commit'));

    expect(onSelectCommit).toHaveBeenCalledWith('aaa111', { shiftKey: false, metaKey: false });
  });

  it('calls onSelectCommit with shiftKey=true on shift+click', async () => {
    const user = userEvent.setup();
    const onSelectCommit = vi.fn();
    render(<CommitList {...defaultProps} onSelectCommit={onSelectCommit} />);

    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('fix: second commit'));
    await user.keyboard('{/Shift}');

    expect(onSelectCommit).toHaveBeenCalledWith('bbb222', { shiftKey: true, metaKey: false });
  });

  it('highlights selected commits', () => {
    render(<CommitList {...defaultProps} selectedShas={new Set(['aaa111'])} />);

    const items = screen.getAllByRole('button');
    expect(items[0]?.getAttribute('data-selected')).toBe('true');
    expect(items[1]?.getAttribute('data-selected')).toBe('false');
  });

  it('renders empty state when no commits', () => {
    render(<CommitList {...defaultProps} commits={[]} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
