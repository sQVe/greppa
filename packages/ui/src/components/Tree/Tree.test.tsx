// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Tree } from './Tree';

const renderTree = (rootProps?: Partial<Parameters<typeof Tree.Root>[0]>) =>
  render(
    <Tree.Root aria-label="Files" {...rootProps}>
      <Tree.Collection items={[{ id: '1', name: 'file.ts' }]}>
        {(item) => (
          <Tree.Item key={item.id} id={item.id} textValue={item.name}>
            <Tree.ItemContent>
              <Tree.Chevron />
              <Tree.Label>{item.name}</Tree.Label>
            </Tree.ItemContent>
          </Tree.Item>
        )}
      </Tree.Collection>
    </Tree.Root>,
  );

afterEach(() => {
  cleanup();
});

describe('Tree', () => {
  it('renders a treegrid with aria label', () => {
    renderTree();
    expect(screen.getByRole('treegrid', { name: 'Files' })).toBeDefined();
  });

  it('applies internal styles to Root', () => {
    renderTree();
    expect(screen.getByRole('treegrid').className).toContain('root');
  });

  it('applies internal styles to Item', () => {
    renderTree();
    const row = screen.getByRole('row');
    expect(row.className).toContain('item');
  });

  it('renders Chevron with default character', () => {
    renderTree();
    expect(screen.getByText('▸')).toBeDefined();
  });

  it('applies internal styles to Label', () => {
    renderTree();
    expect(screen.getByText('file.ts').className).toContain('label');
  });

  it('merges consumer className on Root', () => {
    renderTree({ className: 'custom-tree' });
    const tree = screen.getByRole('treegrid');
    expect(tree.className).toContain('root');
    expect(tree.className).toContain('custom-tree');
  });
});
