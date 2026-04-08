import type { CommitEntry } from '@greppa/core';

import styles from './CommitList.module.css';

interface CommitListProps {
  commits: CommitEntry[];
  selectedShas: Set<string>;
  onSelectCommit: (sha: string, modifiers: { shiftKey: boolean; metaKey: boolean }) => void;
}

const formatRelativeTime = (iso: string): string => {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

export const CommitList = ({ commits, selectedShas, onSelectCommit }: CommitListProps) => (
  <div className={styles.list}>
    {commits.map((commit) => (
      <button
        key={commit.sha}
        type="button"
        className={styles.item}
        data-selected={selectedShas.has(commit.sha)}
        onClick={(event) => {
          onSelectCommit(commit.sha, {
            shiftKey: event.shiftKey,
            metaKey: event.metaKey || event.ctrlKey,
          });
        }}
      >
        <span className={styles.subject}>{commit.subject}</span>
        <span className={styles.meta}>
          <span className={styles.hash}>{commit.abbrevSha}</span>
          <span className={styles.time}>{formatRelativeTime(commit.date)}</span>
        </span>
      </button>
    ))}
  </div>
);
