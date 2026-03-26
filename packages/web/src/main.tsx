import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
// oxlint-disable-next-line no-unassigned-import
import '@greppa/ui';

const root = document.getElementById('root');
if (root == null) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
