import * as RadixTabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

import styles from './Tabs.module.css';

export const Content = ({ className, ...props }: ComponentProps<typeof RadixTabs.Content>) => (
  <RadixTabs.Content className={clsx(styles.content, className)} {...props} />
);
