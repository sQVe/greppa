import type { ChangeEvent } from 'react';

import { isTheme, THEMES, usePreferences } from '../../hooks/usePreferences';

import styles from './Header.module.css';

export const Header = () => {
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
