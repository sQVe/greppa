import * as RadixTabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

import styles from './Tabs.module.css';

export const Trigger = ({ className, ...props }: ComponentProps<typeof RadixTabs.Trigger>) => (
  <RadixTabs.Trigger className={clsx(styles.trigger, className)} {...props} />
);
