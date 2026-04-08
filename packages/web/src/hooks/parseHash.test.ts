import { describe, expect, it } from 'vitest';

import { parseHash } from './parseHash';

describe('parseHash', () => {
  it('returns null for empty string', () => {
    expect(parseHash('')).toBeNull();
  });

  it('parses file path from hash', () => {
    expect(parseHash('#src/App.tsx')).toEqual({ path: 'src/App.tsx', line: null });
  });

  it('parses file path with line anchor', () => {
    expect(parseHash('#src/App.tsx:L42')).toEqual({ path: 'src/App.tsx', line: 42 });
  });

  it('ignores invalid line number', () => {
    expect(parseHash('#src/App.tsx:Labc')).toEqual({ path: 'src/App.tsx', line: null });
  });

  it('returns null for bare hash', () => {
    expect(parseHash('#')).toBeNull();
  });
});
