// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Header } from './Header';

const mockSetTheme = vi.fn();

vi.mock('../../hooks/useTheme', () => ({
  isTheme: (value: string) => ['catppuccin-mocha', 'catppuccin-latte'].includes(value),
  useTheme: () => ({
    theme: 'catppuccin-mocha' as const,
    setTheme: mockSetTheme,
    themes: ['catppuccin-mocha', 'catppuccin-latte'] as const,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Header', () => {
  it('renders the logo text', () => {
    render(<Header />);
    expect(screen.getByText('Greppa')).toBeDefined();
  });

  it('renders a theme picker with all themes as options', () => {
    render(<Header />);
    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0]?.textContent).toBe('catppuccin-mocha');
    expect(options[1]?.textContent).toBe('catppuccin-latte');
  });

  it('shows the current theme as selected', () => {
    render(<Header />);
    const select = screen.getByRole<HTMLSelectElement>('combobox');
    expect(select.value).toBe('catppuccin-mocha');
  });

  it('calls setTheme when selection changes', async () => {
    render(<Header />);
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'catppuccin-latte');
    expect(mockSetTheme).toHaveBeenCalledWith('catppuccin-latte');
  });
});
