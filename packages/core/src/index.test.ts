import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { ChangeType, FileEntry } from './index';

describe('ChangeType', () => {
  it('decodes valid change types', () => {
    for (const value of ['added', 'modified', 'deleted', 'renamed']) {
      expect(Schema.decodeUnknownSync(ChangeType)(value)).toBe(value);
    }
  });

  it('rejects invalid values', () => {
    expect(() => Schema.decodeUnknownSync(ChangeType)('invalid')).toThrow();
  });
});

describe('FileEntry', () => {
  it('decodes entry without oldPath', () => {
    const result = Schema.decodeUnknownSync(FileEntry)({
      path: 'a.ts',
      changeType: 'modified',
    });

    expect(result).toEqual({ path: 'a.ts', changeType: 'modified' });
  });

  it('decodes entry with oldPath', () => {
    const result = Schema.decodeUnknownSync(FileEntry)({
      path: 'b.ts',
      changeType: 'renamed',
      oldPath: 'a.ts',
    });

    expect(result).toEqual({ path: 'b.ts', changeType: 'renamed', oldPath: 'a.ts' });
  });
});
