import type { ReactNode } from 'react';

import type { ChangeType } from '../../fixtures/types';
import type { ReviewedStatus } from '../../hooks/useFileFilter';
import { FileFilterBar } from './FileFilterBar';

import styles from './FileTreePanel.module.css';

export interface SectionFilter {
  query: string;
  isActive: boolean;
  setQuery: (query: string) => void;
  reset: () => void;
  visibleCount: number;
  totalCount: number;
  extensions: { extension: string; count: number }[];
  changeTypes: { type: ChangeType; count: number }[];
  statuses: { status: ReviewedStatus; count: number }[];
  selectedExtensions: ReadonlySet<string>;
  selectedChangeTypes: ReadonlySet<ChangeType>;
  selectedStatuses: ReadonlySet<ReviewedStatus>;
  onToggleExtension: (extension: string) => void;
  onToggleChangeType: (type: ChangeType) => void;
  onToggleStatus: (status: ReviewedStatus) => void;
}

interface FilteredTreeSectionProps {
  filter?: SectionFilter;
  children: ReactNode;
}

const renderBar = (filter: SectionFilter) => {
  const handleToggleExtension = (extension: string) => {
    filter.onToggleExtension(extension);
  };
  const handleToggleChangeType = (type: ChangeType) => {
    filter.onToggleChangeType(type);
  };
  const handleToggleStatus = (status: ReviewedStatus) => {
    filter.onToggleStatus(status);
  };
  return (
    <FileFilterBar
      query={filter.query}
      setQuery={filter.setQuery}
      reset={filter.reset}
      extensions={filter.extensions}
      changeTypes={filter.changeTypes}
      statuses={filter.statuses}
      selectedExtensions={filter.selectedExtensions}
      selectedChangeTypes={filter.selectedChangeTypes}
      selectedStatuses={filter.selectedStatuses}
      onToggleExtension={handleToggleExtension}
      onToggleChangeType={handleToggleChangeType}
      onToggleStatus={handleToggleStatus}
    />
  );
};

const renderEmpty = (reset: () => void) => (
  <div className={styles.emptyFilter}>
    <p className={styles.emptyFilterText}>No files match.</p>
    <button type="button" className={styles.emptyFilterButton} onClick={reset}>
      Clear filter
    </button>
  </div>
);

export const FilteredTreeSection = ({ filter, children }: FilteredTreeSectionProps) => {
  if (filter == null) {
    return children;
  }

  const isEmpty = filter.isActive && filter.visibleCount === 0;
  return (
    <>
      {renderBar(filter)}
      {isEmpty ? renderEmpty(filter.reset) : children}
    </>
  );
};
