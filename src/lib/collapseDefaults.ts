import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { GraphTree } from './graphTree';
import type { useCollapse } from './collapse';

/**
 * Whole-graph collapse controls and the D0 decisions (task C3).
 *
 * - Graphs with more than OPEN_COLLAPSED_ABOVE drawn nodes open collapsed,
 *   showing the center and OPEN_COLLAPSED_LEVELS rings around it.
 * - Collapse state is remembered per graph in the browser. A saved state wins
 *   over the default, so a graph reopens the way it was left.
 * - "Collapse to center" leaves the center and its direct neighbors; "Expand all" opens everything.
 */

export const OPEN_COLLAPSED_ABOVE = 50;
export const OPEN_COLLAPSED_LEVELS = 2;

const storageKey = (graphId: string) => `smartpath:collapsed:${graphId}`;

/** Nodes at this depth. Collapsing them leaves the center and `depth` rings visible. */
export function idsAtDepth(tree: GraphTree, depth: number): string[] {
  return tree.order.filter(id => tree.nodes.get(id)!.depth === depth);
}

/** The collapsed ids saved for a graph, or null if nothing was saved (or storage is unavailable) */
export function loadCollapsed(graphId: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(graphId));
    if (raw === null) return null;
    const ids: unknown = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

export function saveCollapsed(graphId: string, collapsedIds: Iterable<string>): void {
  try {
    localStorage.setItem(storageKey(graphId), JSON.stringify([...collapsedIds]));
  } catch {
    // Storage full or blocked: the graph still works, it just won't be remembered
  }
}

/** What a graph opens with: its saved state if there is one, otherwise the D0 default */
export function initialCollapsed(tree: GraphTree, drawnCount: number, saved: string[] | null): string[] {
  if (saved) return saved;
  return drawnCount > OPEN_COLLAPSED_ABOVE ? idsAtDepth(tree, OPEN_COLLAPSED_LEVELS) : [];
}

type Collapse = Pick<ReturnType<typeof useCollapse>, 'collapsedIds' | 'setCollapsed'>;

/**
 * Applies the opening collapse state each time a new graph loads, saves every change after that,
 * and returns the two whole-graph actions for the bottom-right controls.
 */
export function useCollapseDefaults(collapse: Collapse, tree: GraphTree, drawnCount: number, graphId?: string) {
  const { collapsedIds, setCollapsed } = collapse;
  const openedTree = useRef<GraphTree | null>(null);

  // Before the first paint, so a large graph never flashes fully expanded
  useLayoutEffect(() => {
    if (drawnCount === 0 || openedTree.current === tree) return;
    openedTree.current = tree;
    setCollapsed(initialCollapsed(tree, drawnCount, graphId ? loadCollapsed(graphId) : null));
  }, [tree, drawnCount, graphId, setCollapsed]);

  // Only save once this graph has been opened, so one graph's state never lands under another graph's id
  useEffect(() => {
    if (!graphId || openedTree.current !== tree) return;
    saveCollapsed(graphId, collapsedIds);
  }, [graphId, tree, collapsedIds]);

  const collapseToCenter = useCallback(() => setCollapsed(idsAtDepth(tree, 1)), [tree, setCollapsed]);
  const expandAll = useCallback(() => setCollapsed([]), [setCollapsed]);

  return { collapseToCenter, expandAll };
}
