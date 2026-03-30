import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';

import { router } from './router';

// oxlint-disable-next-line no-unassigned-import
import './reset.css';
// oxlint-disable-next-line no-unassigned-import
import '@greppa/ui';

const root = document.getElementById('root');
if (root == null) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
