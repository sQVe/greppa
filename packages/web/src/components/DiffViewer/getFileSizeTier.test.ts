import { describe, expect, it } from 'vitest';

import { getFileSizeTier } from './getFileSizeTier';

describe('getFileSizeTier', () => {
  it('returns small for diffs under 500 rows', () => {
    expect(getFileSizeTier(0)).toBe('small');
    expect(getFileSizeTier(1)).toBe('small');
    expect(getFileSizeTier(499)).toBe('small');
  });

  it('returns medium for diffs between 500 and 4999 rows', () => {
    expect(getFileSizeTier(500)).toBe('medium');
    expect(getFileSizeTier(2500)).toBe('medium');
    expect(getFileSizeTier(4999)).toBe('medium');
  });

  it('returns large for diffs between 5000 and 49999 rows', () => {
    expect(getFileSizeTier(5000)).toBe('large');
    expect(getFileSizeTier(25000)).toBe('large');
    expect(getFileSizeTier(49999)).toBe('large');
  });

  it('returns huge for diffs with 50000 or more rows', () => {
    expect(getFileSizeTier(50000)).toBe('huge');
    expect(getFileSizeTier(100000)).toBe('huge');
  });
});
