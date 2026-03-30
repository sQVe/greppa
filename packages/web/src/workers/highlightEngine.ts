import type { BundledLanguage, Highlighter } from 'shiki';
import { createHighlighter } from 'shiki';

import type {
  HighlightRequest,
  HighlightResponse,
  HighlightToken,
} from './highlightProtocol';

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLanguages = new Set<string>();
const cache = new Map<string, HighlightToken[]>();

const getOrCreateHighlighter = () => {
  highlighterPromise ??= createHighlighter({
    themes: ['catppuccin-mocha', 'catppuccin-latte'],
    langs: [],
  });

  return highlighterPromise;
};

export const handleHighlightRequest = async (
  request: HighlightRequest,
): Promise<HighlightResponse> => {
  const highlighter = await getOrCreateHighlighter();
  const { filePath, language, theme, lines } = request;

  let resolvedLanguage = language;
  if (!loadedLanguages.has(language)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- language strings from DiffFile are valid Shiki language IDs
      await highlighter.loadLanguage(language as BundledLanguage);
      loadedLanguages.add(language);
    } catch {
      resolvedLanguage = 'plaintext';
      if (!loadedLanguages.has('plaintext')) {
        await highlighter.loadLanguage('plaintext');
        loadedLanguages.add('plaintext');
      }
    }
  }

  const uncachedLines: { key: string; content: string }[] = [];
  for (const line of lines) {
    const cacheKey = `${filePath}:${line.key}`;
    if (!cache.has(cacheKey)) {
      uncachedLines.push({ key: line.key, content: line.content });
    }
  }

  if (uncachedLines.length > 0) {
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
        cache.set(`${filePath}:${line.key}`, serialized);
      }
    }
  }

  const tokens: Record<string, HighlightToken[]> = {};
  for (const line of lines) {
    const cached = cache.get(`${filePath}:${line.key}`);
    if (cached != null) {
      tokens[line.key] = cached;
    }
  }

  return { type: 'highlight-result', filePath, tokens };
};

export const resetForTesting = () => {
  highlighterPromise = null;
  loadedLanguages.clear();
  cache.clear();
};
