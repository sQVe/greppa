import { EmptyState } from './EmptyState';

const EmptyStatePreview = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    <div style={{ height: '200px', border: '1px dashed var(--gr-color-border-muted)', borderRadius: 'var(--gr-radius-md)' }}>
      <EmptyState>Select a file to view diff</EmptyState>
    </div>

    <div style={{ height: '200px', border: '1px dashed var(--gr-color-border-muted)', borderRadius: 'var(--gr-radius-md)' }}>
      <EmptyState>No changes to display</EmptyState>
    </div>
  </div>
);

export default EmptyStatePreview;
