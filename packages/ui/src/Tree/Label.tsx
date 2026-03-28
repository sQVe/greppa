import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

import styles from './Tree.module.css';

export const Label = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={clsx(styles.label, className)} {...props} />
);
