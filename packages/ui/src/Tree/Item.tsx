import { clsx } from 'clsx';
import type { ComponentProps } from 'react';
import { TreeItem } from 'react-aria-components';

import styles from './Tree.module.css';

export const Item = ({ className, ...props }: ComponentProps<typeof TreeItem>) => (
  <TreeItem className={clsx(styles.item, className)} {...props} />
);
