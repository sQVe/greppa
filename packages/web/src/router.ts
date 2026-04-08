import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { zodValidator, fallback } from '@tanstack/zod-adapter';
import { z } from 'zod';

import { App } from './App';
import type { StatePayload } from './stateCache';
import { cacheState, stateCache } from './stateCache';

const changesSearch = z.object({
  s: fallback(z.string(), '').default(''),
  file: fallback(z.array(z.string()), []).default([]),
});

const worktreeSearch = z.object({
  s: fallback(z.string(), '').default(''),
  wt: fallback(z.array(z.string()), []).default([]),
});

const commitsSearch = z.object({
  s: fallback(z.string(), '').default(''),
  commits: fallback(z.array(z.string()), []).default([]),
});

const reviewSearch = z.object({
  s: fallback(z.string(), '').default(''),
});

export const parseSearch = (searchString: string): Record<string, unknown> => {
  const params = new URLSearchParams(
    searchString.startsWith('?') ? searchString.slice(1) : searchString,
  );
  const s = params.get('s');
  if (s != null) {
    const cached = stateCache.get(s);
    if (cached != null) {
      return { s, ...cached };
    }
    return { s };
  }
  const result: Record<string, string[]> = {};
  for (const key of params.keys()) {
    result[key] ??= params.getAll(key);
  }
  return result;
};

export const stringifySearch = (search: Record<string, unknown>): string => {
  if ('s' in search && typeof search.s === 'string' && search.s.length > 0) {
    return `?s=${search.s}`;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (key === 's') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item));
      }
    }
  }
  const str = params.toString().replaceAll('%2F', '/');
  return str ? `?${str}` : '';
};

const resolveState = async (s: string): Promise<StatePayload | null> => {
  if (!s) {
    return null;
  }
  const cached = stateCache.get(s);
  if (cached != null) {
    return cached;
  }
  const response = await fetch(`/api/state/${encodeURIComponent(s)}`);
  if (!response.ok) {
    return null;
  }
  // oxlint-disable-next-line no-unsafe-type-assertion -- JSON response matches API schema
  const state = (await response.json()) as StatePayload;
  cacheState(s, state);
  return state;
};

const sectionForState = (state: StatePayload): '/changes' | '/worktree' | '/commits' => {
  if (state.commits.length > 0) {
    return '/commits';
  }
  if (state.wt.length > 0) {
    return '/worktree';
  }
  return '/changes';
};

const rootRoute = createRootRoute({ component: App });

const changesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/changes',
  validateSearch: zodValidator(changesSearch),
  beforeLoad: async ({ search }) => {
    if (!search.s || search.file.length > 0) {
      return;
    }
    const state = await resolveState(search.s);
    if (state == null) {
      return;
    }
    const target = sectionForState(state);
    if (target !== '/changes') {
      // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
      throw redirect({ to: target, search: { s: search.s, ...state } });
    }
    // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
    throw redirect({ to: '/changes', search: { s: search.s, file: state.file } });
  },
});

const worktreeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/worktree',
  validateSearch: zodValidator(worktreeSearch),
  beforeLoad: async ({ search }) => {
    if (!search.s || search.wt.length > 0) {
      return;
    }
    const state = await resolveState(search.s);
    if (state == null) {
      return;
    }
    const target = sectionForState(state);
    if (target !== '/worktree') {
      // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
      throw redirect({ to: target, search: { s: search.s, ...state } });
    }
    // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
    throw redirect({ to: '/worktree', search: { s: search.s, wt: state.wt } });
  },
});

const commitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/commits',
  validateSearch: zodValidator(commitsSearch),
  beforeLoad: async ({ search }) => {
    if (!search.s || search.commits.length > 0) {
      return;
    }
    const state = await resolveState(search.s);
    if (state == null) {
      return;
    }
    const target = sectionForState(state);
    if (target !== '/commits') {
      // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
      throw redirect({ to: target, search: { s: search.s, ...state } });
    }
    // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
    throw redirect({ to: '/commits', search: { s: search.s, commits: state.commits } });
  },
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review',
  validateSearch: zodValidator(reviewSearch),
  beforeLoad: async ({ search }) => {
    if (!search.s) {
      // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
      throw redirect({ to: '/changes' });
    }
    const state = await resolveState(search.s);
    if (state == null) {
      // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
      throw redirect({ to: '/changes' });
    }
    const target = sectionForState(state);
    // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
    throw redirect({ to: target, search: { s: search.s, ...state } });
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
    throw redirect({ to: '/changes' });
  },
});

const fileRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/file/$',
  beforeLoad: ({ params }) => {
    // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
    throw redirect({ to: '/changes', search: { file: [params._splat], s: '' } });
  },
});

const worktreeRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wt/$',
  beforeLoad: ({ params }) => {
    // eslint-disable-next-line only-throw-error -- TanStack Router redirect API
    throw redirect({ to: '/worktree', search: { wt: [params._splat], s: '' } });
  },
});

const routeTree = rootRoute.addChildren([
  changesRoute,
  worktreeRoute,
  commitsRoute,
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
