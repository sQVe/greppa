export interface HashTarget {
  path: string;
  line: number | null;
}

export const parseHash = (hash: string): HashTarget | null => {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw.length === 0) {
    return null;
  }

  const colonIndex = raw.lastIndexOf(':L');
  if (colonIndex === -1) {
    return { path: raw, line: null };
  }

  const path = raw.slice(0, colonIndex);
  const lineStr = raw.slice(colonIndex + 2);
  const line = Number.parseInt(lineStr, 10);

  if (Number.isNaN(line) || line < 1) {
    return { path, line: null };
  }

  return { path, line };
};
