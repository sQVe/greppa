import { IconX } from '@tabler/icons-react';
import type { ChangeEvent } from 'react';

import styles from './FileFilterBar.module.css';

interface FileFilterBarProps {
  query: string;
  setQuery: (query: string) => void;
  reset: () => void;
}

export const FileFilterBar = ({ query, setQuery, reset }: FileFilterBarProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

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
      {query.length > 0 && (
        <button type="button" aria-label="Clear search" className={styles.clear} onClick={reset}>
          <IconX size={14} stroke={2} />
        </button>
      )}
    </div>
  );
};
