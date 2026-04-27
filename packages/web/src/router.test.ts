import { describe, expect, it } from 'vitest';

import { buildCommitsRedirectSearch } from './router';

describe('buildCommitsRedirectSearch', () => {
  it('preserves commitFile on same-section redirect', () => {
    const result = buildCommitsRedirectSearch('abc', {
      file: [],
      wt: [],
      commits: ['aaa'],
      commitFile: ['aaa:src/a.ts'],
    });
    expect(result).toEqual({
      s: 'abc',
      commits: ['aaa'],
      commitFile: ['aaa:src/a.ts'],
    });
  });

  it('returns empty commitFile when state has none', () => {
    const result = buildCommitsRedirectSearch('abc', {
      file: [],
      wt: [],
      commits: ['aaa'],
      commitFile: [],
    });
    expect(result.commitFile).toEqual([]);
  });
});
