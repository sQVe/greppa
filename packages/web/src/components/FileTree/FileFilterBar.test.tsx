// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChangeType } from '../../fixtures/types';
import { FileFilterBar } from './FileFilterBar';

const baseProps = {
  query: '',
  setQuery: vi.fn(),
  reset: vi.fn(),
  extensions: [
    { extension: 'ts', count: 3 },
    { extension: 'md', count: 1 },
  ],
  changeTypes: [
    { type: 'added' as ChangeType, count: 2 },
    { type: 'modified' as ChangeType, count: 1 },
    { type: 'deleted' as ChangeType, count: 0 },
    { type: 'renamed' as ChangeType, count: 0 },
  ],
  statuses: [
    { status: 'reviewed' as const, count: 1 },
    { status: 'unreviewed' as const, count: 4 },
  ],
  selectedExtensions: new Set<string>(),
  selectedChangeTypes: new Set<ChangeType>(),
  selectedStatuses: new Set<'reviewed' | 'unreviewed'>(),
  onToggleExtension: vi.fn(),
  onToggleChangeType: vi.fn(),
  onToggleStatus: vi.fn(),
};

const renderBar = (overrides: Partial<typeof baseProps> = {}) =>
  render(<FileFilterBar {...baseProps} {...overrides} />);

afterEach(() => {
  cleanup();
});

describe('FileFilterBar', () => {
  it('renders an empty search input when query is empty', () => {
    renderBar();

    const input = screen.getByRole('searchbox', { name: /filter files/i }) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('calls setQuery as the user types', async () => {
    const setQuery = vi.fn();
    renderBar({ setQuery });

    const input = screen.getByRole('searchbox', { name: /filter files/i });
    await userEvent.type(input, 'a');

    expect(setQuery).toHaveBeenCalledWith('a');
  });

  it('hides the clear button while query is empty', () => {
    renderBar();

    expect(screen.queryByRole('button', { name: /clear filter/i })).toBeNull();
  });

  it('shows the clear button when query is non-empty and calls reset on click', async () => {
    const reset = vi.fn();
    renderBar({ query: 'foo', reset });

    const button = screen.getByRole('button', { name: /clear filter/i });
    await userEvent.click(button);

    expect(reset).toHaveBeenCalled();
  });

  it('shows the clear button when only popover facets are active', () => {
    renderBar({ selectedExtensions: new Set(['ts']) });

    expect(screen.queryByRole('button', { name: /clear filter/i })).not.toBeNull();
  });

  it('renders a funnel trigger button', () => {
    renderBar();

    expect(screen.queryByRole('button', { name: /facet filters/i })).not.toBeNull();
  });

  it('opens the popover when the funnel trigger is clicked', async () => {
    renderBar();

    await userEvent.click(screen.getByRole('button', { name: /facet filters/i }));

    expect(screen.queryByText('Extensions')).not.toBeNull();
    expect(screen.queryByText('Change types')).not.toBeNull();
    expect(screen.queryByText('Status')).not.toBeNull();
  });

  it('forwards extension toggles from the popover', async () => {
    const onToggleExtension = vi.fn();
    renderBar({ onToggleExtension });

    await userEvent.click(screen.getByRole('button', { name: /facet filters/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /^ts/i }));

    expect(onToggleExtension).toHaveBeenCalledWith('ts');
  });
});
