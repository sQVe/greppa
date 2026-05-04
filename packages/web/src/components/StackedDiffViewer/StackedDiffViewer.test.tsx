// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DiffFile } from '../../fixtures/types';
import { buildFlatItems } from '../DiffViewer/buildFlatItems';
import { StackedDiffViewer } from './StackedDiffViewer';
import type { StackedDiffViewerHandle } from './StackedDiffViewer';

vi.mock('../../hooks/usePreferences', () => ({
  usePreferences: () => ({
    state: { theme: 'catppuccin-mocha' },
    set: vi.fn(),
  }),
}));

vi.mock('../DiffViewer/useSyntaxHighlighting', () => ({
  useSyntaxHighlighting: () => null,
  useMultiSyntaxHighlighting: () => new Map(),
}));

const mockScrollToIndex = vi.fn();

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 36,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 36,
        end: (i + 1) * 36,
        size: 36,
      })),
    measureElement: () => undefined,
    scrollToIndex: mockScrollToIndex,
  }),
}));

const fileA: DiffFile = {
  path: 'src/Api.ts',
  changeType: 'modified',
  language: 'typescript',
  hunks: [
    {
      header: '@@ -1,3 +1,4 @@',
      oldStart: 1,
      oldCount: 3,
      newStart: 1,
      newCount: 4,
      lines: [
        { lineType: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'line 1' },
        { lineType: 'removed', oldLineNumber: 2, newLineNumber: null, content: 'old line' },
        { lineType: 'added', oldLineNumber: null, newLineNumber: 2, content: 'new line' },
        { lineType: 'context', oldLineNumber: 3, newLineNumber: 3, content: 'line 3' },
      ],
    },
  ],
};

