import { Tabs } from '@greppa/ui';

import type { CommentThread, FileInfo } from '../../fixtures/types';
import { CommentsContent } from './CommentsContent';
import { FileInfoContent } from './FileInfoContent';

import styles from './DetailPanel.module.css';

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
      <Tabs.List>
        <Tabs.Trigger value="comments">Comments</Tabs.Trigger>
        <Tabs.Trigger value="file-info">File Info</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="comments">
        <CommentsContent threads={threads} />
      </Tabs.Content>
      <Tabs.Content value="file-info">
        <FileInfoContent fileInfo={fileInfo} />
      </Tabs.Content>
    </Tabs.Root>
  );
};
