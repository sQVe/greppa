// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

vi.mock('shiki', () => ({
  createHighlighter: () => Promise.resolve(null),
}));

vi.mock('./hooks/useTheme', () => ({
  isTheme: (value: string) => ['catppuccin-mocha', 'catppuccin-latte'].includes(value),
  useTheme: () => ({
    theme: 'catppuccin-mocha' as const,
    setTheme: vi.fn(),
    themes: ['catppuccin-mocha', 'catppuccin-latte'] as const,
  }),
}));

afterEach(() => {
  cleanup();
});

describe('App', () => {
  it('renders the header with logo', () => {
    render(<App />);
    expect(screen.getByText('Greppa')).toBeDefined();
  });

  it('renders the status bar with fixture review counts', () => {
    render(<App />);
    expect(screen.getByText('2/7 files reviewed')).toBeDefined();
  });

  it('renders the file tree', () => {
    render(<App />);
    expect(screen.getByRole('treegrid', { name: 'File tree' })).toBeDefined();
  });

  it('renders the diff viewer placeholder', () => {
    render(<App />);
    expect(screen.getByText('Select a file to view diff')).toBeDefined();
  });

  it('renders the detail panel placeholder', () => {
    render(<App />);
    expect(screen.getByText('Select a file to view details')).toBeDefined();
  });

  it('increments reviewed count when selecting an unreviewed file', async () => {
    render(<App />);
    expect(screen.getByText('2/7 files reviewed')).toBeDefined();
    await userEvent.click(screen.getByText('rateLimiter.ts'));
    expect(screen.getByText('3/7 files reviewed')).toBeDefined();
  });

  it('does not increment when selecting an already-reviewed file', async () => {
    render(<App />);
    await userEvent.click(screen.getByText('validateToken.ts'));
    expect(screen.getByText('2/7 files reviewed')).toBeDefined();
  });
});
