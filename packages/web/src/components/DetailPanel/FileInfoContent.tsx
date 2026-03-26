import type { FileInfo } from '../../fixtures/types';
import { formatDate } from './formatDate';

import styles from './DetailPanel.module.css';

interface FileInfoContentProps {
  fileInfo: FileInfo | null;
}

export const FileInfoContent = ({ fileInfo }: FileInfoContentProps) => {
  if (fileInfo == null) {
    return <div className={styles.emptyTab}>No file info available</div>;
  }

  return (
    <>
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>Last modified</span>
        <span className={styles.infoValue}>{formatDate(fileInfo.lastModified)}</span>
      </div>
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>Change frequency</span>
        <span className={styles.infoValue}>{fileInfo.changeFrequency}</span>
      </div>
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>Authors</span>
        <span className={styles.infoValue}>
          {fileInfo.authors.map((author) => (
            <div key={author}>{author}</div>
          ))}
        </span>
      </div>
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>Related PRs</span>
        <span className={`${styles.infoValue} ${styles.prList}`}>
          {fileInfo.relatedPRs.map((pr) => (
            <span key={pr}>#{pr}</span>
          ))}
        </span>
      </div>
    </>
  );
};
