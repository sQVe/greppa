import { useState } from 'react';
import type { ComponentType } from 'react';

import styles from './App.module.css';

const themes = ['catppuccin-latte', 'catppuccin-mocha'] as const;

const previewModules = import.meta.glob<{ default: ComponentType }>(
  '../src/**/*.preview.tsx',
  { eager: true },
);

const previews = Object.entries(previewModules).map(([path, mod]) => {
  const match = path.match(/\/([^/]+)\.preview\.tsx$/);
  return { name: match?.[1] ?? path, Component: mod.default };
});

const getInitialTheme = () =>
  document.documentElement.dataset['theme'] ?? 'catppuccin-mocha';

export const App = () => {
  const [theme, setTheme] = useState(getInitialTheme);
  const [selected, setSelected] = useState(previews[0]?.name ?? null);

  const activePreview = previews.find((p) => p.name === selected);

  const handleThemeChange = (value: string) => {
    setTheme(value);
    document.documentElement.dataset['theme'] = value;
    localStorage.setItem('gr-theme', value);
  };

  return (
    <div className={styles['layout']}>
      <header className={styles['toolbar']}>
        <span className={styles['logo']}>Greppa UI</span>
        <select
          aria-label="Theme"
          className={styles['themePicker']}
          value={theme}
          onChange={(event) =>{  handleThemeChange(event.target.value); }}
        >
          {themes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </header>

      <nav className={styles['sidebar']}>
        {previews.map((p) => (
          <button
            type="button"
            key={p.name}
            className={`${styles['sidebarButton']} ${p.name === selected ? styles['sidebarButtonActive'] : ''}`}
            onClick={() =>{  setSelected(p.name); }}
          >
            {p.name}
          </button>
        ))}
      </nav>

      <main className={styles['preview']}>
        {activePreview != null ? <activePreview.Component /> : null}
      </main>
    </div>
  );
};
