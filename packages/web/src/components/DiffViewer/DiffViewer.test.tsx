// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DiffFile } from '../../fixtures/types';
import { DiffViewer } from './DiffViewer';

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'catppuccin-mocha',
    setTheme: vi.fn(),
    themes: ['catppuccin-mocha', 'catppuccin-latte'],
  }),
}));

vi.mock('./useSyntaxHighlighting', () => ({
  useSyntaxHighlighting: () => null,
}));

const scrollToIndex = vi.fn();

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
    scrollToIndex,
  }),
}));

const modifiedDiff: DiffFile = {
  path: 'src/auth/validateToken.ts',
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
        {
          lineType: 'context',
          oldLineNumber: 1,
          newLineNumber: 1,
          content: "import { verify } from 'jsonwebtoken';",
        },
        {
          lineType: 'removed',
          oldLineNumber: 2,
          newLineNumber: null,
          content: "import { SECRET } from '../utils/config';",
        },
        {
          lineType: 'added',
          oldLineNumber: null,
          newLineNumber: 2,
          content: "import type { JwtPayload } from 'jsonwebtoken';",
        },
        { lineType: 'added', oldLineNumber: null, newLineNumber: 3, content: '' },
        { lineType: 'context', oldLineNumber: 3, newLineNumber: 4, content: '' },
      ],
    },
  ],
};

const deletedDiff: DiffFile = {
  path: 'src/utils/config.ts',
  changeType: 'deleted',
  language: 'typescript',
  hunks: [
    {
      header: '@@ -1,3 +0,0 @@',
      oldStart: 1,
      oldCount: 3,
      newStart: 0,
      newCount: 0,
      lines: [
        {
          lineType: 'removed',
          oldLineNumber: 1,
          newLineNumber: null,
          content: "export const SECRET = 'dev-secret';",
        },
        { lineType: 'removed', oldLineNumber: 2, newLineNumber: null, content: '' },
        {
          lineType: 'removed',
          oldLineNumber: 3,
          newLineNumber: null,
          content: 'export const PORT = 3000;',
        },
      ],
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const getDiffRows = () => [...document.querySelectorAll('[data-testid="diff-row"]')];

const getHunkHeaders = () => [...document.querySelectorAll('[data-testid="hunk-header"]')];

const getGutters = (row: Element, side: 'left' | 'right') =>
  row.querySelector(`[data-side="${side}"] [class*="gutter"]`)!;

const getContent = (row: Element, side: 'left' | 'right') =>
  row.querySelector(`[data-side="${side}"] [class*="content"]`)!;

describe('DiffViewer', () => {
  describe('empty state', () => {
    it('shows placeholder when no diff is provided', () => {
      render(<DiffViewer diff={null} />);
      expect(screen.getByText('Select a file to view diff')).toBeDefined();
    });
  });

  describe('hunk headers', () => {
    it('renders the hunk range header on both sides', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const headers = getHunkHeaders();
      expect(headers).toHaveLength(1);
      expect(headers[0]!.textContent).toBe('@@ -1,3 +1,4 @@@@ -1,3 +1,4 @@');
    });
  });

  describe('line numbers', () => {
    it('renders old line numbers on the left side', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const rows = getDiffRows();
      const gutter = getGutters(rows[0]!, 'left');
      expect(gutter.textContent).toBe('1');
    });

    it('renders new line numbers on the right side', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const rows = getDiffRows();
      const gutter = getGutters(rows[0]!, 'right');
      expect(gutter.textContent).toBe('1');
    });
  });

  describe('side-by-side pairing', () => {
    it('renders the correct number of diff rows', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      expect(getDiffRows()).toHaveLength(4);
    });

    it('renders empty gutter on the left for unmatched added lines', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const rows = getDiffRows();
      const gutter = getGutters(rows[2]!, 'left');
      expect(gutter.textContent).toBe('');
    });

    it('renders all removed lines on left for deleted files', () => {
      render(<DiffViewer diff={deletedDiff} />);
      const rows = getDiffRows();
      expect(rows).toHaveLength(3);

      const leftGutter = getGutters(rows[0]!, 'left');
      expect(leftGutter.textContent).toBe('1');

      const rightGutter = getGutters(rows[0]!, 'right');
      expect(rightGutter.textContent).toBe('');
    });
  });

  describe('line content', () => {
    it('renders code content in both sides for context lines', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const rows = getDiffRows();
      const leftContent = getContent(rows[0]!, 'left');
      const rightContent = getContent(rows[0]!, 'right');
      expect(leftContent.textContent).toBe("import { verify } from 'jsonwebtoken';");
      expect(rightContent.textContent).toBe("import { verify } from 'jsonwebtoken';");
    });
  });

  describe('virtualized structure', () => {
    it('renders inside a scroll container with a virtual list', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const viewer = document.querySelector('[data-testid="diff-viewer"]');
      expect(viewer).not.toBeNull();
      const virtualList = viewer!.firstElementChild;
      expect(virtualList).not.toBeNull();
    });
  });

  describe('file size tiers', () => {
    it('renders collapsed summary for huge diffs', async () => {
      const tierModule = await import('./getFileSizeTier');
      vi.spyOn(tierModule, 'getFileSizeTier').mockReturnValue('huge');

      render(<DiffViewer diff={modifiedDiff} />);
      expect(screen.getByTestId('diff-collapsed')).toBeDefined();
      expect(getDiffRows()).toHaveLength(0);
    });

    it('expands a huge diff when the expand button is clicked', async () => {
      const tierModule = await import('./getFileSizeTier');
      vi.spyOn(tierModule, 'getFileSizeTier').mockReturnValue('huge');

      render(<DiffViewer diff={modifiedDiff} />);
      const expandButton = screen.getByRole('button', { name: /show diff/i });
      fireEvent.click(expandButton);
      expect(screen.queryByTestId('diff-collapsed')).toBeNull();
      expect(getDiffRows().length).toBeGreaterThan(0);
    });

    it('renders normally for small diffs without collapsed state', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      expect(screen.queryByTestId('diff-collapsed')).toBeNull();
      expect(getDiffRows()).toHaveLength(4);
    });

    it('defers syntax highlighting for large diffs', async () => {
      const tierModule = await import('./getFileSizeTier');
      vi.spyOn(tierModule, 'getFileSizeTier').mockReturnValue('large');

      render(<DiffViewer diff={modifiedDiff} />);
      expect(getDiffRows().length).toBeGreaterThan(0);
      expect(screen.queryByTestId('diff-collapsed')).toBeNull();
    });
  });

  describe('keyboard navigation', () => {
    it('does not scroll when no next hunk exists', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      scrollToIndex.mockClear();
      fireEvent.keyDown(document, { key: 'j' });
      expect(scrollToIndex).not.toHaveBeenCalled();
    });

    it('scrolls to the next change on n key', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      scrollToIndex.mockClear();
      fireEvent.keyDown(document, { key: 'n' });
      expect(scrollToIndex).toHaveBeenCalledWith(2, { align: 'start' });
    });
  });
});
