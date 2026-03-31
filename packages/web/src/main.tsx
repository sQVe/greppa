import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// oxlint-disable-next-line no-unassigned-import
import './reset.css';
// oxlint-disable-next-line no-unassigned-import
import '@greppa/ui';

import { router } from './router';

const queryClient = new QueryClient();

const root = document.getElementById('root');
if (root == null) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
