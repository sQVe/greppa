// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DiffFile } from '../fixtures/types';
import { DiffViewer } from './DiffViewer';

vi.mock('../hooks/useTheme', () => ({
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

const getDataRows = () => {
  const table = document.querySelector('table');
  const rows = table!.querySelectorAll('tbody tr');
  return [...rows].filter((r) => r.querySelectorAll('td').length > 1);
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
    it('renders the hunk range header', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      expect(screen.getByText('@@ -1,3 +1,4 @@')).toBeDefined();
    });
  });

  describe('line numbers', () => {
    it('renders old line numbers for context and removed lines', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const cells = getDataRows()[0]!.querySelectorAll('td');
      expect(cells[0]?.textContent).toBe('1');
    });

    it('renders new line numbers for context and added lines', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const cells = getDataRows()[0]!.querySelectorAll('td');
      expect(cells[3]?.textContent).toBe('1');
    });
  });

  describe('side-by-side pairing', () => {
    it('pairs removed and added lines on separate rows when counts differ', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      expect(getDataRows().length).toBeGreaterThanOrEqual(4);
    });

    it('renders empty cells on the opposite side for unmatched lines', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      const secondAddedRow = getDataRows()[2]!;
      const leftGutter = secondAddedRow.querySelectorAll('td')[0]!;
      expect(leftGutter.textContent).toBe('');
    });

    it('renders all removed lines on left for deleted files', () => {
      render(<DiffViewer diff={deletedDiff} />);
      const dataRows = getDataRows();
      expect(dataRows.length).toBe(3);
      const firstRow = dataRows[0]!;
      const leftGutter = firstRow.querySelectorAll('td')[0]!;
      expect(leftGutter.textContent).toBe('1');
      const rightGutter = firstRow.querySelectorAll('td')[3]!;
      expect(rightGutter.textContent).toBe('');
    });
  });

  describe('line content', () => {
    it('renders code content in the content cells', () => {
      render(<DiffViewer diff={modifiedDiff} />);
      expect(screen.getAllByText("import { verify } from 'jsonwebtoken';").length).toBe(2);
    });
  });
});
