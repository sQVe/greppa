import type { CommentThread } from '../../fixtures/types';
import { formatDate, formatTime } from './formatDate';

import styles from './DetailPanel.module.css';

interface CommentsContentProps {
  threads: CommentThread[];
}

export const CommentsContent = ({ threads }: CommentsContentProps) => {
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
