// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './Badge';

afterEach(() => {
  cleanup();
});

describe('Badge', () => {
  it('renders children as label text', () => {
    render(<Badge variant="added">Added</Badge>);
    expect(screen.getByText('Added')).toBeDefined();
  });

  it('applies variant class for added', () => {
    render(<Badge variant="added">A</Badge>);
    expect(screen.getByText('A').className).toContain('added');
  });

  it('applies variant class for deleted', () => {
    render(<Badge variant="deleted">D</Badge>);
    expect(screen.getByText('D').className).toContain('deleted');
  });

  it('applies variant class for modified', () => {
    render(<Badge variant="modified">M</Badge>);
    expect(screen.getByText('M').className).toContain('modified');
  });

  it('applies variant class for renamed', () => {
    render(<Badge variant="renamed">R</Badge>);
    expect(screen.getByText('R').className).toContain('renamed');
  });

  it('applies base badge styles', () => {
    render(<Badge variant="added">A</Badge>);
    expect(screen.getByText('A').className).toContain('badge');
  });

  it('merges consumer className with internal styles', () => {
    render(
      <Badge variant="added" className="custom">
        A
      </Badge>,
    );

    const element = screen.getByText('A');
    expect(element.className).toContain('badge');
    expect(element.className).toContain('custom');
  });
});
