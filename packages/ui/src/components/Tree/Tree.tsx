import { clsx } from 'clsx';
import type { ComponentProps } from 'react';
import {
  Button,
  Collection,
  Tree as RACTree,
  TreeItem,
  TreeItemContent,
} from 'react-aria-components';

import styles from './Tree.module.css';

const Root = ({ className, ...props }: ComponentProps<typeof RACTree>) => (
  <RACTree className={clsx(styles.root, className)} {...props} />
);

const Item = ({ className, ...props }: ComponentProps<typeof TreeItem>) => (
  <TreeItem className={clsx(styles.item, className)} {...props} />
);

const Chevron = ({
  className,
  children = '▸',
  ...props
}: ComponentProps<typeof Button>) => (
  <Button slot="chevron" className={clsx(styles.chevron, className)} {...props}>
    {children}
  </Button>
);

const Label = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={clsx(styles.label, className)} {...props} />
);

export const Tree = {
  Root,
  Item,
  ItemContent: TreeItemContent,
  Chevron,
  Label,
  Collection,
};
