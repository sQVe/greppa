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

const resolveLanguage = async (
  highlighter: Highlighter,
  language: string,
): Promise<string> => {
  if (failedLanguages.has(language)) {
    return 'plaintext';
  }

  if (loadedLanguages.has(language)) {
    return language;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- language strings from DiffFile are valid Shiki language IDs
    await highlighter.loadLanguage(language as BundledLanguage);
    loadedLanguages.add(language);
    return language;
  } catch {
    failedLanguages.add(language);
    if (!loadedLanguages.has('plaintext')) {
      await highlighter.loadLanguage('plaintext');
      loadedLanguages.add('plaintext');
    }
    return 'plaintext';
  }
};

const highlightFullContent = (
  highlighter: Highlighter,
  content: string,
  language: string,
  theme: string,
): HighlightToken[][] => {
  if (content === '') {
    return [];
  }

  const { tokens: tokenLines } = highlighter.codeToTokens(content, {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, oxlint/no-unsafe-type-assertion -- validated or resolved to plaintext above
    lang: language as BundledLanguage,
    theme,
  });

  return tokenLines.map((line) => line.map((token) => ({ content: token.content, color: token.color })));
};

const parseLineKey = (key: string): { side: 'old' | 'new'; lineNumber: number } | null => {
  const parts = key.split(':');
  if (key.startsWith('removed:')) {
    const parsedLineNumber = Number.parseInt(parts[1] ?? '', 10);
    return Number.isNaN(parsedLineNumber) ? null : { side: 'old', lineNumber: parsedLineNumber };
  }
  if (key.startsWith('added:')) {
    const parsedLineNumber = Number.parseInt(parts[2] ?? '', 10);
    return Number.isNaN(parsedLineNumber) ? null : { side: 'new', lineNumber: parsedLineNumber };
  }
  if (key.startsWith('context:')) {
    const parsedLineNumber = Number.parseInt(parts[1] ?? '', 10);
    return Number.isNaN(parsedLineNumber) ? null : { side: 'old', lineNumber: parsedLineNumber };
  }
  return null;
};

const handleFullFileRequest = async (
  request: HighlightRequest,
): Promise<HighlightResponse> => {
  const highlighter = await getOrCreateHighlighter();
  const { filePath, language, theme, lines, oldContent, newContent } = request;

  const tokens: Record<string, HighlightToken[]> = {};
  const uncachedLines: typeof lines = [];

  for (const line of lines) {
    const cacheKey = `${theme}:${filePath}:${line.key}`;
    const cached = cache.get(cacheKey);
    if (cached != null) {
      tokens[line.key] = cached;
    } else {
      uncachedLines.push(line);
    }
  }

  if (uncachedLines.length === 0) {
    return { type: 'highlight-result', requestId: request.requestId, filePath, tokens };
  }

  const resolvedLanguage = await resolveLanguage(highlighter, language);
  const oldTokens = highlightFullContent(highlighter, oldContent ?? '', resolvedLanguage, theme);
  const newTokens = highlightFullContent(highlighter, newContent ?? '', resolvedLanguage, theme);

  if (cache.size > MAX_CACHE_SIZE) {
    cache.clear();
  }

  for (const line of uncachedLines) {
    const cacheKey = `${theme}:${filePath}:${line.key}`;
    const parsed = parseLineKey(line.key);
    if (parsed == null) {
      continue;
    }

    const fileTokens = parsed.side === 'old' ? oldTokens : newTokens;
    const lineTokens = fileTokens[parsed.lineNumber - 1];
    if (lineTokens != null) {
      tokens[line.key] = lineTokens;
      cache.set(cacheKey, lineTokens);
    }
  }

  return { type: 'highlight-result', requestId: request.requestId, filePath, tokens };
};

const handleLineByLineRequest = async (
  request: HighlightRequest,
): Promise<HighlightResponse> => {
  const highlighter = await getOrCreateHighlighter();
  const { filePath, language, theme, lines } = request;
  const resolvedLanguage = await resolveLanguage(highlighter, language);

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
    const code = uncachedLines.map((line) => line.content).join('\n') || ' ';
    const { tokens: tokenLines } = highlighter.codeToTokens(code, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, oxlint/no-unsafe-type-assertion -- validated or resolved to plaintext above
      lang: resolvedLanguage as BundledLanguage,
      theme,
    });

    for (const [i, line] of uncachedLines.entries()) {
      const rawTokens = tokenLines[i];
      if (rawTokens != null) {
        const serialized: HighlightToken[] = rawTokens.map((token) => ({
          content: token.content,
          color: token.color,
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

  return { type: 'highlight-result', requestId: request.requestId, filePath, tokens };
};

export const handleHighlightRequest = async (
  request: HighlightRequest,
): Promise<HighlightResponse> => {
  if (request.oldContent != null || request.newContent != null) {
    return handleFullFileRequest(request);
  }

  return handleLineByLineRequest(request);
};

export const resetForTesting = () => {
  highlighterPromise = null;
  loadedLanguages.clear();
  failedLanguages.clear();
  cache.clear();
};
