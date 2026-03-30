import type { ChangeEvent } from 'react';

import { Badge } from '@greppa/ui';

import type { ChangeType } from '../../fixtures/types';
import { isTheme, useTheme } from '../../hooks/useTheme';

import styles from './Header.module.css';

interface HeaderProps {
  filePath?: string | null;
  oldPath?: string | null;
  changeType?: ChangeType | null;
}

const CHANGE_LABELS: Record<ChangeType, string> = {
  added: 'Added',
  deleted: 'Deleted',
  modified: 'Modified',
  renamed: 'Renamed',
};

export const Header = ({ filePath, oldPath, changeType }: HeaderProps) => {
  const { theme, setTheme, themes } = useTheme();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (isTheme(value)) {
      setTheme(value);
    }
  };

  return (
    <header className={styles.header}>
      <span className={styles.logo}>Greppa</span>
      {filePath != null && changeType != null ? (
        <span className={styles.fileInfo}>
          <Badge variant={changeType}>{CHANGE_LABELS[changeType]}</Badge>
          <span className={styles.filePath}>{filePath}</span>
          {oldPath != null ? <span className={styles.oldPath}>← {oldPath}</span> : null}
        </span>
      ) : null}
      <select
        aria-label="Theme"
        className={styles.themePicker}
        value={theme}
        onChange={handleChange}
      >
        {themes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </header>
  );
};
