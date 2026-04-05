// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FileNode } from '../../fixtures/types';
import { collectDirectoryIds, FileTree } from './FileTree';

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

const allExpandedKeys = collectDirectoryIds(files);

const defaultProps = {
  files,
  selectedPaths: new Set<string>(),
  expandedKeys: allExpandedKeys,
  onSelectFile: vi.fn(),
  onExpandedKeysChange: vi.fn(),
};

afterEach(() => {
  cleanup();
});

describe('FileTree', () => {
  it('renders the tree with aria label', () => {
    render(<FileTree {...defaultProps} />);
    expect(screen.getByRole('treegrid', { name: 'File tree' })).toBeDefined();
  });

  it('renders file names', () => {
    render(<FileTree {...defaultProps} />);
    expect(screen.getByText('validateToken.ts')).toBeDefined();
    expect(screen.getByText('rateLimiter.ts')).toBeDefined();
  });

  it('renders directory names', () => {
    render(<FileTree {...defaultProps} />);
    expect(screen.getByText('auth')).toBeDefined();
    expect(screen.getByText('middleware')).toBeDefined();
  });

  it('renders change type badges', () => {
    render(<FileTree {...defaultProps} />);
    expect(screen.getByText('M')).toBeDefined();
    expect(screen.getByText('A')).toBeDefined();
  });

  it('calls onSelectFile when a file is clicked', async () => {
    const onSelectFile = vi.fn();
    render(<FileTree {...defaultProps} onSelectFile={onSelectFile} />);
    await userEvent.click(screen.getByText('validateToken.ts'));
    expect(onSelectFile).toHaveBeenCalledWith('src/auth/validateToken.ts', { shiftKey: false, metaKey: false });
  });

  it('calls onSelectFile with shiftKey true when shift-clicking', async () => {
    const user = userEvent.setup();
    const onSelectFile = vi.fn();
    render(<FileTree {...defaultProps} onSelectFile={onSelectFile} />);
    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('rateLimiter.ts'));
    await user.keyboard('{/Shift}');
    expect(onSelectFile).toHaveBeenCalledWith('src/middleware/rateLimiter.ts', { shiftKey: true, metaKey: false });
  });

  it('highlights all paths in selectedPaths', () => {
    render(
      <FileTree
        {...defaultProps}
        selectedPaths={new Set(['src/auth/validateToken.ts', 'src/middleware/rateLimiter.ts'])}
      />,
    );
    const tree = screen.getByRole('treegrid');
    const selectedRows = tree.querySelectorAll('[aria-selected="true"]');
    expect(selectedRows).toHaveLength(2);
  });

  it('uses multiple selection mode', () => {
    render(<FileTree {...defaultProps} />);
    const tree = screen.getByRole('treegrid');
    expect(tree.getAttribute('aria-multiselectable')).toBe('true');
  });

  it('renders file icons as img elements', () => {
    const { container } = render(<FileTree {...defaultProps} />);
    const images = container.querySelectorAll('img');
    expect(images.length).toBe(4);
  });

  it('applies change type color class to filenames', () => {
    render(<FileTree {...defaultProps} />);
    const modified = screen.getByText('validateToken.ts');
    expect(modified.className).toContain('modified');
    const added = screen.getByText('rateLimiter.ts');
    expect(added.className).toContain('added');
  });

  it('renders displayName when present on compacted directories', () => {
    const compactedFiles: FileNode[] = [
      {
        path: 'src/events',
        name: 'events',
        displayName: 'src/events',
        type: 'directory',
        children: [
          {
            path: 'src/events/handler.ts',
            name: 'handler.ts',
            type: 'file',
            changeType: 'added',
          },
        ],
      },
    ];
    render(
      <FileTree
        {...defaultProps}
        files={compactedFiles}
        expandedKeys={collectDirectoryIds(compactedFiles)}
      />,
    );
    expect(screen.getByText('src/events')).toBeDefined();
  });

  it('does not call onSelectFile when clicking a directory', async () => {
    const onSelectFile = vi.fn();
    render(<FileTree {...defaultProps} onSelectFile={onSelectFile} />);
    await userEvent.click(screen.getByText('auth'));
    expect(onSelectFile).not.toHaveBeenCalled();
  });

  it('toggles expansion when clicking a directory', async () => {
    const onExpandedKeysChange = vi.fn();
    render(
      <FileTree {...defaultProps} onExpandedKeysChange={onExpandedKeysChange} />,
    );
    await userEvent.click(screen.getByText('auth'));
    expect(onExpandedKeysChange).toHaveBeenCalled();
    const keys = onExpandedKeysChange.mock.calls[0]?.[0] as Set<string | number>;
    expect(keys.has('src/auth')).toBe(false);
    expect(keys.has('src/middleware')).toBe(true);
  });

  it('calls onSelectFile with metaKey when cmd-clicking a directory', async () => {
    const user = userEvent.setup();
    const onSelectFile = vi.fn();
    render(<FileTree {...defaultProps} onSelectFile={onSelectFile} />);
    await user.keyboard('{Meta>}');
    await user.click(screen.getByText('auth'));
    await user.keyboard('{/Meta}');
    expect(onSelectFile).toHaveBeenCalledWith('src/auth', { shiftKey: false, metaKey: true });
  });

  it('does not call onSelectDirectory when cmd-clicking a file', async () => {
    const user = userEvent.setup();
    const onSelectDirectory = vi.fn();
    render(<FileTree {...defaultProps} onSelectDirectory={onSelectDirectory} />);
    await user.keyboard('{Meta>}');
    await user.click(screen.getByText('validateToken.ts'));
    await user.keyboard('{/Meta}');
    expect(onSelectDirectory).not.toHaveBeenCalled();
  });

  it('calls onSelectDirectory when shift-clicking a directory', async () => {
    const user = userEvent.setup();
    const onSelectDirectory = vi.fn();
    render(<FileTree {...defaultProps} onSelectDirectory={onSelectDirectory} />);
    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('auth'));
    await user.keyboard('{/Shift}');
    expect(onSelectDirectory).toHaveBeenCalledWith('src/auth');
  });

  it('expands a collapsed directory when clicked', async () => {
    const onExpandedKeysChange = vi.fn();
    render(
      <FileTree {...defaultProps} expandedKeys={['src/middleware']} onExpandedKeysChange={onExpandedKeysChange} />,
    );
    await userEvent.click(screen.getByText('auth'));
    const keys = onExpandedKeysChange.mock.calls[0]?.[0] as Set<string | number>;
    expect(keys.has('src/auth')).toBe(true);
    expect(keys.has('src/middleware')).toBe(true);
  });

  it('does not render badges on directories with changeType', () => {
    const dirWithChange: FileNode[] = [
      {
        path: 'src',
        name: 'src',
        type: 'directory',
        changeType: 'modified',
        children: [
          {
            path: 'src/index.ts',
            name: 'index.ts',
            type: 'file',
            changeType: 'modified',
          },
        ],
      },
    ];
    render(
      <FileTree
        {...defaultProps}
        files={dirWithChange}
        expandedKeys={collectDirectoryIds(dirWithChange)}
      />,
    );
    const dirLabel = screen.getByText('src');
    expect(dirLabel.className).toContain('modified');
    const badges = screen.getAllByText('M');
    expect(badges).toHaveLength(1);
  });
});
