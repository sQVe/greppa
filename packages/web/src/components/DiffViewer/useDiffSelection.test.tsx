// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import styles from './DiffViewer.module.css';
import { useDiffSelection } from './useDiffSelection';

const TestHost = ({ enabled = true }: { enabled?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  useDiffSelection(ref, enabled);

  return (
    <div ref={ref} data-testid="viewer">
      <div className={styles.hunkHeader}>@@ -1,3 +1,3 @@</div>
      <div className={styles.row}>
        <div data-side="left">
          <div className={styles.gutter}>1</div>
          <div className={styles.content}>left line 1</div>
        </div>
        <div data-side="right">
          <div className={styles.gutter}>1</div>
          <div className={styles.content}>right line 1</div>
        </div>
      </div>
      <div className={styles.row}>
        <div data-side="left">
          <div className={styles.gutter}>2</div>
          <div className={styles.content}>left line 2</div>
        </div>
        <div data-side="right">
          <div className={styles.gutter}>2</div>
          <div className={styles.content}>right line 2</div>
        </div>
      </div>
      <div className={styles.row}>
        <div data-side="left">
          <div className={styles.gutter} />
          <div className={styles.content} />
        </div>
        <div data-side="right">
          <div className={styles.gutter}>3</div>
          <div className={styles.content}>right line 3</div>
        </div>
      </div>
    </div>
  );
};

const getViewer = () => document.querySelector('[data-testid="viewer"]')!;

const getContentCell = (side: 'left' | 'right', index: number) =>
  document.querySelectorAll(`[data-side="${side}"] [class*="content"]`)[index]!;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useDiffSelection', () => {
  describe('mousedown', () => {
    it('sets data-active-side on viewer when mousedown on left side', () => {
      render(<TestHost />);
      const content = getContentCell('left', 0);
      fireEvent.mouseDown(content);
      expect(getViewer().getAttribute('data-active-side')).toBe('left');
    });

    it('sets data-active-side on viewer when mousedown on right side', () => {
      render(<TestHost />);
      const content = getContentCell('right', 0);
      fireEvent.mouseDown(content);
      expect(getViewer().getAttribute('data-active-side')).toBe('right');
    });

    it('clears selection when switching sides', () => {
      render(<TestHost />);
      const rightContent = getContentCell('right', 0);
      fireEvent.mouseDown(rightContent);

      const range = document.createRange();
      range.selectNodeContents(rightContent);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);
      expect(document.getSelection()?.isCollapsed).toBe(false);

      fireEvent.mouseDown(getContentCell('left', 0));
      expect(document.getSelection()?.isCollapsed).toBe(true);
    });

    it('does not set data-active-side when mousedown outside a side', () => {
      render(<TestHost />);
      fireEvent.mouseDown(getViewer());
      expect(getViewer().getAttribute('data-active-side')).toBeNull();
    });
  });

  describe('mouseup', () => {
    it('clears data-active-side when selection is collapsed', () => {
      render(<TestHost />);
      fireEvent.mouseDown(getContentCell('left', 0));
      expect(getViewer().getAttribute('data-active-side')).toBe('left');

      fireEvent.mouseUp(document);
      expect(getViewer().getAttribute('data-active-side')).toBeNull();
    });

    it('keeps data-active-side when selection is active', () => {
      render(<TestHost />);
      const leftContent = getContentCell('left', 0);
      fireEvent.mouseDown(leftContent);

      const range = document.createRange();
      range.selectNodeContents(leftContent);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);

      fireEvent.mouseUp(document);
      expect(getViewer().getAttribute('data-active-side')).toBe('left');

      document.getSelection()?.removeAllRanges();
    });
  });

  describe('shift+click', () => {
    it('prevents extending selection to the opposite side', () => {
      render(<TestHost />);
      fireEvent.mouseDown(getContentCell('left', 0));

      const rightContent = getContentCell('right', 1);
      const prevented = !fireEvent.mouseDown(rightContent, { shiftKey: true });

      expect(prevented).toBe(true);
      expect(getViewer().getAttribute('data-active-side')).toBe('left');
    });

    it('allows extending selection on the same side', () => {
      render(<TestHost />);
      fireEvent.mouseDown(getContentCell('left', 0));
      fireEvent.mouseDown(getContentCell('left', 1), { shiftKey: true });
      expect(getViewer().getAttribute('data-active-side')).toBe('left');
    });
  });

  describe('copy', () => {
    const mockSelection = (viewer: Element, anchorNode: Node) => {
      const range = document.createRange();
      range.selectNodeContents(viewer);

      vi.spyOn(document, 'getSelection').mockReturnValue({
        isCollapsed: false,
        rangeCount: 1,
        getRangeAt: () => range,
        anchorNode,
      } as unknown as Selection);
    };

    it('writes only active side content to clipboard', () => {
      render(<TestHost />);
      const viewer = getViewer();
      const leftContent = getContentCell('left', 0);

      fireEvent.mouseDown(leftContent);
      mockSelection(viewer, leftContent);

      const clipboardData = new DataTransfer();
      const copyEvent = new ClipboardEvent('copy', {
        clipboardData,
        cancelable: true,
        bubbles: true,
      });
      viewer.dispatchEvent(copyEvent);

      expect(copyEvent.defaultPrevented).toBe(true);
      expect(clipboardData.getData('text/plain')).toBe(
        'left line 1\nleft line 2',
      );
    });

    it('skips empty cells during copy', () => {
      render(<TestHost />);
      const viewer = getViewer();
      const rightContent = getContentCell('right', 0);

      fireEvent.mouseDown(rightContent);
      mockSelection(viewer, rightContent);

      const clipboardData = new DataTransfer();
      const copyEvent = new ClipboardEvent('copy', {
        clipboardData,
        cancelable: true,
        bubbles: true,
      });
      viewer.dispatchEvent(copyEvent);

      expect(clipboardData.getData('text/plain')).toBe(
        'right line 1\nright line 2\nright line 3',
      );
    });

    it('does not intercept copy when no side is active', () => {
      render(<TestHost />);
      const viewer = getViewer();

      vi.spyOn(document, 'getSelection').mockReturnValue({
        isCollapsed: false,
        rangeCount: 1,
        getRangeAt: () => {
          const range = document.createRange();
          range.selectNodeContents(viewer);
          return range;
        },
        anchorNode: viewer,
      } as unknown as Selection);

      const clipboardData = new DataTransfer();
      const copyEvent = new ClipboardEvent('copy', {
        clipboardData,
        cancelable: true,
        bubbles: true,
      });
      viewer.dispatchEvent(copyEvent);

      expect(copyEvent.defaultPrevented).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes listeners when disabled', () => {
      const { rerender } = render(<TestHost enabled />);
      fireEvent.mouseDown(getContentCell('left', 0));
      expect(getViewer().getAttribute('data-active-side')).toBe('left');
      fireEvent.mouseUp(document);

      rerender(<TestHost enabled={false} />);

      fireEvent.mouseDown(getContentCell('left', 0));
      expect(getViewer().getAttribute('data-active-side')).toBeNull();
    });

    it('clears data-active-side when disabled with active selection', () => {
      const { rerender } = render(<TestHost enabled />);
      const leftContent = getContentCell('left', 0);
      fireEvent.mouseDown(leftContent);

      const range = document.createRange();
      range.selectNodeContents(leftContent);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);

      fireEvent.mouseUp(document);
      expect(getViewer().getAttribute('data-active-side')).toBe('left');

      rerender(<TestHost enabled={false} />);
      expect(getViewer().getAttribute('data-active-side')).toBeNull();

      document.getSelection()?.removeAllRanges();
    });
  });
});
