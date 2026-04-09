// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FileIcon } from './FileIcon';

afterEach(() => {
  cleanup();
});

describe('FileIcon', () => {
  it('renders an img for a file', () => {
    const { container } = render(<FileIcon name="index.ts" baseUrl="/material-icons" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/material-icons/typescript.svg');
  });

  it('renders a closed folder icon for a directory', () => {
    const { container } = render(<FileIcon name="src" isDirectory baseUrl="/material-icons" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/material-icons/folder-src.svg');
  });

  it('renders an open folder icon when expanded', () => {
    const { container } = render(
      <FileIcon name="src" isDirectory isExpanded baseUrl="/material-icons" />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/material-icons/folder-src-open.svg');
  });

  it('renders a generic folder icon for unknown directories', () => {
    const { container } = render(<FileIcon name="mydir" isDirectory baseUrl="/material-icons" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/material-icons/folder.svg');
  });

  it('renders aria-hidden on the img', () => {
    const { container } = render(<FileIcon name="index.ts" baseUrl="/material-icons" />);
    const img = container.querySelector('img');
    expect(img!.getAttribute('aria-hidden')).toBe('true');
  });

  it('honors a custom baseUrl so the package is not tied to one hosting layout', () => {
    const { container } = render(<FileIcon name="index.ts" baseUrl="/assets/icons" />);
    const img = container.querySelector('img');
    expect(img!.getAttribute('src')).toBe('/assets/icons/typescript.svg');
  });
});
