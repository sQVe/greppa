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
  javascriptreact: 'JavaScript',
  jsx: 'JavaScript',
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
  tsx: 'TypeScript',
  typescript: 'TypeScript',
  typescriptreact: 'TypeScript',
  xml: 'XML',
  xsl: 'XSL',
  yaml: 'YAML',
};

const formatLanguage = (language: string) =>
  LANGUAGE_LABELS[language] ?? language;

const splitPath = (filePath: string) => filePath.split('/');

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
  const segments = useMemo(() => splitPath(diff.path), [diff.path]);

  return (
    <div
      className={styles.fileHeader}
      data-testid="file-header"
      data-file-path={diff.path}
      data-change-type={diff.changeType}
    >
      <span className={styles.filePath}>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <span key={index} className={isLast ? styles.fileName : styles.filePathDir}>
              {index > 0 && <span className={styles.pathSeparator}>/</span>}
              {segment}
            </span>
          );
        })}
      </span>
      <Badge variant={diff.changeType}>{CHANGE_LABELS[diff.changeType]}</Badge>
      <span className={styles.diffStat}>
        <span className={styles.additions}>+{additions}</span>
        <span className={styles.deletions}>{'\u2212'}{deletions}</span>
      </span>
      <span className={styles.language}>{formatLanguage(diff.language)}</span>
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
