// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DiffFile } from '../../fixtures/types';
import { FileMinimap } from './FileMinimap';

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
      ],
    },
    {
      header: '@@ -10,3 +10,4 @@',
      oldStart: 10,
      oldCount: 3,
      newStart: 10,
      newCount: 4,
      lines: [
        { lineType: 'context', oldLineNumber: 10, newLineNumber: 10, content: 'line 10' },
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
        { lineType: 'added', oldLineNumber: null, newLineNumber: 1, content: 'new file' },
      ],
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe('FileMinimap', () => {
  it('should render a segment for each file', () => {
    render(<FileMinimap diffs={[fileA, fileB]} activeFilePath={null} onSegmentClick={vi.fn()} />);
    const segments = screen.getAllByTestId('minimap-segment');
    expect(segments).toHaveLength(2);
  });

  it('should highlight the active file segment', () => {
    render(
      <FileMinimap diffs={[fileA, fileB]} activeFilePath="src/Api.ts" onSegmentClick={vi.fn()} />,
    );
    const segments = screen.getAllByTestId('minimap-segment');

    expect(segments.at(0)?.getAttribute('data-active')).toBe('true');
    expect(segments.at(1)?.getAttribute('data-active')).toBe('false');
  });

  it('should size segments proportionally to hunk count', () => {
    render(<FileMinimap diffs={[fileA, fileB]} activeFilePath={null} onSegmentClick={vi.fn()} />);
    const segments = screen.getAllByTestId('minimap-segment');

    expect(segments.at(0)?.style.flexGrow).toBe('2');
    expect(segments.at(1)?.style.flexGrow).toBe('1');
  });

  it('should call onSegmentClick with file path when clicked', async () => {
    const onClick = vi.fn();
    render(<FileMinimap diffs={[fileA, fileB]} activeFilePath={null} onSegmentClick={onClick} />);
    const segments = screen.getAllByTestId('minimap-segment');
    const secondSegment = segments.at(1);
    expect(secondSegment).toBeDefined();

    await userEvent.click(secondSegment as HTMLElement);

    expect(onClick).toHaveBeenCalledWith('src/GitService.ts');
  });

  it('should render nothing when given a single file', () => {
    const { container } = render(
      <FileMinimap diffs={[fileA]} activeFilePath={null} onSegmentClick={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
