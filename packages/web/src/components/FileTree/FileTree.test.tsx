// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FileNode } from '../../fixtures/types';
import { FileTree } from './FileTree';

const files: FileNode[] = [
  {
    path: 'src/auth',
    name: 'auth',
    type: 'directory',
    children: [
      {
        path: 'src/auth/validateToken.ts',
        name: 'validateToken.ts',
        type: 'file',
        changeType: 'modified',
        status: 'reviewed',
      },
    ],
  },
  {
    path: 'src/middleware',
    name: 'middleware',
    type: 'directory',
    children: [
      {
        path: 'src/middleware/rateLimiter.ts',
        name: 'rateLimiter.ts',
        type: 'file',
        changeType: 'added',
        status: 'unreviewed',
      },
    ],
  },
];

afterEach(() => {
  cleanup();
});

describe('FileTree', () => {
  it('renders the tree with aria label', () => {
    render(<FileTree files={files} selectedFilePath={null} onSelectFile={vi.fn()} />);
    expect(screen.getByRole('treegrid', { name: 'File tree' })).toBeDefined();
  });

  it('renders file names', () => {
    render(<FileTree files={files} selectedFilePath={null} onSelectFile={vi.fn()} />);
    expect(screen.getByText('validateToken.ts')).toBeDefined();
    expect(screen.getByText('rateLimiter.ts')).toBeDefined();
  });

  it('renders directory names', () => {
    render(<FileTree files={files} selectedFilePath={null} onSelectFile={vi.fn()} />);
    expect(screen.getByText('auth')).toBeDefined();
    expect(screen.getByText('middleware')).toBeDefined();
  });

  it('renders change type badges', () => {
    render(<FileTree files={files} selectedFilePath={null} onSelectFile={vi.fn()} />);
    expect(screen.getByText('M')).toBeDefined();
    expect(screen.getByText('A')).toBeDefined();
  });

  it('calls onSelectFile when a file is clicked', async () => {
    const onSelectFile = vi.fn();
    render(<FileTree files={files} selectedFilePath={null} onSelectFile={onSelectFile} />);
    await userEvent.click(screen.getByText('validateToken.ts'));
    expect(onSelectFile).toHaveBeenCalledWith('src/auth/validateToken.ts');
  });
});
