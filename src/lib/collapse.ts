import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ancestorsOf, GraphTree } from './graphTree';

/**
 * Expand and collapse state for the graph view (task C1).
 *
 * Collapsing a node hides its whole subtree in the tree from the center.
 * The collapsed node itself stays visible and reports how many nodes it hides.
 * Nothing here moves a node: hiding is done with React Flow's hidden flag,
 * applied in applyGraphStyles, so positions stay where the layout put them.
 *
 * `drawn` is the set of node ids the graph view actually renders. The tree can
 * hold nodes the view leaves out (unconnected nodes with only a type for a label);
 * those are never counted. Without it, every tree node counts.
 */

export interface CollapseLayer {
  /** Nodes inside a collapsed branch. Collapsed nodes themselves are not in it unless a parent branch is also collapsed. */
  hiddenIds: Set<string>;
  /** How many drawn nodes each collapsed node hides */
  hiddenCounts: Map<string, number>;
}

const NO_IDS: ReadonlySet<string> = new Set();

/** How many drawn nodes are below nodeId in the tree. 0 for leaves and unknown ids. */
export function countBelow(tree: GraphTree, nodeId: string, drawn?: ReadonlySet<string>): number {
  let count = 0;
  const stack = [...(tree.nodes.get(nodeId)?.children ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (!drawn || drawn.has(id)) count++;
    stack.push(...tree.nodes.get(id)!.children);
  }
  return count;
}

/** Which nodes the collapsed set hides, and how many drawn nodes each collapsed node hides */
export function collapseLayer(tree: GraphTree, collapsedIds: ReadonlySet<string>, drawn?: ReadonlySet<string>): CollapseLayer {
  const hiddenIds = new Set<string>();
  const hiddenCounts = new Map<string, number>();

  // A node with nothing drawn below it has nothing to hide
  for (const id of collapsedIds) {
    const count = countBelow(tree, id, drawn);
    if (count > 0) hiddenCounts.set(id, count);
  }
  if (hiddenCounts.size === 0) return { hiddenIds, hiddenCounts };

  // Parents come before children in tree.order, so one pass reaches every node under a collapsed one
  for (const id of tree.order) {
    const parentId = tree.nodes.get(id)!.parentId;
    if (parentId !== null && (hiddenCounts.has(parentId) || hiddenIds.has(parentId))) hiddenIds.add(id);
  }

  return { hiddenIds, hiddenCounts };
}

/** The collapsed set with every ancestor of nodeId opened. Returns the same set if none was collapsed. */
export function expandTo(tree: GraphTree, collapsedIds: ReadonlySet<string>, nodeId: string): ReadonlySet<string> {
  const closed = ancestorsOf(tree, nodeId).filter(id => collapsedIds.has(id));
  if (closed.length === 0) return collapsedIds;

  const next = new Set(collapsedIds);
  closed.forEach(id => next.delete(id));
  return next;
}

/**
 * Collapsed node ids for the graph on screen. A newly loaded graph opens fully expanded;
 * confidence updates, edits and search don't touch it.
 *
 * - toggleCollapsed: collapse or expand one node (the C2 badge)
 * - setCollapsed: replace the whole set (C3 controls, P2b Focus and Clear)
 * - expandTo: open every collapsed ancestor of a node (P2b, P3)
 *
 * The three actions never change identity and always act on the graph currently shown,
 * so they are safe to hand to memoized node components.
 */
export function useCollapse(tree: GraphTree, drawnNodes?: readonly { id: string }[]) {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(NO_IDS);

  // A new graph starts fully expanded (React's "adjust state when a prop changes" pattern)
  const [shownTree, setShownTree] = useState(tree);
  if (shownTree !== tree) {
    setShownTree(tree);
    setCollapsedIds(NO_IDS);
  }

  // Tree ids are always strings
  const drawn = useMemo(() => (drawnNodes ? new Set(drawnNodes.map(node => String(node.id))) : undefined), [drawnNodes]);

  // Read by the actions, so they never act on an earlier graph
  const latest = useRef({ tree, drawn });
  useLayoutEffect(() => {
    latest.current = { tree, drawn };
  });

  // Each action reads the graph once, when it is called, so React can rerun the updater safely
  const toggleCollapsed = useCallback((nodeId: string) => {
    const { tree: current, drawn: shown } = latest.current;
    const canCollapse = countBelow(current, nodeId, shown) > 0;
    setCollapsedIds(ids => {
      if (ids.has(nodeId)) {
        const next = new Set(ids);
        next.delete(nodeId);
        return next;
      }
      return canCollapse ? new Set(ids).add(nodeId) : ids;
    });
  }, []);

  const setCollapsed = useCallback((nodeIds: Iterable<string>) => {
    const { tree: current, drawn: shown } = latest.current;
    setCollapsedIds(new Set([...nodeIds].filter(id => countBelow(current, id, shown) > 0)));
  }, []);

  const expandToNode = useCallback((nodeId: string) => {
    const current = latest.current.tree;
    setCollapsedIds(ids => expandTo(current, ids, nodeId));
  }, []);

  const shownIds = shownTree === tree ? collapsedIds : NO_IDS;
  const layer = useMemo(() => collapseLayer(tree, shownIds, drawn), [tree, shownIds, drawn]);

  return { collapsedIds: shownIds, layer, toggleCollapsed, setCollapsed, expandTo: expandToNode };
}
