// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileFilterBar } from './FileFilterBar';

afterEach(() => {
  cleanup();
});

describe('FileFilterBar', () => {
  it('renders an empty search input when query is empty', () => {
    render(<FileFilterBar query="" setQuery={vi.fn()} reset={vi.fn()} />);

    const input = screen.getByRole('searchbox', { name: /filter files/i }) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('calls setQuery as the user types', async () => {
    const setQuery = vi.fn();
    render(<FileFilterBar query="" setQuery={setQuery} reset={vi.fn()} />);

    const input = screen.getByRole('searchbox', { name: /filter files/i });
    await userEvent.type(input, 'a');

    expect(setQuery).toHaveBeenCalledWith('a');
  });

  it('hides the clear button while query is empty', () => {
    render(<FileFilterBar query="" setQuery={vi.fn()} reset={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull();
  });

  it('shows the clear button when query is non-empty and calls reset on click', async () => {
    const reset = vi.fn();
    render(<FileFilterBar query="foo" setQuery={vi.fn()} reset={reset} />);

    const button = screen.getByRole('button', { name: /clear search/i });
    await userEvent.click(button);

    expect(reset).toHaveBeenCalled();
  });
});
