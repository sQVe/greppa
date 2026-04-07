const ATTR = 'data-token-styles';
const knownColors = new Set<string>();

const getStyleElement = (): HTMLStyleElement => {
  let element = document.querySelector<HTMLStyleElement>(`style[${ATTR}]`);

  if (element == null) {
    element = document.createElement('style');
    element.setAttribute(ATTR, '');
    document.head.appendChild(element);
  }

  return element;
};

export const getTokenColorClass = (color: string | undefined): string | undefined => {
  if (color == null) {
    return undefined;
  }

  if (knownColors.has(color)) {
    return `tk-${color.slice(1)}`;
  }

  const className = `tk-${color.slice(1)}`;
  knownColors.add(color);
  getStyleElement().textContent += `.${className} { color: ${color}; }\n`;

  return className;
};

export const clearTokenStyles = () => {
  const element = document.querySelector(`style[${ATTR}]`);
  element?.remove();
  knownColors.clear();
};
