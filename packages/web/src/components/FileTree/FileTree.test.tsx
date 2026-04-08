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
  it('should render the tree with aria label', () => {
    render(<FileTree {...defaultProps} />);

    expect(screen.getByRole('treegrid', { name: 'File tree' })).toBeDefined();
  });

  it('should render file names', () => {
    render(<FileTree {...defaultProps} />);

    expect(screen.getByText('validateToken.ts')).toBeDefined();
    expect(screen.getByText('rateLimiter.ts')).toBeDefined();
  });

  it('should render directory names', () => {
    render(<FileTree {...defaultProps} />);

    expect(screen.getByText('auth')).toBeDefined();
    expect(screen.getByText('middleware')).toBeDefined();
  });

  it('should render change type badges', () => {
    render(<FileTree {...defaultProps} />);

    expect(screen.getByText('M')).toBeDefined();
    expect(screen.getByText('A')).toBeDefined();
  });

  it('should call onSelectFile when a file is clicked', async () => {
    const onSelectFile = vi.fn();
    render(<FileTree {...defaultProps} onSelectFile={onSelectFile} />);

    await userEvent.click(screen.getByText('validateToken.ts'));

    expect(onSelectFile).toHaveBeenCalledWith('src/auth/validateToken.ts', { shiftKey: false, metaKey: false });
  });

  it('should call onSelectFile with shiftKey true when shift-clicking', async () => {
    const user = userEvent.setup();
    const onSelectFile = vi.fn();
    render(<FileTree {...defaultProps} onSelectFile={onSelectFile} />);

    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('rateLimiter.ts'));
    await user.keyboard('{/Shift}');

    expect(onSelectFile).toHaveBeenCalledWith('src/middleware/rateLimiter.ts', { shiftKey: true, metaKey: false });
  });

  it('should highlight all paths in selectedPaths', () => {
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

  it('should use multiple selection mode', () => {
    render(<FileTree {...defaultProps} />);

    const tree = screen.getByRole('treegrid');

    expect(tree.getAttribute('aria-multiselectable')).toBe('true');
  });

  it('should render file icons as img elements', () => {
    const { container } = render(<FileTree {...defaultProps} />);

    const images = container.querySelectorAll('img');

    expect(images.length).toBe(4);
  });

  it('should not apply change type color class to filenames', () => {
    render(<FileTree {...defaultProps} />);

    const modified = screen.getByText('validateToken.ts');
    const added = screen.getByText('rateLimiter.ts');

    expect(modified.className).not.toContain('modified');
    expect(added.className).not.toContain('added');
  });

  it('should render displayName when present on compacted directories', () => {
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

  it('should not call onSelectFile when clicking a directory', async () => {
    const onSelectFile = vi.fn();
    render(<FileTree {...defaultProps} onSelectFile={onSelectFile} />);

    await userEvent.click(screen.getByText('auth'));

    expect(onSelectFile).not.toHaveBeenCalled();
  });

  it('should toggle expansion when clicking a directory', async () => {
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

  it('should call onSelectFile with metaKey when cmd-clicking an expanded directory', async () => {
    const user = userEvent.setup();
    const onSelectFile = vi.fn();
    render(<FileTree {...defaultProps} onSelectFile={onSelectFile} />);

    await user.keyboard('{Meta>}');
    await user.click(screen.getByText('auth'));
    await user.keyboard('{/Meta}');

    expect(onSelectFile).toHaveBeenCalledWith('src/auth', { shiftKey: false, metaKey: true });
  });

  it('should expand a collapsed directory when cmd-clicking instead of selecting', async () => {
    const user = userEvent.setup();
    const onSelectFile = vi.fn();
    const onExpandedKeysChange = vi.fn();
    render(
      <FileTree
        {...defaultProps}
        expandedKeys={['src/middleware']}
        onSelectFile={onSelectFile}
        onExpandedKeysChange={onExpandedKeysChange}
      />,
    );

    await user.keyboard('{Meta>}');
    await user.click(screen.getByText('auth'));
    await user.keyboard('{/Meta}');

    expect(onSelectFile).not.toHaveBeenCalled();
    const keys = onExpandedKeysChange.mock.calls[0]?.[0] as Set<string | number>;
    expect(keys.has('src/auth')).toBe(true);
  });

  it('should not call onSelectDirectory when cmd-clicking a file', async () => {
    const user = userEvent.setup();
    const onSelectDirectory = vi.fn();
    render(<FileTree {...defaultProps} onSelectDirectory={onSelectDirectory} />);

    await user.keyboard('{Meta>}');
    await user.click(screen.getByText('validateToken.ts'));
    await user.keyboard('{/Meta}');

    expect(onSelectDirectory).not.toHaveBeenCalled();
  });

  it('should call onSelectDirectory when shift-clicking a directory', async () => {
    const user = userEvent.setup();
    const onSelectDirectory = vi.fn();
    render(<FileTree {...defaultProps} onSelectDirectory={onSelectDirectory} />);

    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('auth'));
    await user.keyboard('{/Shift}');

    expect(onSelectDirectory).toHaveBeenCalledWith('src/auth');
  });

  it('should expand a collapsed directory when clicked', async () => {
    const onExpandedKeysChange = vi.fn();
    render(
      <FileTree {...defaultProps} expandedKeys={['src/middleware']} onExpandedKeysChange={onExpandedKeysChange} />,
    );

    await userEvent.click(screen.getByText('auth'));

    const keys = onExpandedKeysChange.mock.calls[0]?.[0] as Set<string | number>;
    expect(keys.has('src/auth')).toBe(true);
    expect(keys.has('src/middleware')).toBe(true);
  });

  it('should not render badges on directories with changeType', () => {
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
    const badges = screen.getAllByText('M');

    expect(dirLabel.className).not.toContain('modified');
    expect(badges).toHaveLength(1);
  });
});
