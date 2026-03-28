import { clsx } from 'clsx';
import type { ComponentProps } from 'react';
import { Tree } from 'react-aria-components';

import styles from './Tree.module.css';

export const Root = ({ className, ...props }: ComponentProps<typeof Tree>) => (
  <Tree className={clsx(styles.root, className)} {...props} />
);
