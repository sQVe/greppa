// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatusBar } from './StatusBar';

afterEach(() => {
  cleanup();
});

describe('StatusBar', () => {
  it('renders the reviewed file count', () => {
    render(<StatusBar reviewedCount={2} totalCount={5} />);
    expect(screen.getByText('2/5 files reviewed')).toBeDefined();
  });

  it('renders as a footer element', () => {
    const { container } = render(<StatusBar reviewedCount={0} totalCount={0} />);
    expect(container.querySelector('footer')).not.toBeNull();
  });
});
