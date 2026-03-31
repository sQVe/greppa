import type { BundledLanguage, Highlighter } from 'shiki';
import { createHighlighter } from 'shiki';

import type {
  HighlightRequest,
  HighlightResponse,
  HighlightToken,
} from './highlightProtocol';

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLanguages = new Set<string>();
const failedLanguages = new Set<string>();
const cache = new Map<string, HighlightToken[]>();
const MAX_CACHE_SIZE = 10_000;

const getOrCreateHighlighter = () => {
  highlighterPromise ??= createHighlighter({
    themes: ['catppuccin-mocha', 'catppuccin-latte'],
    langs: [],
  }).catch((error: unknown) => {
    highlighterPromise = null;
    throw error;
  });

  return highlighterPromise;
};

export const handleHighlightRequest = async (
  request: HighlightRequest,
): Promise<HighlightResponse> => {
  const highlighter = await getOrCreateHighlighter();
  const { filePath, language, theme, lines } = request;

  let resolvedLanguage = language;
  if (failedLanguages.has(language)) {
    resolvedLanguage = 'plaintext';
  } else if (!loadedLanguages.has(language)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- language strings from DiffFile are valid Shiki language IDs
      await highlighter.loadLanguage(language as BundledLanguage);
      loadedLanguages.add(language);
    } catch {
      failedLanguages.add(language);
      resolvedLanguage = 'plaintext';
      if (!loadedLanguages.has('plaintext')) {
        await highlighter.loadLanguage('plaintext');
        loadedLanguages.add('plaintext');
      }
    }
  }

  const uncachedLines: { key: string; content: string }[] = [];
  for (const line of lines) {
    const cacheKey = `${theme}:${filePath}:${line.key}`;
    if (!cache.has(cacheKey)) {
      uncachedLines.push({ key: line.key, content: line.content });
    }
  }

  if (uncachedLines.length > 0) {
    if (cache.size > MAX_CACHE_SIZE) {
      cache.clear();
    }
    const code = uncachedLines.map((l) => l.content).join('\n') || ' ';
    const { tokens: tokenLines } = highlighter.codeToTokens(code, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, oxlint/no-unsafe-type-assertion -- validated or resolved to plaintext above
      lang: resolvedLanguage as BundledLanguage,
      theme,
    });

    for (const [i, line] of uncachedLines.entries()) {
      const rawTokens = tokenLines[i];
      if (rawTokens != null) {
        const serialized: HighlightToken[] = rawTokens.map((t) => ({
          content: t.content,
          color: t.color,
        }));
        cache.set(`${theme}:${filePath}:${line.key}`, serialized);
      }
    }
  }

  const tokens: Record<string, HighlightToken[]> = {};
  for (const line of lines) {
    const cached = cache.get(`${theme}:${filePath}:${line.key}`);
    if (cached != null) {
      tokens[line.key] = cached;
    }
  }

  return { type: 'highlight-result', filePath, tokens };
};

export const resetForTesting = () => {
  highlighterPromise = null;
  loadedLanguages.clear();
  failedLanguages.clear();
  cache.clear();
};
