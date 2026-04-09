import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { ChangeType, DiffResponse, FileEntry } from './index';

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
      lineCount: 3,
      sizeTier: 'small',
    });

    expect(result).toEqual({
      path: 'a.ts',
      changeType: 'modified',
      lineCount: 3,
      sizeTier: 'small',
    });
  });

  it('decodes entry with oldPath', () => {
    const result = Schema.decodeUnknownSync(FileEntry)({
      path: 'b.ts',
      changeType: 'renamed',
      oldPath: 'a.ts',
      lineCount: 12,
      sizeTier: 'small',
    });

    expect(result).toEqual({
      path: 'b.ts',
      changeType: 'renamed',
      oldPath: 'a.ts',
      lineCount: 12,
      sizeTier: 'small',
    });
  });

  it('decodes entry with lineCount and sizeTier', () => {
    const result = Schema.decodeUnknownSync(FileEntry)({
      path: 'a.ts',
      changeType: 'modified',
      lineCount: 42,
      sizeTier: 'small',
    });

    expect(result).toEqual({
      path: 'a.ts',
      changeType: 'modified',
      lineCount: 42,
      sizeTier: 'small',
    });
  });
});

describe('DiffResponse', () => {
  it('decodes response without oldPath', () => {
    const result = Schema.decodeUnknownSync(DiffResponse)({
      path: 'src/index.ts',
      changeType: 'modified',
      oldContent: 'old',
      newContent: 'new',
    });

    expect(result).toEqual({
      path: 'src/index.ts',
      changeType: 'modified',
      oldContent: 'old',
      newContent: 'new',
    });
  });

  it('decodes response with oldPath for renamed files', () => {
    const result = Schema.decodeUnknownSync(DiffResponse)({
      path: 'new.ts',
      changeType: 'renamed',
      oldPath: 'old.ts',
      oldContent: 'content',
      newContent: 'content',
    });

    expect(result).toEqual({
      path: 'new.ts',
      changeType: 'renamed',
      oldPath: 'old.ts',
      oldContent: 'content',
      newContent: 'content',
    });
  });

  it('decodes added file with empty oldContent', () => {
    const result = Schema.decodeUnknownSync(DiffResponse)({
      path: 'new.ts',
      changeType: 'added',
      oldContent: '',
      newContent: 'content',
    });

    expect(result.oldContent).toBe('');
  });

  it('decodes deleted file with empty newContent', () => {
    const result = Schema.decodeUnknownSync(DiffResponse)({
      path: 'old.ts',
      changeType: 'deleted',
      oldContent: 'content',
      newContent: '',
    });

    expect(result.newContent).toBe('');
  });
});
