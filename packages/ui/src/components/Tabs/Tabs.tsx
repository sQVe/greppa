import * as RadixTabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

import styles from './Tabs.module.css';

const List = ({ className, ...props }: ComponentProps<typeof RadixTabs.List>) => (
  <RadixTabs.List className={clsx(styles.list, className)} {...props} />
);

const Trigger = ({ className, ...props }: ComponentProps<typeof RadixTabs.Trigger>) => (
  <RadixTabs.Trigger className={clsx(styles.trigger, className)} {...props} />
);

const Content = ({ className, ...props }: ComponentProps<typeof RadixTabs.Content>) => (
  <RadixTabs.Content className={clsx(styles.content, className)} {...props} />
);

export const Tabs = {
  Root: RadixTabs.Root,
  List,
  Trigger,
  Content,
};
