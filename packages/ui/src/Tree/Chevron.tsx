import { clsx } from 'clsx';
import type { ComponentProps } from 'react';
import { Button } from 'react-aria-components';

import styles from './Tree.module.css';

export const Chevron = ({
  className,
  children = '▸',
  ...props
}: ComponentProps<typeof Button>) => (
  <Button slot="chevron" className={clsx(styles.chevron, className)} {...props}>
    {children}
  </Button>
);
