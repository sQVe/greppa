import * as Tabs from '@radix-ui/react-tabs';

import type { CommentThread, FileInfo } from '../fixtures/types';

import styles from './DetailPanel.module.css';

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

interface CommentsContentProps {
  threads: CommentThread[];
}

const CommentsContent = ({ threads }: CommentsContentProps) => {
  if (threads.length === 0) {
    return <div className={styles.emptyTab}>No comments on this file</div>;
  }

  return (
    <>
      {threads.map((thread) => (
        <div key={thread.id} className={styles.thread}>
          <div className={styles.threadHeader}>
            <span>Line {thread.lineNumber}</span>
            {thread.resolved ? <span>Resolved</span> : null}
          </div>
          {thread.comments.map((comment) => (
            <div key={comment.id} className={styles.comment}>
              <div className={styles.commentHeader}>
                <span className={styles.author}>{comment.author}</span>
                <span className={styles.timestamp}>
                  {formatDate(comment.timestamp)} {formatTime(comment.timestamp)}
                </span>
              </div>
              <div className={styles.body}>{comment.body}</div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
};

interface FileInfoContentProps {
  fileInfo: FileInfo | null;
}

const FileInfoContent = ({ fileInfo }: FileInfoContentProps) => {
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

interface DetailPanelProps {
  threads: CommentThread[];
  fileInfo: FileInfo | null;
}

export const DetailPanel = ({ threads, fileInfo }: DetailPanelProps) => {
  if (threads.length === 0 && fileInfo == null) {
    return <div className={styles.empty}>Select a file to view details</div>;
  }

  return (
    <Tabs.Root defaultValue="comments" className={styles.panel}>
      <Tabs.List className={styles.tabList}>
        <Tabs.Trigger value="comments" className={styles.tab}>
          Comments
        </Tabs.Trigger>
        <Tabs.Trigger value="file-info" className={styles.tab}>
          File Info
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="comments" className={styles.tabContent}>
        <CommentsContent threads={threads} />
      </Tabs.Content>
      <Tabs.Content value="file-info" className={styles.tabContent}>
        <FileInfoContent fileInfo={fileInfo} />
      </Tabs.Content>
    </Tabs.Root>
  );
};
