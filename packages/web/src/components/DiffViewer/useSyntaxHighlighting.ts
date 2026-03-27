import { useEffect, useMemo, useState } from 'react';
import type { BundledLanguage, Highlighter, ThemedToken } from 'shiki';
import { createHighlighter } from 'shiki';

import type { DiffFile, DiffLine } from '../../fixtures/types';

interface TokenEntry {
  key: string;
  content: string;
}

export const diffLineKey = (line: DiffLine) =>
  `${line.lineType}:${line.oldLineNumber ?? ''}:${line.newLineNumber ?? ''}`;

let highlighterPromise: Promise<Highlighter> | null = null;

const getOrCreateHighlighter = () => {
  highlighterPromise ??= createHighlighter({
    themes: ['catppuccin-mocha', 'catppuccin-latte'],
    langs: ['typescript'],
  }).catch((error: unknown) => {
    highlighterPromise = null;
    throw error;
  });

  return highlighterPromise;
};

export const buildTokenEntries = (diff: DiffFile) => {
  const oldEntries: TokenEntry[] = [];
  const newEntries: TokenEntry[] = [];

  for (const [i, hunk] of diff.hunks.entries()) {
    if (i > 0) {
      oldEntries.push({ key: '', content: '' });
      newEntries.push({ key: '', content: '' });
    }

    for (const line of hunk.lines) {
      const key = diffLineKey(line);
      if (line.lineType !== 'added') {
        oldEntries.push({ key, content: line.content });
      }
      if (line.lineType !== 'removed') {
        newEntries.push({ key, content: line.content });
      }
    }
  }

  return { oldEntries, newEntries };
};

const useHighlighter = () => {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    void getOrCreateHighlighter().then(setHighlighter);
  }, []);

  return highlighter;
};

const buildTokenMap = (diff: DiffFile, highlighter: Highlighter, theme: string) => {
  const { oldEntries, newEntries } = buildTokenEntries(diff);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, oxlint/no-unsafe-type-assertion -- fixture language strings are valid Shiki language IDs
  const lang = diff.language as BundledLanguage;
  const oldTokenLines = highlighter.codeToTokens(
    oldEntries.map((e) => e.content).join('\n') || ' ',
    { lang, theme },
  ).tokens;
  const newTokenLines = highlighter.codeToTokens(
    newEntries.map((e) => e.content).join('\n') || ' ',
    { lang, theme },
  ).tokens;

  const map = new Map<string, ThemedToken[]>();
  for (const [i, entry] of oldEntries.entries()) {
    const tokens = oldTokenLines[i];
    if (entry.key !== '' && tokens != null) {
      map.set(entry.key, tokens);
    }
  }
  for (const [i, entry] of newEntries.entries()) {
    const tokens = newTokenLines[i];
    if (entry.key !== '' && !map.has(entry.key) && tokens != null) {
      map.set(entry.key, tokens);
    }
  }

  return map;
};

export const useSyntaxHighlighting = (diff: DiffFile | null, theme: string) => {
  const highlighter = useHighlighter();

  return useMemo(() => {
    if (highlighter == null || diff == null) {
      return null;
    }

    return buildTokenMap(diff, highlighter, theme);
  }, [diff, highlighter, theme]);
};
