import { clsx } from 'clsx';
import type { ComponentProps } from 'react';
import {
  Button,
  Collection,
  composeRenderProps,
  Tree as RACTree,
  TreeItem,
  TreeItemContent,
} from 'react-aria-components';

import styles from './Tree.module.css';

const Root = ({ className, ...props }: ComponentProps<typeof RACTree>) => (
  <RACTree
    {...props}
    className={composeRenderProps(className, (resolved) =>
      clsx(styles.root, resolved),
    )}
  />
);

const Item = ({ className, ...props }: ComponentProps<typeof TreeItem>) => (
  <TreeItem
    {...props}
    className={composeRenderProps(className, (resolved) =>
      clsx(styles.item, resolved),
    )}
  />
);

const Chevron = ({
  className,
  children = '▸',
  ...props
}: Omit<ComponentProps<typeof Button>, 'slot'>) => (
  <Button
    {...props}
    slot="chevron"
    className={composeRenderProps(className, (resolved) =>
      clsx(styles.chevron, resolved),
    )}
  >
    {children}
  </Button>
);

const Indent = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={clsx(styles.indent, className)} {...props} aria-hidden="true" />
);

const Label = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={clsx(styles.label, className)} {...props} />
);

export const Tree = {
  Root,
  Item,
  ItemContent: TreeItemContent,
  Chevron,
  Indent,
  Label,
  Collection,
};
