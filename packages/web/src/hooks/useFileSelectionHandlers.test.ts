// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { useFileSelectionHandlers } from './useFileSelectionHandlers';
import { useMultiSelect } from './useMultiSelect';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    useRouterState: vi.fn(({ select }: { select: (s: unknown) => unknown }) => {
      const fakeState = { location: { pathname: '/changes', search: {} } };
      return select(fakeState);
    }),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

const committedFiles: FileNode[] = [
  {
    path: 'src',
    name: 'src',
    type: 'directory',
    children: [
      { path: 'src/index.ts', name: 'index.ts', type: 'file', changeType: 'modified' },
      { path: 'src/utils.ts', name: 'utils.ts', type: 'file', changeType: 'added' },
    ],
  },
  { path: 'README.md', name: 'README.md', type: 'file', changeType: 'modified' },
];

const worktreeFiles: FileNode[] = [
  { path: 'config.ts', name: 'config.ts', type: 'file', changeType: 'modified' },
  {
    path: 'lib',
    name: 'lib',
    type: 'directory',
    children: [{ path: 'lib/helpers.ts', name: 'helpers.ts', type: 'file', changeType: 'added' }],
  },
];

const emptyDirectory: FileNode[] = [
  { path: 'empty', name: 'empty', type: 'directory', children: [] },
];

const NO_MODIFIERS = { shiftKey: false, metaKey: false };
const SHIFT = { shiftKey: true, metaKey: false };
const META = { shiftKey: false, metaKey: true };

const setup = (files = committedFiles, wt = worktreeFiles) => {
  const { result } = renderHook(() => {
    const multiSelect = useMultiSelect({
      committedFilePaths: ['src/index.ts', 'src/utils.ts', 'README.md'],
      worktreeFilePaths: ['config.ts', 'lib/helpers.ts'],
    });

    const selectSpy = vi.spyOn(multiSelect, 'select');
    const toggleSpy = vi.spyOn(multiSelect, 'toggle');
    const selectRangeSpy = vi.spyOn(multiSelect, 'selectRange');
    const toggleAllSpy = vi.spyOn(multiSelect, 'toggleAll');
    const selectAllSpy = vi.spyOn(multiSelect, 'selectAll');

    const handlers = useFileSelectionHandlers({
      files,
      worktreeFiles: wt,
      multiSelect,
    });
    return {
      multiSelect,
      handlers,
      selectSpy,
      toggleSpy,
      selectRangeSpy,
      toggleAllSpy,
      selectAllSpy,
    };
  });
  return { result };
};

afterEach(() => {
  cleanup();
});

