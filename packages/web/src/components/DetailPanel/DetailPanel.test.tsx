// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import type { CommentThread, FileInfo } from '../../fixtures/types';
import { DetailPanel } from './DetailPanel';

const threads: CommentThread[] = [
  {
    id: 'thread-1',
    filePath: 'src/auth/validateToken.ts',
    lineNumber: 17,
    resolved: false,
    comments: [
      { id: 'c1', author: 'Alice', timestamp: '2026-03-25T10:00:00Z', body: 'Is this safe?' },
      { id: 'c2', author: 'Bob', timestamp: '2026-03-25T11:00:00Z', body: 'Yes, fail-fast.' },
    ],
  },
];

const fileInfo: FileInfo = {
  path: 'src/auth/validateToken.ts',
  language: 'TypeScript',
  encoding: 'UTF-8',
  lastModified: '2026-03-25T10:00:00Z',
  changeFrequency: 8,
  authors: ['Bob Park', 'Alice Chen'],
  relatedPRs: [42, 67],
};

afterEach(() => {
  cleanup();
});

describe('DetailPanel', () => {
  describe('empty state', () => {
    it('shows placeholder when no file is selected', () => {
      render(<DetailPanel threads={[]} fileInfo={null} />);
      expect(screen.getByText('Select a file to view details')).toBeDefined();
    });
  });

  describe('tabs', () => {
    it('renders Comments and File Info tabs', () => {
      render(<DetailPanel threads={threads} fileInfo={fileInfo} />);
      expect(screen.getByRole('tab', { name: 'Comments' })).toBeDefined();
      expect(screen.getByRole('tab', { name: 'File Info' })).toBeDefined();
    });

    it('shows Comments tab content by default', () => {
      render(<DetailPanel threads={threads} fileInfo={fileInfo} />);
      expect(screen.getByText('Is this safe?')).toBeDefined();
    });

    it('switches to File Info tab on click', async () => {
      render(<DetailPanel threads={threads} fileInfo={fileInfo} />);
      await userEvent.click(screen.getByRole('tab', { name: 'File Info' }));
      expect(screen.getByText('Bob Park')).toBeDefined();
    });
  });

  describe('comments tab', () => {
    it('renders comment author names', () => {
      render(<DetailPanel threads={threads} fileInfo={fileInfo} />);
      expect(screen.getByText('Alice')).toBeDefined();
      expect(screen.getByText('Bob')).toBeDefined();
    });

    it('renders comment body text', () => {
      render(<DetailPanel threads={threads} fileInfo={fileInfo} />);
      expect(screen.getByText('Is this safe?')).toBeDefined();
      expect(screen.getByText('Yes, fail-fast.')).toBeDefined();
    });

    it('renders line number reference', () => {
      render(<DetailPanel threads={threads} fileInfo={fileInfo} />);
      expect(screen.getByText('Line 17')).toBeDefined();
    });

    it('shows empty message when no threads', () => {
      render(<DetailPanel threads={[]} fileInfo={fileInfo} />);
      expect(screen.getByText('No comments on this file')).toBeDefined();
    });
  });

  describe('file info tab', () => {
    it('renders author names', async () => {
      render(<DetailPanel threads={threads} fileInfo={fileInfo} />);
      await userEvent.click(screen.getByRole('tab', { name: 'File Info' }));
      expect(screen.getByText('Bob Park')).toBeDefined();
      expect(screen.getByText('Alice Chen')).toBeDefined();
    });

    it('renders change frequency', async () => {
      render(<DetailPanel threads={threads} fileInfo={fileInfo} />);
      await userEvent.click(screen.getByRole('tab', { name: 'File Info' }));
      expect(screen.getByText('8')).toBeDefined();
    });

    it('renders related PRs', async () => {
      render(<DetailPanel threads={threads} fileInfo={fileInfo} />);
      await userEvent.click(screen.getByRole('tab', { name: 'File Info' }));
      expect(screen.getByText('#42')).toBeDefined();
      expect(screen.getByText('#67')).toBeDefined();
    });

    it('shows empty message when no file info', async () => {
      render(<DetailPanel threads={threads} fileInfo={null} />);
      await userEvent.click(screen.getByRole('tab', { name: 'File Info' }));
      expect(screen.getByText('No file info available')).toBeDefined();
    });
  });
});
