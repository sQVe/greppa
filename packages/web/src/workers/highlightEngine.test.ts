import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { HighlightRequest } from './highlightProtocol';

const mockCodeToTokens = vi.fn();
const mockLoadLanguage = vi.fn();
const mockGetLoadedLanguages = vi.fn();

vi.mock('shiki', () => ({
  createHighlighter: vi.fn(() =>
    Promise.resolve({
      codeToTokens: mockCodeToTokens,
      loadLanguage: mockLoadLanguage,
      getLoadedLanguages: mockGetLoadedLanguages,
    }),
  ),
}));

const makeRequest = (overrides: Partial<HighlightRequest> = {}): HighlightRequest => ({
  type: 'highlight',
  filePath: 'src/foo.ts',
  language: 'typescript',
  theme: 'catppuccin-mocha',
  lines: [
    { key: 'context:1:1', content: 'const a = 1;' },
    { key: 'added::2', content: 'const b = 2;' },
  ],
  ...overrides,
});

describe('handleHighlightRequest', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetLoadedLanguages.mockReturnValue(['typescript']);
    mockCodeToTokens.mockReturnValue({
      tokens: [
        [{ content: 'const a = 1;', color: '#f00' }],
        [{ content: 'const b = 2;', color: '#0f0' }],
      ],
    });

    const mod = await import('./highlightEngine');
    mod.resetForTesting();
  });

  it('returns token map keyed by line key', async () => {
    const { handleHighlightRequest } = await import('./highlightEngine');
    const response = await handleHighlightRequest(makeRequest());

    expect(response.type).toBe('highlight-result');
    expect(response.filePath).toBe('src/foo.ts');
    expect(response.tokens['context:1:1']).toEqual([{ content: 'const a = 1;', color: '#f00' }]);
    expect(response.tokens['added::2']).toEqual([{ content: 'const b = 2;', color: '#0f0' }]);
  });

  it('does not create highlighter until first request', async () => {
    const { createHighlighter } = await import('shiki');

    expect(createHighlighter).not.toHaveBeenCalled();

    const { handleHighlightRequest } = await import('./highlightEngine');
    await handleHighlightRequest(makeRequest());

    expect(createHighlighter).toHaveBeenCalledOnce();
  });

  it('loads language on demand', async () => {
    const { handleHighlightRequest } = await import('./highlightEngine');
    await handleHighlightRequest(makeRequest({ language: 'python' }));

    expect(mockLoadLanguage).toHaveBeenCalledWith('python');
  });

  it('skips loading an already-loaded language', async () => {
    const { handleHighlightRequest } = await import('./highlightEngine');
    await handleHighlightRequest(makeRequest({ language: 'typescript' }));
    await handleHighlightRequest(makeRequest({ language: 'typescript' }));

    expect(mockLoadLanguage).toHaveBeenCalledTimes(1);
  });

  it('returns cached tokens without re-tokenizing', async () => {
    const { handleHighlightRequest } = await import('./highlightEngine');
    await handleHighlightRequest(makeRequest());
    await handleHighlightRequest(makeRequest());

    expect(mockCodeToTokens).toHaveBeenCalledOnce();
  });

  it('falls back to plaintext for unknown languages', async () => {
    mockLoadLanguage.mockRejectedValueOnce(new Error('Unknown language'));
    mockCodeToTokens.mockReturnValue({
      tokens: [
        [{ content: 'some code', color: undefined }],
      ],
    });

    const { handleHighlightRequest } = await import('./highlightEngine');
    const response = await handleHighlightRequest(
      makeRequest({
        language: 'fakeLang',
        lines: [{ key: 'context:1:1', content: 'some code' }],
      }),
    );

    expect(response.tokens['context:1:1']).toBeDefined();
    expect(mockCodeToTokens).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ lang: 'plaintext' }),
    );
  });
});
