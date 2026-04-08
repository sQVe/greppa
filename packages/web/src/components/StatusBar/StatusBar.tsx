import styles from './StatusBar.module.css';

type StatusBarMode = 'file-review' | 'commit-review' | 'working-tree' | 'review-complete' | 'composer-open';

interface FileReviewProps {
  mode: 'file-review';
  reviewedCount: number;
  totalCount: number;
  commentCount?: number;
}

interface CommitReviewProps {
  mode: 'commit-review';
  commitSha?: string;
  reviewedCount: number;
  totalCount: number;
}

interface WorkingTreeProps {
  mode: 'working-tree';
  modifiedCount: number;
}

interface ReviewCompleteProps {
  mode: 'review-complete';
  reviewedCount: number;
  totalCount: number;
}

interface ComposerOpenProps {
  mode: 'composer-open';
  reviewedCount: number;
  totalCount: number;
  commentCount?: number;
}

type StatusBarProps =
  | FileReviewProps
  | CommitReviewProps
  | WorkingTreeProps
  | ReviewCompleteProps
  | ComposerOpenProps;

const getModifierKey = () =>
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.userAgent) ? 'Cmd' : 'Ctrl';

const renderProgressBar = (reviewed: number, total: number) => {
  const percent = total > 0 ? (reviewed / total) * 100 : 0;
  return (
    <div className={styles.progressBar}>
      <div className={styles.progressFill} style={{ width: `${percent}%` }} />
    </div>
  );
};

const renderReviewed = (reviewed: number, total: number) => {
  const percent = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  return (
    <div className={`${styles.segment} ${styles.reviewed}`}>
      {reviewed} / {total}
      {renderProgressBar(reviewed, total)}
      <span className={styles.percent}>{percent}%</span>
    </div>
  );
};

const renderComments = (count: number) => (
  <div className={`${styles.segment} ${count > 0 ? styles.commentCount : styles.commentZero}`}>
    {count} comments
  </div>
);

const renderLeftSegments = (props: StatusBarProps) => {
  switch (props.mode) {
    case 'file-review':
      return (
        <>
          <div className={styles.segment}>{props.totalCount} files</div>
          {renderReviewed(props.reviewedCount, props.totalCount)}
          {renderComments(props.commentCount ?? 0)}
        </>
      );
    case 'commit-review':
      return (
        <>
          {props.commitSha != null && (
            <div className={`${styles.segment} ${styles.interactive}`}>{props.commitSha}</div>
          )}
          {renderReviewed(props.reviewedCount, props.totalCount)}
        </>
      );
    case 'working-tree':
      return (
        <>
          <div className={`${styles.segment} ${styles.warning}`}>working tree</div>
          <div className={styles.segment}>{props.modifiedCount} modified</div>
        </>
      );
    case 'review-complete':
      return (
        <>
          <div className={styles.segment}>{props.totalCount} files</div>
          {renderReviewed(props.reviewedCount, props.totalCount)}
        </>
      );
    case 'composer-open':
      return (
        <>
          {renderReviewed(props.reviewedCount, props.totalCount)}
          {renderComments(props.commentCount ?? 0)}
        </>
      );
  }
};

const renderRightSegments = (mode: StatusBarMode) => {
  switch (mode) {
    case 'file-review':
    case 'commit-review':
      return (
        <div className={styles.segment}>
          <kbd className={styles.kbd}>Space</kbd> reviewed
          <kbd className={styles.kbd}>Tab</kbd> next file
        </div>
      );
    case 'working-tree':
      return (
        <div className={styles.segment}>
          <kbd className={styles.kbd}>Tab</kbd> next file
        </div>
      );
    case 'review-complete':
      return (
        <div className={styles.segment}>
          <kbd className={styles.kbd}>Enter</kbd> submit
        </div>
      );
    case 'composer-open':
      return (
        <div className={styles.segment}>
          <kbd className={styles.kbd}>{getModifierKey()}+Enter</kbd> submit <kbd className={styles.kbd}>Esc</kbd> cancel
        </div>
      );
  }
};

export const StatusBar = (props: StatusBarProps) => (
  <footer className={styles.statusBar}>
    {renderLeftSegments(props)}
    <div className={styles.spacer} />
    {renderRightSegments(props.mode)}
  </footer>
);

export type { StatusBarProps, StatusBarMode };
