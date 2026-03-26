import type { ChangeEvent } from 'react';

import { isTheme, useTheme } from '../../hooks/useTheme';

import styles from './Header.module.css';

export const Header = () => {
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
      <select className={styles.themePicker} value={theme} onChange={handleChange}>
        {themes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </header>
  );
};