const fileB: DiffFile = {
  path: 'src/GitService.ts',
  changeType: 'added',
  language: 'typescript',
  hunks: [
    {
      header: '@@ -0,0 +1,2 @@',
      oldStart: 0,
      oldCount: 0,
      newStart: 1,
      newCount: 2,
      lines: [
        { lineType: 'added', oldLineNumber: null, newLineNumber: 1, content: 'new file line 1' },
        { lineType: 'added', oldLineNumber: null, newLineNumber: 2, content: 'new file line 2' },
      ],
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StackedDiffViewer', () => {
  describe('single file', () => {
    it('renders within stacked container with file header', () => {
      render(<StackedDiffViewer diffs={[fileA]} />);
      expect(screen.getByTestId('stacked-diff-viewer')).toBeDefined();
      expect(screen.getAllByTestId('file-header')).toHaveLength(2);
    });

    it('renders empty state when given no files', () => {
      render(<StackedDiffViewer diffs={[]} />);
      expect(screen.getByText('Select a file to view diff')).toBeDefined();
    });
  });

  describe('multi-file rendering', () => {
    it('renders stacked container with multiple files', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      expect(screen.getByTestId('stacked-diff-viewer')).toBeDefined();
    });

    it('renders a file header for each file plus the sticky overlay', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      const headers = screen.getAllByTestId('file-header');

      expect(headers).toHaveLength(3);
    });

    it('displays file path in each header', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      const headers = screen.getAllByTestId('file-header');
      const paths = headers.map((el) => el.getAttribute('data-file-path'));
      expect(paths.filter((p) => p === 'src/Api.ts')).toHaveLength(2);
      expect(paths).toContain('src/GitService.ts');
    });

    it('displays change type badge in each header', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      expect(screen.getAllByText('Modified')).toHaveLength(2);
      expect(screen.getAllByText('Added')).toHaveLength(1);
    });

    it('displays diff size with additions and deletions', () => {
      render(<StackedDiffViewer diffs={[fileA]} />);
      expect(screen.getAllByText('+1')).toHaveLength(2);
      expect(screen.getAllByText('\u22121')).toHaveLength(2);
    });

    it('displays language label with proper formatting', () => {
      render(<StackedDiffViewer diffs={[fileA]} />);
      expect(screen.getAllByText('TypeScript')).toHaveLength(2);
    });

    it('renders diff rows for each file', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      const rows = screen.getAllByTestId('diff-row');

      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe('review button', () => {
    const getVirtualListButtons = () => {
      const stickyHeader = screen.getByTestId('sticky-file-header');
      return screen
        .getAllByRole('button', { name: /mark reviewed/i })
        .filter((button) => !stickyHeader.contains(button));
    };

    it('renders review buttons in file headers', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      const buttons = getVirtualListButtons();

      expect(buttons).toHaveLength(2);
    });

    it('shows reviewed state for files in reviewedPaths', () => {
      render(
        <StackedDiffViewer
          diffs={[fileA, fileB]}
          reviewedPaths={new Set(['src/Api.ts'])}
          onToggleReviewed={vi.fn()}
        />,
      );
      const stickyHeader = screen.getByTestId('sticky-file-header');
      const reviewButtons = screen
        .getAllByRole('button')
        .filter((b) => !stickyHeader.contains(b))
        .filter((b) => b.textContent?.includes('eviewed'));

      const reviewedButtons = reviewButtons.filter((b) => b.textContent === '\u2713 Reviewed');
      const unreviewedButtons = reviewButtons.filter((b) => b.textContent === 'Mark reviewed');

      expect(reviewedButtons).toHaveLength(1);
      expect(unreviewedButtons).toHaveLength(1);
    });

    it('calls onToggleReviewed with file path when clicked', async () => {
      const onToggle = vi.fn();
      render(
        <StackedDiffViewer
          diffs={[fileA, fileB]}
          reviewedPaths={new Set()}
          onToggleReviewed={onToggle}
        />,
      );
      const buttons = screen.getAllByRole('button', { name: /mark reviewed/i });
      await userEvent.click(buttons[0] as HTMLElement);

      expect(onToggle).toHaveBeenCalledWith('src/Api.ts');
    });

    it('calls onToggleReviewed with sha:path key when the diff has a sha (commit-source file)', async () => {
      const onToggle = vi.fn();
      const commitDiff: DiffFile = { ...fileA, sha: 'abc123' };
      render(
        <StackedDiffViewer
          diffs={[commitDiff]}
          reviewedPaths={new Set()}
          onToggleReviewed={onToggle}
        />,
      );
      const buttons = screen.getAllByRole('button', { name: /mark reviewed/i });
      await userEvent.click(buttons[0] as HTMLElement);

      expect(onToggle).toHaveBeenCalledWith('abc123:src/Api.ts');
    });

    it('reads reviewed state by sha:path key when the diff has a sha', () => {
      const commitDiff: DiffFile = { ...fileA, sha: 'abc123' };
      render(
        <StackedDiffViewer
          diffs={[commitDiff]}
          reviewedPaths={new Set(['abc123:src/Api.ts'])}
          onToggleReviewed={vi.fn()}
        />,
      );
      const stickyHeader = screen.getByTestId('sticky-file-header');
      const reviewButtons = screen
        .getAllByRole('button')
        .filter((b) => !stickyHeader.contains(b))
        .filter((b) => b.textContent?.includes('eviewed'));

      expect(reviewButtons.filter((b) => b.textContent === '✓ Reviewed')).toHaveLength(1);
    });
  });

  describe('scroll sync', () => {
    it('calls onActiveFileChange with the first file on mount', () => {
      const onActiveFileChange = vi.fn();
      render(<StackedDiffViewer diffs={[fileA, fileB]} onActiveFileChange={onActiveFileChange} />);

      expect(onActiveFileChange).toHaveBeenCalledWith('src/Api.ts');
    });

    it('exposes scrollToFile via ref', () => {
      const ref = createRef<StackedDiffViewerHandle>();
      render(<StackedDiffViewer ref={ref} diffs={[fileA, fileB]} />);
      expect(ref.current?.scrollToFile).toBeDefined();
    });

    it('calls scrollToIndex with flat item index when scrollToFile is invoked', () => {
      const ref = createRef<StackedDiffViewerHandle>();
      render(<StackedDiffViewer ref={ref} diffs={[fileA, fileB]} />);
      mockScrollToIndex.mockClear();

      const flatItems = buildFlatItems([fileA, fileB]);
      const expectedIndex = flatItems.findIndex(
        (item) => item.kind === 'file-header' && item.diff.path === 'src/GitService.ts',
      );

      ref.current?.scrollToFile('src/GitService.ts');
      expect(mockScrollToIndex).toHaveBeenCalledWith(expectedIndex, { align: 'start' });
    });

    it('scrolls to the diff row matching the given line number', () => {
      const ref = createRef<StackedDiffViewerHandle>();
      render(<StackedDiffViewer ref={ref} diffs={[fileA, fileB]} />);
      mockScrollToIndex.mockClear();

      const flatItems = buildFlatItems([fileA, fileB]);
      const fileAHeaderIdx = flatItems.findIndex(
        (item) => item.kind === 'file-header' && item.diff.path === 'src/Api.ts',
      );
      let expectedIndex = -1;
      for (let i = fileAHeaderIdx + 1; i < flatItems.length; i++) {
        const current = flatItems[i];
        if (current == null || current.kind === 'file-header') {
          break;
        }
        if (
          current.kind === 'diff-row' &&
          (current.row.right?.lineNumber === 3 || current.row.left?.lineNumber === 3)
        ) {
          expectedIndex = i;
          break;
        }
      }

      ref.current?.scrollToLine('src/Api.ts', 3);
      expect(mockScrollToIndex).toHaveBeenCalledWith(expectedIndex, { align: 'start' });
    });

    it('scopes scrollToLine to the specified file path', () => {
      const fileC: DiffFile = {
        path: 'src/Other.ts',
        changeType: 'modified',
        language: 'typescript',
        hunks: [
          {
            header: '@@ -1,2 +1,2 @@',
            oldStart: 1,
            oldCount: 2,
            newStart: 1,
            newCount: 2,
            lines: [
              { lineType: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'line 1' },
              { lineType: 'context', oldLineNumber: 2, newLineNumber: 2, content: 'line 2' },
            ],
          },
        ],
      };

      const ref = createRef<StackedDiffViewerHandle>();
      render(<StackedDiffViewer ref={ref} diffs={[fileA, fileC]} />);
      mockScrollToIndex.mockClear();

      const flatItems = buildFlatItems([fileA, fileC]);
      const fileCHeaderIdx = flatItems.findIndex(
        (item) => item.kind === 'file-header' && item.diff.path === 'src/Other.ts',
      );
      let expectedIndex = -1;
      for (let i = fileCHeaderIdx + 1; i < flatItems.length; i++) {
        const current = flatItems[i];
        if (current == null || current.kind === 'file-header') {
          break;
        }
        if (
          current.kind === 'diff-row' &&
          (current.row.right?.lineNumber === 1 || current.row.left?.lineNumber === 1)
        ) {
          expectedIndex = i;
          break;
        }
      }

      ref.current?.scrollToLine('src/Other.ts', 1);
      expect(mockScrollToIndex).toHaveBeenCalledWith(expectedIndex, { align: 'start' });
    });
  });

  describe('sticky header overlay', () => {
    it('renders a sticky overlay header', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      expect(screen.getByTestId('sticky-file-header')).toBeDefined();
    });
  });
});
