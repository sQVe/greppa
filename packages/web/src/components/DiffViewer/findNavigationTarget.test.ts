import { describe, expect, it } from 'vitest';

import type { VirtualItem } from './buildVirtualItems';
import { findNavigationTarget } from './findNavigationTarget';

const items: VirtualItem[] = [
  { kind: 'hunk-header', header: '@@ -1,3 +1,3 @@' },
  { kind: 'diff-row', row: { left: { lineNumber: 1, tokenMapKey: 'context:1:1', content: 'a', type: 'context' }, right: { lineNumber: 1, tokenMapKey: 'context:1:1', content: 'a', type: 'context' } } },
  { kind: 'diff-row', row: { left: { lineNumber: 2, tokenMapKey: 'removed:2:', content: 'old', type: 'removed' }, right: { lineNumber: 2, tokenMapKey: 'added::2', content: 'new', type: 'added' } } },
  { kind: 'diff-row', row: { left: { lineNumber: 3, tokenMapKey: 'context:3:3', content: 'b', type: 'context' }, right: { lineNumber: 3, tokenMapKey: 'context:3:3', content: 'b', type: 'context' } } },
  { kind: 'hunk-header', header: '@@ -10,2 +10,2 @@' },
  { kind: 'diff-row', row: { left: { lineNumber: 10, tokenMapKey: 'removed:10:', content: 'x', type: 'removed' }, right: { lineNumber: 10, tokenMapKey: 'added::10', content: 'y', type: 'added' } } },
  { kind: 'diff-row', row: { left: { lineNumber: 11, tokenMapKey: 'context:11:11', content: 'c', type: 'context' }, right: { lineNumber: 11, tokenMapKey: 'context:11:11', content: 'c', type: 'context' } } },
];

describe('findNavigationTarget', () => {
  describe('next hunk (j)', () => {
    it('finds the first hunk header after the current index', () => {
      expect(findNavigationTarget(items, 0, 'nextHunk')).toBe(4);
    });

    it('returns null when already at the last hunk', () => {
      expect(findNavigationTarget(items, 4, 'nextHunk')).toBeNull();
      expect(findNavigationTarget(items, 6, 'nextHunk')).toBeNull();
    });

    it('finds the next hunk when starting from a diff row', () => {
      expect(findNavigationTarget(items, 2, 'nextHunk')).toBe(4);
    });
  });

  describe('previous hunk (k)', () => {
    it('finds the previous hunk header before the current index', () => {
      expect(findNavigationTarget(items, 5, 'prevHunk')).toBe(4);
      expect(findNavigationTarget(items, 4, 'prevHunk')).toBe(0);
    });

    it('returns null when already at the first hunk', () => {
      expect(findNavigationTarget(items, 0, 'prevHunk')).toBeNull();
    });

    it('finds the containing hunk when inside a hunk', () => {
      expect(findNavigationTarget(items, 3, 'prevHunk')).toBe(0);
    });
  });

  describe('next change (n)', () => {
    it('finds the next non-context diff row', () => {
      expect(findNavigationTarget(items, 0, 'nextChange')).toBe(2);
    });

    it('skips context rows', () => {
      expect(findNavigationTarget(items, 2, 'nextChange')).toBe(5);
    });

    it('returns null when no more changes exist', () => {
      expect(findNavigationTarget(items, 5, 'nextChange')).toBeNull();
    });
  });

  describe('previous change (p)', () => {
    it('finds the previous non-context diff row', () => {
      expect(findNavigationTarget(items, 5, 'prevChange')).toBe(2);
    });

    it('returns null when no previous changes exist', () => {
      expect(findNavigationTarget(items, 0, 'prevChange')).toBeNull();
      expect(findNavigationTarget(items, 2, 'prevChange')).toBeNull();
    });
  });
});
