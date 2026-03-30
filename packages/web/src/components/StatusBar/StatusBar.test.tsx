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

  describe('file metadata', () => {
    it('renders language when provided', () => {
      render(<StatusBar reviewedCount={0} totalCount={0} language="TypeScript" />);
      expect(screen.getByText('TypeScript')).toBeDefined();
    });

    it('renders encoding when provided', () => {
      render(<StatusBar reviewedCount={0} totalCount={0} encoding="UTF-8" />);
      expect(screen.getByText('UTF-8')).toBeDefined();
    });

    it('renders both language and encoding together', () => {
      render(
        <StatusBar reviewedCount={0} totalCount={0} language="TypeScript" encoding="UTF-8" />,
      );
      expect(screen.getByText('TypeScript')).toBeDefined();
      expect(screen.getByText('UTF-8')).toBeDefined();
    });

    it('does not render metadata section when neither is provided', () => {
      const { container } = render(<StatusBar reviewedCount={0} totalCount={0} />);
      expect(container.querySelector('[class*="metadata"]')).toBeNull();
    });
  });
});
