import { describe, expect, it } from 'vitest';

import type { FileNode } from '../fixtures/types';
import { nextFilesToPrefetch } from './nextFilesToPrefetch';

const file = (path: string, sizeTier?: FileNode['sizeTier']): FileNode => ({
  path,
  name: path,
  type: 'file',
  sizeTier,
});

const directory = (path: string): FileNode => ({
  path,
  name: path,
  type: 'directory',
});

describe('nextFilesToPrefetch', () => {
  it('returns the next depth successors in order after the selected path', () => {
    const files = [file('a.ts'), file('b.ts'), file('c.ts'), file('d.ts')];

    const result = nextFilesToPrefetch(files, 'b.ts', 2);

    expect(result.map((n: FileNode) => n.path)).toEqual(['c.ts', 'd.ts']);
  });

  it('skips directory successors', () => {
    const files = [file('a.ts'), directory('sub'), file('b.ts'), file('c.ts')];

    const result = nextFilesToPrefetch(files, 'a.ts', 2);

    expect(result.map((n: FileNode) => n.path)).toEqual(['b.ts', 'c.ts']);
  });

  it('skips large successors and continues counting past them', () => {
    const files = [file('a.ts'), file('b.ts'), file('c.ts', 'large'), file('d.ts'), file('e.ts')];

    const result = nextFilesToPrefetch(files, 'b.ts', 2);

    expect(result.map((n: FileNode) => n.path)).toEqual(['d.ts', 'e.ts']);
  });
});
