// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Tabs } from '.';
import type { List } from './List';

const renderTabs = (
  props?: Partial<Parameters<typeof List>[0]> & { children?: ReactNode },
) => {
  const { children, ...listProps } = props ?? {};
  render(
    <Tabs.Root defaultValue="one">
      <Tabs.List {...listProps}>
        <Tabs.Trigger value="one">First</Tabs.Trigger>
        <Tabs.Trigger value="two">Second</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="one">Content one</Tabs.Content>
      <Tabs.Content value="two">Content two</Tabs.Content>
      {children}
    </Tabs.Root>,
  );
};

afterEach(() => {
  cleanup();
});

describe('Tabs', () => {
  it('renders a tablist with triggers', () => {
    renderTabs();

    expect(screen.getByRole('tablist')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'First' })).toBeDefined();
  });

  it('renders tab content for the default value', () => {
    renderTabs();
    expect(screen.getByText('Content one')).toBeDefined();
  });

  it('switches content on trigger click', async () => {
    renderTabs();

    await userEvent.click(screen.getByRole('tab', { name: 'Second' }));
    expect(screen.getByText('Content two')).toBeDefined();
  });

  it('applies internal styles to List', () => {
    renderTabs();
    expect(screen.getByRole('tablist').className).toContain('list');
  });

  it('merges consumer className with internal styles on List', () => {
    renderTabs({ className: 'custom-list' });

    const tablist = screen.getByRole('tablist');
    expect(tablist.className).toContain('list');
    expect(tablist.className).toContain('custom-list');
  });

  it('applies internal styles to Trigger', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: 'First' }).className).toContain('trigger');
  });

  it('applies internal styles to Content', () => {
    renderTabs();
    expect(screen.getByRole('tabpanel').className).toContain('content');
  });
});
