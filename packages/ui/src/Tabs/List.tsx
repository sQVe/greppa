import * as RadixTabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

import styles from './Tabs.module.css';

export const List = ({ className, ...props }: ComponentProps<typeof RadixTabs.List>) => (
  <RadixTabs.List className={clsx(styles.list, className)} {...props} />
);
