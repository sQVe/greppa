// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatusBar } from './StatusBar';

import styles from './StatusBar.module.css';

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('StatusBar', () => {
  it('renders as a footer element', () => {
    const { container } = render(
      <StatusBar mode="file-review" reviewedCount={0} totalCount={0} />,
    );
    expect(container.querySelector('footer')).not.toBeNull();
  });

  describe('file-review mode', () => {
    it('renders file count', () => {
      render(<StatusBar mode="file-review" reviewedCount={7} totalCount={12} />);
      expect(screen.getByText('12 files')).toBeDefined();
    });

    it('renders reviewed count with percentage', () => {
      render(<StatusBar mode="file-review" reviewedCount={7} totalCount={12} />);
      expect(screen.getByText('7 / 12')).toBeDefined();
      expect(screen.getByText('58%')).toBeDefined();
    });

    it('renders progress bar', () => {
      const { container } = render(
        <StatusBar mode="file-review" reviewedCount={7} totalCount={12} />,
      );
      const fill = container.querySelector(`.${styles.progressFill}`);
      expect(fill).not.toBeNull();
    });

    it('renders comment count when greater than zero', () => {
      render(
        <StatusBar mode="file-review" reviewedCount={7} totalCount={12} commentCount={3} />,
      );
      expect(screen.getByText('3 comments')).toBeDefined();
    });

    it('renders zero comments in muted state', () => {
      render(
        <StatusBar mode="file-review" reviewedCount={7} totalCount={12} commentCount={0} />,
      );
      expect(screen.getByText('0 comments')).toBeDefined();
    });

    it('renders Space and Tab keyboard hints', () => {
      render(<StatusBar mode="file-review" reviewedCount={7} totalCount={12} />);
      expect(screen.getByText('Space')).toBeDefined();
      expect(screen.getByText('Tab')).toBeDefined();
    });

    it('renders the X / Y visible segment when filter is active', () => {
      render(
        <StatusBar
          mode="file-review"
          reviewedCount={7}
          totalCount={12}
          visible={{ matched: 3, total: 12 }}
        />,
      );
      expect(screen.getByText('3 / 12 visible')).toBeDefined();
    });

    it('omits the visible segment when not supplied', () => {
      render(<StatusBar mode="file-review" reviewedCount={7} totalCount={12} />);
      expect(screen.queryByText(/visible/i)).toBeNull();
    });
  });

  describe('commit-review mode', () => {
    it('renders commit SHA', () => {
      render(
        <StatusBar mode="commit-review" commitSha="a3f8e21" reviewedCount={0} totalCount={4} />,
      );
      expect(screen.getByText('a3f8e21')).toBeDefined();
    });

    it('renders reviewed count', () => {
      render(
        <StatusBar mode="commit-review" commitSha="a3f8e21" reviewedCount={0} totalCount={4} />,
      );
      expect(screen.getByText('0 / 4')).toBeDefined();
    });
  });

  describe('working-tree mode', () => {
    it('renders working tree label', () => {
      render(<StatusBar mode="working-tree" modifiedCount={4} />);
      expect(screen.getByText('working tree')).toBeDefined();
    });

    it('renders modified count', () => {
      render(<StatusBar mode="working-tree" modifiedCount={4} />);
      expect(screen.getByText('4 modified')).toBeDefined();
    });

    it('renders the X / Y visible segment when filter is active', () => {
      render(
        <StatusBar
          mode="working-tree"
          modifiedCount={4}
          visible={{ matched: 2, total: 4 }}
        />,
      );
      expect(screen.getByText('2 / 4 visible')).toBeDefined();
    });

    it('omits the visible segment when not supplied', () => {
      render(<StatusBar mode="working-tree" modifiedCount={4} />);
      expect(screen.queryByText(/visible/i)).toBeNull();
    });
  });

  describe('review-complete mode', () => {
    it('renders all-reviewed count', () => {
      render(<StatusBar mode="review-complete" reviewedCount={12} totalCount={12} />);
      expect(screen.getByText('12 / 12')).toBeDefined();
    });

    it('renders full progress bar', () => {
      const { container } = render(
        <StatusBar mode="review-complete" reviewedCount={12} totalCount={12} />,
      );
      const fill = container.querySelector(`.${styles.progressFill}`);
      expect(fill).not.toBeNull();
    });

    it('renders Enter keyboard hint', () => {
      render(<StatusBar mode="review-complete" reviewedCount={12} totalCount={12} />);
      expect(screen.getByText('Enter')).toBeDefined();
    });
  });

  describe('composer-open mode', () => {
    it('renders reviewed count and comment count', () => {
      render(
        <StatusBar mode="composer-open" reviewedCount={7} totalCount={12} commentCount={3} />,
      );
      expect(screen.getByText('7 / 12')).toBeDefined();
      expect(screen.getByText('3 comments')).toBeDefined();
    });

    it('renders platform-aware modifier and Esc keyboard hints', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh)');
      render(
        <StatusBar mode="composer-open" reviewedCount={7} totalCount={12} commentCount={3} />,
      );
      expect(screen.getByText(/Cmd/)).toBeDefined();
      expect(screen.getByText(/\+Enter/)).toBeDefined();
      expect(screen.getByText('Esc')).toBeDefined();
    });
  });
});
