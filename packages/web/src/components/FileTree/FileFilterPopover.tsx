import { Popover } from '@greppa/ui';
import type { ReactNode } from 'react';

import type { ChangeType } from '../../fixtures/types';
import type { ReviewedStatus } from '../../hooks/useFileFilter';

import styles from './FileFilterPopover.module.css';

interface ExtensionRow {
  extension: string;
  count: number;
}

interface ChangeTypeRow {
  type: ChangeType;
  count: number;
}

interface StatusRow {
  status: ReviewedStatus;
  count: number;
}

interface FileFilterPopoverProps {
  extensions: ExtensionRow[];
  changeTypes: ChangeTypeRow[];
  statuses: StatusRow[];
  selectedExtensions: ReadonlySet<string>;
  selectedChangeTypes: ReadonlySet<ChangeType>;
  selectedStatuses: ReadonlySet<ReviewedStatus>;
  onToggleExtension: (extension: string) => void;
  onToggleChangeType: (type: ChangeType) => void;
  onToggleStatus: (status: ReviewedStatus) => void;
  children: ReactNode;
}

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
};

const STATUS_LABELS: Record<ReviewedStatus, string> = {
  reviewed: 'Reviewed',
  unreviewed: 'Unreviewed',
};

const renderRow = (
  key: string,
  label: string,
  count: number,
  checked: boolean,
  onToggle: () => void,
) => (
  <button
    key={key}
    type="button"
    role="checkbox"
    aria-checked={checked}
    className={styles.row}
    onClick={onToggle}
  >
    <span className={styles.rowLabel}>{label}</span>
    <span className={styles.rowCount}>{count}</span>
  </button>
);

export const FileFilterPopover = ({
  extensions,
  changeTypes,
  statuses,
  selectedExtensions,
  selectedChangeTypes,
  selectedStatuses,
  onToggleExtension,
  onToggleChangeType,
  onToggleStatus,
  children,
}: FileFilterPopoverProps) => (
  <Popover.Root>
    <Popover.Trigger asChild>{children}</Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className={styles.content} side="bottom" align="end" sideOffset={4}>
        <div className={styles.group}>
          <div className={styles.groupTitle}>Extensions</div>
          {extensions.length === 0 ? (
            <div className={styles.empty}>No extensions</div>
          ) : (
            extensions.map((row) =>
              renderRow(
                row.extension,
                row.extension,
                row.count,
                selectedExtensions.has(row.extension),
                () => {
                  onToggleExtension(row.extension);
                },
              ),
            )
          )}
        </div>
        <div className={styles.group}>
          <div className={styles.groupTitle}>Change types</div>
          {changeTypes.map((row) =>
            renderRow(
              row.type,
              CHANGE_TYPE_LABELS[row.type],
              row.count,
              selectedChangeTypes.has(row.type),
              () => {
                onToggleChangeType(row.type);
              },
            ),
          )}
        </div>
        <div className={styles.group}>
          <div className={styles.groupTitle}>Status</div>
          {statuses.map((row) =>
            renderRow(
              row.status,
              STATUS_LABELS[row.status],
              row.count,
              selectedStatuses.has(row.status),
              () => {
                onToggleStatus(row.status);
              },
            ),
          )}
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
);
