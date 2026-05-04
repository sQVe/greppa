import type { ChangeType, FileNode } from '../../fixtures/types';
import type { ReviewedStatus } from '../../hooks/useFileFilter';
import { FileFilterBar } from './FileFilterBar';
import { FileTree } from './FileTree';

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
  files: FileNode[];
  selectedPaths: Set<string>;
  expandedKeys: Iterable<string>;
  reviewedPaths?: ReadonlySet<string>;
  onSelectFile: (path: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => void;
  onSelectDirectory: (path: string) => void;
  onExpandedKeysChange: (keys: Set<string | number>) => void;
  onCollapseDirectory?: (path: string) => void;
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

export const FilteredTreeSection = (props: FilteredTreeSectionProps) => {
  const { filter, ...treeProps } = props;
  const tree = <FileTree {...treeProps} />;

  if (filter == null) {
    return tree;
  }

  const body = filter.isActive && filter.visibleCount === 0 ? renderEmpty(filter.reset) : tree;

  return (
    <>
      {renderBar(filter)}
      {body}
    </>
  );
};
