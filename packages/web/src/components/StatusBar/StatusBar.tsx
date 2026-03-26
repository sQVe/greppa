import styles from './StatusBar.module.css';

interface StatusBarProps {
  reviewedCount: number;
  totalCount: number;
}

export const StatusBar = ({ reviewedCount, totalCount }: StatusBarProps) => (
  <footer className={styles.statusBar}>
    <span className={styles.progress}>
      {reviewedCount}/{totalCount} files reviewed
    </span>
  </footer>
);
