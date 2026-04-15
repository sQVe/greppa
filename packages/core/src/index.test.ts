import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { ChangeType, CommitEntry, DiffResponse, FileEntry } from './index';

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
      sizeTier: 'small',
    });

    expect(result).toEqual({
      path: 'a.ts',
      changeType: 'modified',
      sizeTier: 'small',
    });
  });

  it('decodes entry with oldPath', () => {
    const result = Schema.decodeUnknownSync(FileEntry)({
      path: 'b.ts',
      changeType: 'renamed',
      oldPath: 'a.ts',
      sizeTier: 'small',
    });

    expect(result).toEqual({
      path: 'b.ts',
      changeType: 'renamed',
      oldPath: 'a.ts',
      sizeTier: 'small',
    });
  });
});

describe('CommitEntry', () => {
  const base = {
    sha: 'abc123',
    abbrevSha: 'abc123',
    subject: 'feat: add thing',
    author: 'Author',
    date: '2026-04-15T00:00:00Z',
  };

  it('decodes entry with files list', () => {
    const result = Schema.decodeUnknownSync(CommitEntry)({ ...base, files: ['a.ts', 'b.ts'] });
    expect(result.files).toEqual(['a.ts', 'b.ts']);
  });

  it('decodes entry with empty files list', () => {
    const result = Schema.decodeUnknownSync(CommitEntry)({ ...base, files: [] });
    expect(result.files).toEqual([]);
  });

  it('rejects entry missing files', () => {
    expect(() => Schema.decodeUnknownSync(CommitEntry)(base)).toThrow();
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
