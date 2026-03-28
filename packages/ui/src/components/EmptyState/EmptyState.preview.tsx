import type { CSSProperties } from 'react';

import { EmptyState } from './EmptyState';

const container: CSSProperties = {
  height: '200px',
  border: '1px dashed var(--gr-color-border-muted)',
  borderRadius: 'var(--gr-radius-md)',
};

const EmptyStatePreview = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    <div style={container}>
      <EmptyState>Select a file to view diff</EmptyState>
    </div>

    <div style={container}>
      <EmptyState>No changes to display</EmptyState>
    </div>
  </div>
);

export default EmptyStatePreview;
