import { describe, expect, it } from 'vitest';

import type { DiffRequest } from './diffProtocol';
import { handleDiffRequest } from './diffEngine';

const makeRequest = (overrides: Partial<DiffRequest> = {}): DiffRequest => ({
  type: 'diff',
  requestId: 'test-request',
  filePath: 'src/foo.ts',
  oldContent: 'const a = 1;\nconst b = 2;\n',
  newContent: 'const a = 1;\nconst b = 3;\n',
  ...overrides,
});

describe('handleDiffRequest', () => {
  it('returns diff-result with filePath', () => {
    const response = handleDiffRequest(makeRequest());

    expect(response.type).toBe('diff-result');
    expect(response.filePath).toBe('src/foo.ts');
  });

  it('detects changed line', () => {
    const response = handleDiffRequest(makeRequest());

    expect(response.changes.length).toBe(1);
    expect(response.changes[0]?.original.startLineNumber).toBe(2);
    expect(response.changes[0]?.modified.startLineNumber).toBe(2);
  });

  it('provides innerChanges for character-level diff', () => {
    const response = handleDiffRequest(makeRequest());
    const innerChanges = response.changes[0]?.innerChanges;

    expect(innerChanges).not.toBeNull();
    if (innerChanges == null) return;
    expect(innerChanges.length).toBeGreaterThan(0);
  });

  it('returns empty changes for identical content', () => {
    const response = handleDiffRequest(
      makeRequest({ oldContent: 'hello\n', newContent: 'hello\n' }),
    );

    expect(response.changes).toEqual([]);
  });

  it('handles added file with empty oldContent', () => {
    const response = handleDiffRequest(
      makeRequest({ oldContent: '', newContent: 'line 1\nline 2\n' }),
    );

    expect(response.changes.length).toBeGreaterThan(0);
    const totalModifiedLines = response.changes.reduce(
      (sum, c) => sum + (c.modified.endLineNumberExclusive - c.modified.startLineNumber),
      0,
    );
    expect(totalModifiedLines).toBeGreaterThan(0);
  });

  it('handles deleted file with empty newContent', () => {
    const response = handleDiffRequest(
      makeRequest({ oldContent: 'line 1\nline 2\n', newContent: '' }),
    );

    expect(response.changes.length).toBeGreaterThan(0);
    const totalOriginalLines = response.changes.reduce(
      (sum, c) => sum + (c.original.endLineNumberExclusive - c.original.startLineNumber),
      0,
    );
    expect(totalOriginalLines).toBeGreaterThan(0);
  });

  it('sets hitTimeout to false for small diffs', () => {
    const response = handleDiffRequest(makeRequest());

    expect(response.hitTimeout).toBe(false);
  });
});
