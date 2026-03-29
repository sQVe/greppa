import styles from './StatusBar.module.css';

interface StatusBarProps {
  reviewedCount: number;
  totalCount: number;
  language?: string | null;
  encoding?: string | null;
}

export const StatusBar = ({ reviewedCount, totalCount, language, encoding }: StatusBarProps) => (
  <footer className={styles.statusBar}>
    <span className={styles.progress}>
      {reviewedCount}/{totalCount} files reviewed
    </span>
    {language != null || encoding != null ? (
      <span className={styles.metadata}>
        {language != null ? <span>{language}</span> : null}
        {encoding != null ? <span>{encoding}</span> : null}
      </span>
    ) : null}
  </footer>
);
