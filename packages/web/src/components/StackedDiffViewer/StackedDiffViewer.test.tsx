// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DiffFile } from '../../fixtures/types';
import { StackedDiffViewer } from './StackedDiffViewer';
import type { StackedDiffViewerHandle } from './StackedDiffViewer';

let intersectionCallback: IntersectionObserverCallback;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

const fakeEntry = (target: Element): IntersectionObserverEntry => ({
  isIntersecting: true,
  target,
  boundingClientRect: target.getBoundingClientRect(),
  intersectionRatio: 1,
  intersectionRect: target.getBoundingClientRect(),
  rootBounds: null,
  time: 0,
});

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

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
  describe('single file', () => {
    it('renders within stacked container with file header', () => {
      render(<StackedDiffViewer diffs={[fileA]} />);
      expect(screen.getByTestId('stacked-diff-viewer')).toBeDefined();
      expect(screen.getAllByTestId('file-header')).toHaveLength(1);
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

  describe('review button', () => {
    it('renders a review button in each file header', () => {
      render(<StackedDiffViewer diffs={[fileA, fileB]} />);
      const buttons = screen.getAllByRole('button', { name: /mark reviewed/i });
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
      const buttons = screen.getAllByRole('button');
      const reviewButtons = buttons.filter((b) => b.textContent?.includes('eviewed'));
      expect(reviewButtons).toHaveLength(2);
      expect(reviewButtons.at(0)?.textContent).toBe('\u2713 Reviewed');
      expect(reviewButtons.at(1)?.textContent).toBe('Mark reviewed');
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
      const firstButton = screen.getAllByRole('button', { name: /mark reviewed/i }).at(0);
      expect(firstButton).toBeDefined();
      await userEvent.click(firstButton as HTMLElement);
      expect(onToggle).toHaveBeenCalledWith('src/Api.ts');
    });
  });

  describe('scroll sync', () => {
    it('calls onActiveFileChange when intersection observer fires', () => {
      const onActiveFileChange = vi.fn();
      render(
        <StackedDiffViewer diffs={[fileA, fileB]} onActiveFileChange={onActiveFileChange} />,
      );
      const secondHeader = screen.getAllByTestId('file-header').at(1);
      expect(secondHeader).toBeDefined();
      intersectionCallback(
        [fakeEntry(secondHeader as HTMLElement)],
        new MockIntersectionObserver(() => {}) as unknown as IntersectionObserver,
      );
      expect(onActiveFileChange).toHaveBeenCalledWith('src/GitService.ts');
    });

    it('exposes scrollToFile via ref', () => {
      const ref = createRef<StackedDiffViewerHandle>();
      render(<StackedDiffViewer ref={ref} diffs={[fileA, fileB]} />);
      expect(ref.current?.scrollToFile).toBeDefined();
    });
  });
});