describe('useFileSelectionHandlers', () => {
  describe('handleSelectCommittedFile', () => {
    it('should call multiSelect.select on plain click', () => {
      const { result } = setup();

      act(() => {
        result.current.handlers.handleSelectCommittedFile('src/index.ts', NO_MODIFIERS);
      });

      expect(result.current.selectSpy).toHaveBeenCalledWith(
        'src/index.ts',
        'committed',
        'src/index.ts',
      );
    });

    it('should toggle file on meta+click', () => {
      const { result } = setup();
      act(() => {
        result.current.handlers.handleSelectCommittedFile('src/index.ts', NO_MODIFIERS);
      });

      act(() => {
        result.current.handlers.handleSelectCommittedFile('src/utils.ts', META);
      });

      expect(result.current.toggleSpy).toHaveBeenCalledWith(
        'src/utils.ts',
        'committed',
        'src/utils.ts',
      );
    });

    it('should remove file on meta+click when already selected', () => {
      const { result } = setup();
      act(() => {
        result.current.handlers.handleSelectCommittedFile('src/index.ts', NO_MODIFIERS);
      });
      act(() => {
        result.current.handlers.handleSelectCommittedFile('src/utils.ts', META);
      });

      act(() => {
        result.current.handlers.handleSelectCommittedFile('src/index.ts', META);
      });

      expect(result.current.toggleSpy).toHaveBeenCalledWith(
        'src/index.ts',
        'committed',
        'src/index.ts',
      );
    });

    it('should range select on shift+click', () => {
      const { result } = setup();
      act(() => {
        result.current.handlers.handleSelectCommittedFile('src/index.ts', NO_MODIFIERS);
      });

      act(() => {
        result.current.handlers.handleSelectCommittedFile('README.md', SHIFT);
      });

      expect(result.current.selectRangeSpy).toHaveBeenCalledWith(
        'README.md',
        ['src/index.ts', 'src/utils.ts', 'README.md'],
        'committed',
        'README.md',
      );
    });

    it('should not call select on shift+click', () => {
      const { result } = setup();

      act(() => {
        result.current.handlers.handleSelectCommittedFile('src/index.ts', SHIFT);
      });

      expect(result.current.selectSpy).not.toHaveBeenCalled();
    });

    it('should not call select on meta+click', () => {
      const { result } = setup();

      act(() => {
        result.current.handlers.handleSelectCommittedFile('src/index.ts', META);
      });

      expect(result.current.selectSpy).not.toHaveBeenCalled();
    });

    it('should toggle all directory children on meta+click directory', () => {
      const { result } = setup();
      act(() => {
        result.current.handlers.handleSelectCommittedFile('README.md', NO_MODIFIERS);
      });

      act(() => {
        result.current.handlers.handleSelectCommittedFile('src', META);
      });

      expect(result.current.toggleAllSpy).toHaveBeenCalledWith(
        ['src/index.ts', 'src/utils.ts'],
        'committed',
        'src/index.ts',
      );
    });

    it('should remove all directory children on meta+click when all already selected', () => {
      const { result } = setup();
      act(() => {
        result.current.handlers.handleSelectAllCommitted();
      });

      act(() => {
        result.current.handlers.handleSelectCommittedFile('src', META);
      });

      expect(result.current.toggleAllSpy).toHaveBeenCalledWith(
        ['src/index.ts', 'src/utils.ts'],
        'committed',
        'src/index.ts',
      );
    });
  });

  describe('handleSelectCommittedDirectory', () => {
    it('should select all descendant files', () => {
      const { result } = setup();

      act(() => {
        result.current.handlers.handleSelectCommittedDirectory('src');
      });

      expect(result.current.selectAllSpy).toHaveBeenCalledWith(
        ['src/index.ts', 'src/utils.ts'],
        'committed',
      );
    });

    it('should do nothing for empty directory', () => {
      const { result } = setup(emptyDirectory);

      act(() => {
        result.current.handlers.handleSelectCommittedDirectory('empty');
      });

      expect(result.current.selectAllSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleSelectAllCommitted', () => {
    it('should select all committed files', () => {
      const { result } = setup();

      act(() => {
        result.current.handlers.handleSelectAllCommitted();
      });

      expect(result.current.selectAllSpy).toHaveBeenCalledWith(
        ['src/index.ts', 'src/utils.ts', 'README.md'],
        'committed',
      );
    });
  });

  describe('handleSelectWorktreeFile', () => {
    it('should call multiSelect.select on plain click', () => {
      const { result } = setup();

      act(() => {
        result.current.handlers.handleSelectWorktreeFile('config.ts', NO_MODIFIERS);
      });

      expect(result.current.selectSpy).toHaveBeenCalledWith('config.ts', 'worktree', 'config.ts');
    });

    it('should toggle file on meta+click', () => {
      const { result } = setup();
      act(() => {
        result.current.handlers.handleSelectWorktreeFile('config.ts', NO_MODIFIERS);
      });

      act(() => {
        result.current.handlers.handleSelectWorktreeFile('lib/helpers.ts', META);
      });

      expect(result.current.toggleSpy).toHaveBeenCalledWith(
        'lib/helpers.ts',
        'worktree',
        'lib/helpers.ts',
      );
    });

    it('should range select on shift+click', () => {
      const { result } = setup();
      act(() => {
        result.current.handlers.handleSelectWorktreeFile('config.ts', NO_MODIFIERS);
      });

      act(() => {
        result.current.handlers.handleSelectWorktreeFile('lib/helpers.ts', SHIFT);
      });

      expect(result.current.selectRangeSpy).toHaveBeenCalledWith(
        'lib/helpers.ts',
        ['config.ts', 'lib/helpers.ts'],
        'worktree',
        'lib/helpers.ts',
      );
    });

    it('should toggle all directory children on meta+click directory', () => {
      const { result } = setup();
      act(() => {
        result.current.handlers.handleSelectWorktreeFile('config.ts', NO_MODIFIERS);
      });

      act(() => {
        result.current.handlers.handleSelectWorktreeFile('lib', META);
      });

      expect(result.current.toggleAllSpy).toHaveBeenCalledWith(
        ['lib/helpers.ts'],
        'worktree',
        'lib/helpers.ts',
      );
    });
  });

  describe('handleSelectWorktreeDirectory', () => {
    it('should select all descendant files with worktree source', () => {
      const { result } = setup();

      act(() => {
        result.current.handlers.handleSelectWorktreeDirectory('lib');
      });

      expect(result.current.selectAllSpy).toHaveBeenCalledWith(['lib/helpers.ts'], 'worktree');
    });
  });

  describe('handleSelectAllWorktree', () => {
    it('should select all worktree files', () => {
      const { result } = setup();

      act(() => {
        result.current.handlers.handleSelectAllWorktree();
      });

      expect(result.current.selectAllSpy).toHaveBeenCalledWith(
        ['config.ts', 'lib/helpers.ts'],
        'worktree',
      );
    });
  });

  describe('cross-source behavior', () => {
    it('should call multiSelect.select when switching sources', () => {
      const { result } = setup();
      act(() => {
        result.current.handlers.handleSelectCommittedFile('src/index.ts', NO_MODIFIERS);
      });

      act(() => {
        result.current.handlers.handleSelectWorktreeFile('config.ts', NO_MODIFIERS);
      });

      expect(result.current.selectSpy).toHaveBeenCalledWith('config.ts', 'worktree', 'config.ts');
    });
  });
});
