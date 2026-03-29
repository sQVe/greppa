import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// oxlint-disable-next-line no-unassigned-import
import './reset.css';
// oxlint-disable-next-line no-unassigned-import
import '../src/tokens.css';
import { App } from './App';

const root = document.getElementById('root');
if (root == null) {
  throw new Error('Missing #root mount element');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
