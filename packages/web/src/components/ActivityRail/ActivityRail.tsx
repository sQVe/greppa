import { IconFile, IconSettings } from '@tabler/icons-react';
import * as Popover from '@radix-ui/react-popover';

import { THEMES, usePreferences } from '../../hooks/usePreferences';

import styles from './ActivityRail.module.css';

interface ActivityRailProps {
  isFileTreeExpanded: boolean;
  onToggleFileTree: () => void;
}

export const ActivityRail = ({ isFileTreeExpanded, onToggleFileTree }: ActivityRailProps) => {
  const { state, set } = usePreferences();

  return (
    <nav className={styles.rail} data-testid="activity-rail">
      <div className={styles.top}>
        <button
          type="button"
          className={styles.iconButton}
          data-active={isFileTreeExpanded}
          aria-label="Files"
          onClick={onToggleFileTree}
        >
          <IconFile size={15} stroke={1.5} />
        </button>
      </div>
      <div className={styles.bottom}>
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Settings"
            >
              <IconSettings size={15} stroke={1.5} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className={styles.popoverContent} side="right" align="end" sideOffset={4}>
              {THEMES.map((theme) => (
                <button
                  type="button"
                  key={theme}
                  className={styles.themeOption}
                  data-active={state.theme === theme}
                  onClick={() => { set({ theme }); }}
                >
                  {theme}
                </button>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </nav>
  );
};
