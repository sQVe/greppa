export interface CommitFileEntry {
  sha: string;
  path: string;
}

const SEP = ':';

export const encodeCommitFileKey = (entry: CommitFileEntry): string =>
  `${entry.sha}${SEP}${entry.path}`;

export const decodeCommitFileKey = (raw: string): CommitFileEntry | null => {
  const idx = raw.indexOf(SEP);
  if (idx <= 0 || idx === raw.length - 1) {
    return null;
  }
  return { sha: raw.slice(0, idx), path: raw.slice(idx + 1) };
};
