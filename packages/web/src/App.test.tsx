// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { zodValidator, fallback } from '@tanstack/zod-adapter';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { App } from './App';
import { parseSearch, stringifySearch } from './router';

vi.mock('./components/DiffViewer/useSyntaxHighlighting', () => ({
  useSyntaxHighlighting: () => null,
  useMultiSyntaxHighlighting: () => new Map(),
}));

vi.mock('./hooks/useFileList', () => ({
  useFileList: () => ({ files: null, isError: true, isLoading: false }),
  buildFileTree: (entries: unknown[]) => entries,
}));

vi.mock('./hooks/useWorktreeFiles', () => ({
  useWorktreeFiles: () => ({ files: null, isLoading: false, isError: false }),
}));

vi.mock('./hooks/useRefs', () => ({
  useRefs: () => ({ oldRef: 'HEAD~1', newRef: 'HEAD', isLoading: false, isError: false }),
}));

vi.mock('./hooks/useDiffContent', () => ({
  useDiffContent: () => ({ diff: null, isLoading: false, isError: false }),
}));

vi.mock('./hooks/useDiffComputation', () => ({
  useDiffComputation: () => ({ changes: null, error: null }),
}));

vi.mock('./hooks/usePreferences', () => ({
  isTheme: (value: string) => ['catppuccin-mocha', 'catppuccin-latte'].includes(value),
  THEMES: ['catppuccin-mocha', 'catppuccin-latte'] as const,
  usePreferences: () => ({
    state: { theme: 'catppuccin-mocha' as const },
    set: vi.fn(),
  }),
}));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

const reviewSearch = z.object({
  file: fallback(z.array(z.string()), []).default([]),
  wt: fallback(z.array(z.string()), []).default([]),
  commits: fallback(z.array(z.string()), []).default([]),
});

const renderApp = (initialLocation = '/review') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rootRoute = createRootRoute({ component: App });
  const reviewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/review',
    validateSearch: zodValidator(reviewSearch),
  });
  const routeTree = rootRoute.addChildren([reviewRoute]);
  const history = createMemoryHistory({ initialEntries: [initialLocation] });
  const router = createRouter({ routeTree, history, parseSearch, stringifySearch });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

describe('App', () => {
  it('does not render a header', async () => {
    renderApp();
    await screen.findByText('2 / 7');
    expect(screen.queryByText('Greppa')).toBeNull();
  });

  it('renders the activity rail on the left edge', async () => {
    renderApp();
    expect(await screen.findByTestId('activity-rail')).toBeDefined();
  });

  it('renders the status bar with fixture review count', async () => {
    renderApp();
    expect(await screen.findByText('2 / 7')).toBeDefined();
  });

  it('renders the file tree', async () => {
    renderApp();
    const treegrids = await screen.findAllByRole('treegrid', { name: 'File tree' });
    expect(treegrids.length).toBeGreaterThan(0);
  });

  it('renders the diff viewer placeholder', async () => {
    renderApp();
    expect(await screen.findByText('Select a file to view diff')).toBeDefined();
  });

  it('renders the detail panel placeholder', async () => {
    renderApp();
    expect(await screen.findByText('Select a file to view details')).toBeDefined();
  });

  it('increments reviewed count when selecting an unreviewed file', async () => {
    renderApp();
    expect(await screen.findByText('2 / 7')).toBeDefined();
    await userEvent.click(await screen.findByText('rateLimiter.ts'));
    expect(await screen.findByText('3 / 7')).toBeDefined();
  });

  it('does not increment when selecting an already-reviewed file', async () => {
    renderApp();
    await userEvent.click(await screen.findByText('validateToken.ts'));
    expect(await screen.findByText('2 / 7')).toBeDefined();
  });
});
