import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { zodValidator, fallback } from '@tanstack/zod-adapter';
import { z } from 'zod';

import { App } from './App';

export const reviewSearch = z.object({
  file: fallback(z.array(z.string()), []).default([]),
  wt: fallback(z.array(z.string()), []).default([]),
  commits: fallback(z.array(z.string()), []).default([]),
});

export const parseSearch = (searchString: string): Record<string, unknown> => {
  const params = new URLSearchParams(
    searchString.startsWith('?') ? searchString.slice(1) : searchString,
  );
  const result: Record<string, string[]> = {};
  for (const key of params.keys()) {
    result[key] ??= params.getAll(key);
  }
  return result;
};

export const stringifySearch = (search: Record<string, unknown>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item));
      }
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params.append(key, String(value));
    }
  }
  const str = params.toString().replaceAll('%2F', '/');
  return str ? `?${str}` : '';
};

const rootRoute = createRootRoute({ component: App });

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review',
  validateSearch: zodValidator(reviewSearch),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
    throw redirect({ to: '/review' });
  },
});

const fileRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/file/$',
  beforeLoad: ({ params }) => {
    // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
    throw redirect({ to: '/review', search: { file: [params._splat], wt: [], commits: [] } });
  },
});

const worktreeRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wt/$',
  beforeLoad: ({ params }) => {
    // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
    throw redirect({ to: '/review', search: { wt: [params._splat], file: [], commits: [] } });
  },
});

const routeTree = rootRoute.addChildren([
  reviewRoute,
  indexRoute,
  fileRedirectRoute,
  worktreeRedirectRoute,
]);

export const router = createRouter({ routeTree, parseSearch, stringifySearch });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
