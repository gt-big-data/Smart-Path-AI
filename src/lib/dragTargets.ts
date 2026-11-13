import type { DragEvent } from 'react';

/**
 * True when a dragleave really took the pointer out of the element.
 * Moving onto a child element also fires dragleave on the parent, which made drop highlights flicker,
 * so the pointer position is checked against the element's box instead.
 */
export function isLeavingDropTarget(event: DragEvent<HTMLElement>): boolean {
  const rect = event.currentTarget.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  return x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom;
}
