// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Header } from './Header';

const mockSet = vi.fn();

vi.mock('../../hooks/usePreferences', () => ({
  isTheme: (value: string) => ['catppuccin-mocha', 'catppuccin-latte'].includes(value),
  THEMES: ['catppuccin-mocha', 'catppuccin-latte'] as const,
  usePreferences: () => ({
    state: { theme: 'catppuccin-mocha' as const },
    set: mockSet,
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
    expect(mockSet).toHaveBeenCalledWith({ theme: 'catppuccin-latte' });
  });

  describe('file info', () => {
    it('renders file path when filePath is provided', () => {
      render(<Header filePath="src/auth/validateToken.ts" changeType="modified" />);
      expect(screen.getByText('src/auth/validateToken.ts')).toBeDefined();
    });

    it('renders change type badge when changeType is provided', () => {
      render(<Header filePath="src/auth/validateToken.ts" changeType="modified" />);
      expect(screen.getByText('Modified')).toBeDefined();
    });

    it('renders old path for renamed files', () => {
      render(
        <Header filePath="src/new.ts" oldPath="src/old.ts" changeType="renamed" />,
      );
      expect(screen.getByText('src/new.ts')).toBeDefined();
      expect(screen.getByText('← src/old.ts')).toBeDefined();
    });

    it('does not render file info when no props are provided', () => {
      const { container } = render(<Header />);
      expect(container.querySelector('[class*="fileInfo"]')).toBeNull();
    });

    it('does not render file info when changeType is provided without filePath', () => {
      const { container } = render(<Header changeType="modified" />);
      expect(container.querySelector('[class*="fileInfo"]')).toBeNull();
    });
  });
});
