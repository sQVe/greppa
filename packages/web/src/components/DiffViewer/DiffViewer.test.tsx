// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
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

vi.mock('shiki', () => ({
  createHighlighter: () => Promise.resolve(null),
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
});

const getSide = (side: 'left' | 'right') => document.querySelector(`[data-side="${side}"]`)!;

const getDataRows = (side: 'left' | 'right') => {
  const sideEl = getSide(side);
  return [...sideEl.querySelectorAll(':scope > [data-testid="diff-row"]')];
};

describe('DiffViewer', () => {
  describe('empty state', () => {
    it('shows placeholder when no diff is provided', () => {
      render(<DiffViewer diff={null} />);
      expect(screen.getByText('Select a file to view diff')).toBeDefined();
    });
  });

  describe('file header', () => {
    it('renders the file path', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      expect(screen.getByText('src/auth/validateToken.ts')).toBeDefined();
    });

    it('renders the change type badge', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      expect(screen.getByText('Modified')).toBeDefined();
    });

    it('renders Deleted badge for deleted files', () => {
      render(<DiffViewer diff={deletedDiff} />);
      expect(screen.getByText('Deleted')).toBeDefined();
    });
  });

  describe('hunk headers', () => {
    it('renders the hunk range header on both sides', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      expect(screen.getAllByText('@@ -1,3 +1,4 @@').length).toBe(2);
    });
  });

  describe('line numbers', () => {
    it('renders old line numbers in the left side', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const rows = getDataRows('left');
      const gutter = rows[0]!.querySelector('[class*="gutter"]')!;
      expect(gutter.textContent).toBe('1');
    });

    it('renders new line numbers in the right side', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const rows = getDataRows('right');
      const gutter = rows[0]!.querySelector('[class*="gutter"]')!;
      expect(gutter.textContent).toBe('1');
    });
  });

  describe('side-by-side pairing', () => {
    it('renders the correct number of data rows per side', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      expect(getDataRows('left').length).toBeGreaterThanOrEqual(4);
      expect(getDataRows('right').length).toBeGreaterThanOrEqual(4);
    });

    it('renders empty gutter on the left for unmatched added lines', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const rows = getDataRows('left');
      const gutter = rows[2]!.querySelector('[class*="gutter"]')!;
      expect(gutter.textContent).toBe('');
    });

    it('renders all removed lines on left for deleted files', () => {
      render(<DiffViewer diff={deletedDiff} />);
      const leftRows = getDataRows('left');
      expect(leftRows.length).toBe(3);
      const leftGutter = leftRows[0]!.querySelector('[class*="gutter"]')!;
      expect(leftGutter.textContent).toBe('1');

      const rightRows = getDataRows('right');
      const rightGutter = rightRows[0]!.querySelector('[class*="gutter"]')!;
      expect(rightGutter.textContent).toBe('');
    });
  });

  describe('line content', () => {
    it('renders code content in the content cells', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      expect(screen.getAllByText("import { verify } from 'jsonwebtoken';").length).toBe(2);
    });
  });

  describe('selection isolation', () => {
    it('renders left and right sides as separate DOM subtrees', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const left = getSide('left');
      const right = getSide('right');
      expect(left).toBeDefined();
      expect(right).toBeDefined();
      expect(left.parentElement).toBe(right.parentElement);
    });
  });
});
