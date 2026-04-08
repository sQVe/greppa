import { memo, useMemo } from 'react';

import { Badge } from '@greppa/ui';

import type { ChangeType, DiffFile } from '../../fixtures/types';

import styles from './StackedDiffViewer.module.css';

interface FileHeaderProps {
  diff: DiffFile;
  reviewedPaths?: Set<string>;
  onToggleReviewed?: (path: string) => void;
}

const CHANGE_LABELS: Record<ChangeType, string> = {
  added: 'Added',
  deleted: 'Deleted',
  modified: 'Modified',
  renamed: 'Renamed',
};

const LANGUAGE_LABELS: Record<string, string> = {
  bat: 'Batch',
  bibtex: 'BibTeX',
  c: 'C',
  clojure: 'Clojure',
  coffeescript: 'CoffeeScript',
  cpp: 'C++',
  csharp: 'C#',
  css: 'CSS',
  'cuda-cpp': 'CUDA C++',
  dart: 'Dart',
  diff: 'Diff',
  dockercompose: 'Compose',
  dockerfile: 'Docker',
  dotenv: 'Dotenv',
  elixir: 'Elixir',
  fsharp: 'F#',
  go: 'Go',
  graphql: 'GraphQL',
  groovy: 'Groovy',
  handlebars: 'Handlebars',
  haskell: 'Haskell',
  hlsl: 'HLSL',
  html: 'HTML',
  ini: 'Ini',
  java: 'Java',
  javascript: 'JavaScript',
  javascriptreact: 'JavaScript JSX',
  jsx: 'JavaScript JSX',
  json: 'JSON',
  jsonc: 'JSON with Comments',
  jsonl: 'JSON Lines',
  kotlin: 'Kotlin',
  latex: 'LaTeX',
  less: 'Less',
  lua: 'Lua',
  makefile: 'Makefile',
  markdown: 'Markdown',
  'objective-c': 'Objective-C',
  'objective-cpp': 'Objective-C++',
  perl: 'Perl',
  php: 'PHP',
  plaintext: 'Plain Text',
  powershell: 'PowerShell',
  python: 'Python',
  r: 'R',
  ruby: 'Ruby',
  rust: 'Rust',
  scala: 'Scala',
  scss: 'SCSS',
  shellscript: 'Shell Script',
  sql: 'SQL',
  swift: 'Swift',
  toml: 'TOML',
  tsx: 'TypeScript JSX',
  typescript: 'TypeScript',
  typescriptreact: 'TypeScript JSX',
  xml: 'XML',
  xsl: 'XSL',
  yaml: 'YAML',
};

const formatLanguage = (language: string) =>
  LANGUAGE_LABELS[language] ?? language;

const splitPath = (filePath: string) => {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) {
    return { directory: '', filename: filePath };
  }
  return {
    directory: filePath.slice(0, lastSlash + 1),
    filename: filePath.slice(lastSlash + 1),
  };
};

const computeDiffSize = (diff: DiffFile) => {
  let additions = 0;
  let deletions = 0;
  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      if (line.lineType === 'added') {
        additions++;
      } else if (line.lineType === 'removed') {
        deletions++;
      }
    }
  }
  return { additions, deletions };
};

export const FileHeader = memo(({ diff, reviewedPaths, onToggleReviewed }: FileHeaderProps) => {
  const { additions, deletions } = useMemo(() => computeDiffSize(diff), [diff]);
  const { directory, filename } = useMemo(() => splitPath(diff.path), [diff.path]);

  return (
    <div
      className={styles.fileHeader}
      data-testid="file-header"
      data-file-path={diff.path}
      data-change-type={diff.changeType}
    >
      <Badge variant={diff.changeType}>{CHANGE_LABELS[diff.changeType]}</Badge>
      <span className={styles.filePath}>
        <span className={styles.filePathDir}>{directory}</span>
        {filename}
      </span>
      <span className={styles.metaItem}>
        <span className={styles.additions}>+{additions}</span>
        <span className={styles.deletions}>{'\u2212'}{deletions}</span>
      </span>
      <span className={styles.metaItem}>{formatLanguage(diff.language)}</span>
      <button
        type="button"
        aria-pressed={reviewedPaths?.has(diff.path) ?? false}
        className={`${styles.reviewButton} ${reviewedPaths?.has(diff.path) ? styles.reviewed : ''}`}
        onClick={() => { onToggleReviewed?.(diff.path); }}
      >
        {reviewedPaths?.has(diff.path) ? '\u2713 Reviewed' : 'Mark reviewed'}
      </button>
    </div>
  );
});
