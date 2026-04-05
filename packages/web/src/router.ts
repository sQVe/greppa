import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

import { App } from './App';

const rootRoute = createRootRoute({ component: App });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
});

const fileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/file/$',
});

const worktreeFileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wt/$',
});

const routeTree = rootRoute.addChildren([indexRoute, fileRoute, worktreeFileRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
