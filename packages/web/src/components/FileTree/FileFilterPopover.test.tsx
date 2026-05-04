// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileFilterPopover } from './FileFilterPopover';

const baseProps = {
  extensions: [
    { extension: 'ts', count: 3 },
    { extension: 'md', count: 1 },
  ],
  changeTypes: [
    { type: 'added' as const, count: 2 },
    { type: 'modified' as const, count: 1 },
    { type: 'deleted' as const, count: 0 },
    { type: 'renamed' as const, count: 0 },
  ],
  statuses: [
    { status: 'reviewed' as const, count: 1 },
    { status: 'unreviewed' as const, count: 4 },
  ],
  selectedExtensions: new Set<string>(),
  selectedChangeTypes: new Set<'added' | 'modified' | 'deleted' | 'renamed'>(),
  selectedStatuses: new Set<'reviewed' | 'unreviewed'>(),
  onToggleExtension: vi.fn(),
  onToggleChangeType: vi.fn(),
  onToggleStatus: vi.fn(),
};

afterEach(() => {
  cleanup();
});

const renderPopover = (overrides: Partial<typeof baseProps> = {}) => {
  const props = { ...baseProps, ...overrides };
  return render(
    <FileFilterPopover {...props}>
      <button type="button">Open filters</button>
    </FileFilterPopover>,
  );
};

describe('FileFilterPopover', () => {
  it('renders the trigger but no group content until opened', () => {
    renderPopover();

    expect(screen.queryByRole('button', { name: /open filters/i })).not.toBeNull();
    expect(screen.queryByText('Extensions')).toBeNull();
  });

  it('opens the popover and renders all three groups with counts', async () => {
    renderPopover();

    await userEvent.click(screen.getByRole('button', { name: /open filters/i }));

    expect(screen.queryByText('Extensions')).not.toBeNull();
    expect(screen.queryByText('Change types')).not.toBeNull();
    expect(screen.queryByText('Status')).not.toBeNull();
    expect(screen.queryByRole('checkbox', { name: /^ts/i })).not.toBeNull();
    expect(screen.queryByRole('checkbox', { name: /added/i })).not.toBeNull();
    expect(screen.queryByRole('checkbox', { name: /^reviewed/i })).not.toBeNull();
  });

  it('shows aria-checked=true for selected facets', async () => {
    renderPopover({
      selectedExtensions: new Set(['ts']),
      selectedChangeTypes: new Set(['added']),
      selectedStatuses: new Set(['reviewed']),
    });

    await userEvent.click(screen.getByRole('button', { name: /open filters/i }));

    expect(screen.getByRole('checkbox', { name: /^ts/i }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('checkbox', { name: /added/i }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('checkbox', { name: /^reviewed/i }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('checkbox', { name: /^md/i }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('invokes onToggleExtension when an extension row is clicked', async () => {
    const onToggleExtension = vi.fn();
    renderPopover({ onToggleExtension });

    await userEvent.click(screen.getByRole('button', { name: /open filters/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /^ts/i }));

    expect(onToggleExtension).toHaveBeenCalledWith('ts');
  });

  it('invokes onToggleChangeType when a change-type row is clicked', async () => {
    const onToggleChangeType = vi.fn();
    renderPopover({ onToggleChangeType });

    await userEvent.click(screen.getByRole('button', { name: /open filters/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /modified/i }));

    expect(onToggleChangeType).toHaveBeenCalledWith('modified');
  });

  it('invokes onToggleStatus when a status row is clicked', async () => {
    const onToggleStatus = vi.fn();
    renderPopover({ onToggleStatus });

    await userEvent.click(screen.getByRole('button', { name: /open filters/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /^unreviewed/i }));

    expect(onToggleStatus).toHaveBeenCalledWith('unreviewed');
  });

  it('renders an empty-state row when extensions is empty', async () => {
    renderPopover({ extensions: [] });

    await userEvent.click(screen.getByRole('button', { name: /open filters/i }));

    expect(screen.queryByText(/no extensions/i)).not.toBeNull();
  });
});
