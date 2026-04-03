// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DiffFile } from '../../fixtures/types';
import { StackedDiffViewer } from './StackedDiffViewer';

vi.mock('../../hooks/usePreferences', () => ({
  usePreferences: () => ({
    state: { theme: 'catppuccin-mocha' },
    set: vi.fn(),
  }),
}));

vi.mock('../DiffViewer/useSyntaxHighlighting', () => ({
  useSyntaxHighlighting: () => null,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 20,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 20,
        size: 20,
        measureElement: () => undefined,
      })),
    scrollToIndex: vi.fn(),
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

const fileC: DiffFile = {
  path: 'src/Http.ts',
  changeType: 'deleted',
  language: 'typescript',
  hunks: [
    {
      header: '@@ -1,1 +0,0 @@',
      oldStart: 1,
      oldCount: 1,
      newStart: 0,
      newCount: 0,
      lines: [
        { lineType: 'removed', oldLineNumber: 1, newLineNumber: null, content: 'deleted' },
      ],
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StackedDiffViewer', () => {
  describe('single file fallback', () => {
    it('renders DiffViewer directly when given one file', () => {
      render(<StackedDiffViewer diffs={[fileA]} />);
      expect(screen.getByTestId('diff-viewer')).toBeDefined();
      expect(screen.queryByTestId('stacked-diff-viewer')).toBeNull();
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

    it('renders a sticky file header for each file', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      const headers = screen.getAllByTestId('file-header');
      expect(headers).toHaveLength(2);
    });

    it('displays file path in each header', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      expect(screen.getByText('src/Api.ts')).toBeDefined();
      expect(screen.getByText('src/GitService.ts')).toBeDefined();
    });

    it('displays change type badge in each header', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      expect(screen.getByText('Modified')).toBeDefined();
      expect(screen.getByText('Added')).toBeDefined();
    });

    it('renders a separator between files but not after the last', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB, fileC]} />);
      const separators = screen.getAllByTestId('file-separator');
      expect(separators).toHaveLength(2);
    });

    it('renders a DiffViewer for each file', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      const viewers = screen.getAllByTestId('diff-viewer');
      expect(viewers).toHaveLength(2);
    });
  });

  describe('navigation bar', () => {
    it('shows file count in navigation bar', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB, fileC]} />);
      expect(screen.getByTestId('file-nav')).toBeDefined();
      expect(screen.getByText('File 1 of 3')).toBeDefined();
    });

    it('does not show navigation bar for single file', () => {
      render(<StackedDiffViewer diffs={[fileA]} />);
      expect(screen.queryByTestId('file-nav')).toBeNull();
    });

    it('has previous and next buttons', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      expect(screen.getByRole('button', { name: /previous file/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /next file/i })).toBeDefined();
    });
  });

  describe('review button', () => {
    it('renders a review button in each file header', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      const buttons = screen.getAllByRole('button', { name: /mark reviewed/i });
      expect(buttons).toHaveLength(2);
    });
  });
});
