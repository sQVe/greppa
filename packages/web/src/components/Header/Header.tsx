import type { ChangeEvent } from 'react';

import { Badge } from '@greppa/ui';

import type { ChangeType } from '../../fixtures/types';
import { isTheme, THEMES, usePreferences } from '../../hooks/usePreferences';

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
  const { state, set } = usePreferences();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (isTheme(value)) {
      set({ theme: value });
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
        value={state.theme}
        onChange={handleChange}
      >
        {THEMES.map((themeOption) => (
          <option key={themeOption} value={themeOption}>
            {themeOption}
          </option>
        ))}
      </select>
    </header>
  );
};
