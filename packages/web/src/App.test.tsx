// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

vi.mock('shiki', () => ({
  createHighlighter: () => Promise.resolve(null),
}));

vi.mock('./hooks/useTheme', () => ({
  isTheme: (value: string) => ['catppuccin-mocha', 'catppuccin-latte'].includes(value),
  useTheme: () => ({
    theme: 'catppuccin-mocha' as const,
    setTheme: vi.fn(),
    themes: ['catppuccin-mocha', 'catppuccin-latte'] as const,
  }),
}));

afterEach(() => {
  cleanup();
});

const renderApp = (initialLocation = '/') => {
  const rootRoute = createRootRoute({ component: App });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' });
  const fileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/file/$' });
  const routeTree = rootRoute.addChildren([indexRoute, fileRoute]);
  const history = createMemoryHistory({ initialEntries: [initialLocation] });
  const router = createRouter({ routeTree, history });

  return render(<RouterProvider router={router} />);
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
