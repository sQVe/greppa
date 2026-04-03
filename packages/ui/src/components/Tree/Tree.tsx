import { IconChevronRight } from '@tabler/icons-react';
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

const Item = ({
  className,
  selected,
  ...props
}: ComponentProps<typeof TreeItem> & { selected?: boolean }) => (
  <TreeItem
    {...props}
    className={composeRenderProps(className, (resolved) =>
      clsx(styles.item, selected && styles.selected, resolved),
    )}
  />
);

const Chevron = ({
  className,
  children = <IconChevronRight size={10} stroke={2.5} />,
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
