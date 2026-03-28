import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

import styles from './Badge.module.css';

type BadgeVariant = 'added' | 'deleted' | 'modified' | 'renamed';

interface BadgeProps extends ComponentProps<'span'> {
  variant: BadgeVariant;
}

export type { BadgeVariant };

export const Badge = ({ variant, className, ...props }: BadgeProps) => (
  <span className={clsx(styles.badge, styles[variant], className)} {...props} />
);
