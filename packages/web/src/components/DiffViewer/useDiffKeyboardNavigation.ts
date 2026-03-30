import { useEffect, useRef } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';

import type { VirtualItem } from './buildVirtualItems';
import type { NavigationAction } from './findNavigationTarget';
import { findNavigationTarget } from './findNavigationTarget';

const KEY_TO_ACTION: Record<string, NavigationAction> = {
  j: 'nextHunk',
  k: 'prevHunk',
  n: 'nextChange',
  p: 'prevChange',
};

interface UseDiffKeyboardNavigationOptions {
  items: VirtualItem[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}

export const useDiffKeyboardNavigation = ({
  items,
  virtualizer,
}: UseDiffKeyboardNavigationOptions) => {
  const currentIndexRef = useRef(0);

  useEffect(() => {
    currentIndexRef.current = 0;
  }, [items]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const action = KEY_TO_ACTION[event.key];
      if (action == null) {
        return;
      }

      const target = findNavigationTarget({ items, currentIndex: currentIndexRef.current, action });
      if (target == null) {
        return;
      }

      currentIndexRef.current = target;
      virtualizer.scrollToIndex(target, { align: 'start' });
    };

    document.addEventListener('keydown', handleKeyDown);
    return () =>{  document.removeEventListener('keydown', handleKeyDown); };
  }, [items, virtualizer]);
};
