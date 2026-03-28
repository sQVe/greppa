// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { EmptyState } from '.';

afterEach(() => {
  cleanup();
});

describe('EmptyState', () => {
  it('renders children as message text', () => {
    render(<EmptyState>No files found</EmptyState>);
    expect(screen.getByText('No files found')).toBeDefined();
  });

  it('applies internal styles', () => {
    render(<EmptyState>Empty</EmptyState>);
    expect(screen.getByText('Empty').className).toContain('emptyState');
  });

  it('merges consumer className with internal styles', () => {
    render(<EmptyState className="custom">Empty</EmptyState>);

    const element = screen.getByText('Empty');
    expect(element.className).toContain('emptyState');
    expect(element.className).toContain('custom');
  });
});
