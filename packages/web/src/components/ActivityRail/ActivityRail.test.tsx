// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityRail } from './ActivityRail';

vi.mock('../../hooks/usePreferences', () => ({
  isTheme: (value: string) => ['catppuccin-mocha', 'catppuccin-latte'].includes(value),
  THEMES: ['catppuccin-mocha', 'catppuccin-latte'] as const,
  usePreferences: () => ({
    state: { theme: 'catppuccin-mocha' as const },
    set: mockSetPreferences,
  }),
}));

const mockSetPreferences = vi.fn();

beforeEach(() => {
  mockSetPreferences.mockClear();
});

afterEach(() => {
  cleanup();
});

const defaultProps = {
  isFileTreeExpanded: true,
  onToggleFileTree: vi.fn(),
};

describe('ActivityRail', () => {
  it('renders as a nav element', () => {
    const { container } = render(<ActivityRail {...defaultProps} />);
    expect(container.querySelector('nav')).not.toBeNull();
  });

  it('renders the files icon button', () => {
    render(<ActivityRail {...defaultProps} />);
    expect(screen.getByRole('button', { name: /files/i })).toBeDefined();
  });

  it('renders the settings icon button', () => {
    render(<ActivityRail {...defaultProps} />);
    expect(screen.getByRole('button', { name: /settings/i })).toBeDefined();
  });

  describe('files icon', () => {
    it('calls onToggleFileTree when clicked', async () => {
      const onToggleFileTree = vi.fn();
      render(<ActivityRail {...defaultProps} onToggleFileTree={onToggleFileTree} />);
      await userEvent.click(screen.getByRole('button', { name: /files/i }));
      expect(onToggleFileTree).toHaveBeenCalledOnce();
    });

    it('shows active state when file tree is expanded', () => {
      render(<ActivityRail {...defaultProps} isFileTreeExpanded />);
      const button = screen.getByRole('button', { name: /files/i });
      expect(button.getAttribute('data-active')).toBe('true');
    });

    it('shows inactive state when file tree is collapsed', () => {
      render(<ActivityRail {...defaultProps} isFileTreeExpanded={false} />);
      const button = screen.getByRole('button', { name: /files/i });
      expect(button.getAttribute('data-active')).toBe('false');
    });
  });

  describe('settings popover', () => {
    it('opens theme popover when settings icon is clicked', async () => {
      render(<ActivityRail {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', { name: /settings/i }));
      expect(screen.getByText('catppuccin-mocha')).toBeDefined();
      expect(screen.getByText('catppuccin-latte')).toBeDefined();
    });

    it('applies selected theme', async () => {
      render(<ActivityRail {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', { name: /settings/i }));
      await userEvent.click(screen.getByText('catppuccin-latte'));
      expect(mockSetPreferences).toHaveBeenCalledWith({ theme: 'catppuccin-latte' });
    });
  });
});
