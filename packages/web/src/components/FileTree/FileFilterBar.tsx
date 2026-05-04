import { IconFilter, IconX } from '@tabler/icons-react';
import type { ChangeEvent } from 'react';

import type { ChangeType } from '../../fixtures/types';
import type { ReviewedStatus } from '../../hooks/useFileFilter';
import { FileFilterPopover } from './FileFilterPopover';

import styles from './FileFilterBar.module.css';

interface FileFilterBarProps {
  query: string;
  setQuery: (query: string) => void;
  reset: () => void;
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

export const FileFilterBar = ({
  query,
  setQuery,
  reset,
  extensions,
  changeTypes,
  statuses,
  selectedExtensions,
  selectedChangeTypes,
  selectedStatuses,
  onToggleExtension,
  onToggleChangeType,
  onToggleStatus,
}: FileFilterBarProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const popoverActive =
    selectedExtensions.size + selectedChangeTypes.size + selectedStatuses.size > 0;
  const facetActive = query.length > 0 || popoverActive;

  return (
    <div className={styles.bar}>
      <input
        type="search"
        aria-label="Filter files"
        className={styles.input}
        placeholder="Filter files…"
        value={query}
        onChange={handleChange}
      />
      <FileFilterPopover
        extensions={extensions}
        changeTypes={changeTypes}
        statuses={statuses}
        selectedExtensions={selectedExtensions}
        selectedChangeTypes={selectedChangeTypes}
        selectedStatuses={selectedStatuses}
        onToggleExtension={onToggleExtension}
        onToggleChangeType={onToggleChangeType}
        onToggleStatus={onToggleStatus}
      >
        <button
          type="button"
          aria-label="Facet filters"
          aria-pressed={popoverActive}
          className={styles.funnel}
        >
          <IconFilter size={14} stroke={2} />
        </button>
      </FileFilterPopover>
      {facetActive && (
        <button type="button" aria-label="Clear filter" className={styles.clear} onClick={reset}>
          <IconX size={14} stroke={2} />
        </button>
      )}
    </div>
  );
};
