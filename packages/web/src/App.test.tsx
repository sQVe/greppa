// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

vi.mock('./components/DiffViewer/useSyntaxHighlighting', () => ({
  useSyntaxHighlighting: () => null,
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

const renderApp = (initialLocation = '/') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rootRoute = createRootRoute({ component: App });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' });
  const fileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/file/$' });
  const routeTree = rootRoute.addChildren([indexRoute, fileRoute]);
  const history = createMemoryHistory({ initialEntries: [initialLocation] });
  const router = createRouter({ routeTree, history });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

describe('App', () => {
  it('renders the header with logo', async () => {
    renderApp();
    expect(await screen.findByText('Greppa')).toBeDefined();
  });

  it('renders the status bar with fixture review counts', async () => {
    renderApp();
    expect(await screen.findByText('2/7 files reviewed')).toBeDefined();
  });

  it('renders the file tree', async () => {
    renderApp();
    expect(await screen.findByRole('treegrid', { name: 'File tree' })).toBeDefined();
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
    expect(await screen.findByText('2/7 files reviewed')).toBeDefined();
    await userEvent.click(await screen.findByText('rateLimiter.ts'));
    expect(await screen.findByText('3/7 files reviewed')).toBeDefined();
  });

  it('does not increment when selecting an already-reviewed file', async () => {
    renderApp();
    await userEvent.click(await screen.findByText('validateToken.ts'));
    expect(await screen.findByText('2/7 files reviewed')).toBeDefined();
  });
});
