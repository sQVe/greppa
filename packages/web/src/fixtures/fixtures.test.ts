import { describe, expect, it } from 'vitest';

import { diffs } from './index';
import type { DiffFile, DiffLine } from './types';

const countLines = (diff: DiffFile) =>
  diff.hunks.reduce((sum, hunk) => sum + hunk.lines.length, 0);

const hasLineType = (diff: DiffFile, type: DiffLine['lineType']) =>
  diff.hunks.some((hunk) => hunk.lines.some((line) => line.lineType === type));

describe('large fixtures', () => {
  describe('userService', () => {
    const diff = diffs.get('src/services/userService.ts');

    it('exists in the diff map', () => {
      expect(diff).toBeDefined();
    });

    it('has 200+ lines of code content', () => {
      expect(countLines(diff!)).toBeGreaterThanOrEqual(200);
    });

    it('has multiple hunks', () => {
      expect(diff!.hunks.length).toBeGreaterThanOrEqual(3);
    });

    it('includes additions, removals, and context lines', () => {
      expect(hasLineType(diff!, 'added')).toBe(true);
      expect(hasLineType(diff!, 'removed')).toBe(true);
      expect(hasLineType(diff!, 'context')).toBe(true);
    });
  });

  describe('eventEmitter', () => {
    const diff = diffs.get('src/events/eventEmitter.ts');

    it('exists in the diff map', () => {
      expect(diff).toBeDefined();
    });

    it('has 200+ lines of code content', () => {
      expect(countLines(diff!)).toBeGreaterThanOrEqual(200);
    });

    it('has multiple hunks', () => {
      expect(diff!.hunks.length).toBeGreaterThanOrEqual(3);
    });

    it('includes additions, removals, and context lines', () => {
      expect(hasLineType(diff!, 'added')).toBe(true);
      expect(hasLineType(diff!, 'removed')).toBe(true);
      expect(hasLineType(diff!, 'context')).toBe(true);
    });
  });
});
