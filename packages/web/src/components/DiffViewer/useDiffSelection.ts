import type { RefObject } from 'react';
import { useEffect } from 'react';

import styles from './DiffViewer.module.css';

const resolveSide = (activeSide: string | null, selection: Selection) => {
  if (activeSide != null) {
    return activeSide;
  }

  const anchorNode = selection.anchorNode;
  const element =
    anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;

  return element?.closest('[data-side]')?.getAttribute('data-side') ?? null;
};

const collectLines = (viewer: HTMLElement, side: string, range: Range) => {
  const lines: string[] = [];
  const contentCells = viewer.querySelectorAll(
    `[data-side="${side}"] .${styles.content}`,
  );

  for (const cell of contentCells) {
    if (!range.intersectsNode(cell)) {
      continue;
    }

    if (cell.textContent) {
      lines.push(cell.textContent);
    }
  }

  return lines;
};

export const useDiffSelection = (
  viewerRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) => {
  useEffect(() => {
    if (!enabled) {
      viewerRef.current?.removeAttribute('data-active-side');
      return;
    }

    const viewer = viewerRef.current;
    if (viewer == null) {
      return;
    }

    let activeSide: string | null = null;

    const handleMouseDown = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      const sideElement = event.target.closest('[data-side]');
      if (sideElement == null) {
        return;
      }

      const side = sideElement.getAttribute('data-side');
      if (side == null) {
        return;
      }

      if (event.shiftKey && activeSide != null && activeSide !== side) {
        event.preventDefault();
        return;
      }

      if (activeSide != null && activeSide !== side) {
        document.getSelection()?.removeAllRanges();
      }

      activeSide = side;
      viewer.setAttribute('data-active-side', side);
    };

    const handleMouseUp = () => {
      const selection = document.getSelection();
      if (selection == null || selection.isCollapsed) {
        viewer.removeAttribute('data-active-side');
        activeSide = null;
      }
    };

    const handleCopy = (event: ClipboardEvent) => {
      const selection = document.getSelection();
      if (selection == null || selection.isCollapsed || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (!viewer.contains(range.commonAncestorContainer)) {
        return;
      }

      const side = resolveSide(activeSide, selection);
      if (side == null) {
        return;
      }

      const lines = collectLines(viewer, side, range);
      if (lines.length > 0 && event.clipboardData != null) {
        event.preventDefault();
        event.clipboardData.setData('text/plain', lines.join('\n'));
      }
    };

    viewer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('copy', handleCopy);

    return () => {
      viewer.removeAttribute('data-active-side');
      viewer.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('copy', handleCopy);
    };
  }, [viewerRef, enabled]);
};
