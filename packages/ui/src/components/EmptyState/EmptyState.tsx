import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

import styles from './EmptyState.module.css';

export const EmptyState = ({ className, ...props }: ComponentProps<'div'>) => (
  <div className={clsx(styles.emptyState, className)} {...props} />
);
