import { buildGraphTree, GraphTree, RawGraph } from '../graphTree';

/**
 * Structural checks every tree must pass, whatever the graph.
 * Shared with the fixture tests so real /view-graph responses get the same coverage.
 */
export function assertTreeInvariants(graph: RawGraph, tree: GraphTree): void {
  const uniqueIds = new Set(graph.nodes.map(n => String(n.id)));

  // Every unique node is in the tree exactly once
  expect(tree.nodes.size).toBe(uniqueIds.size);
  expect(new Set(tree.order)).toEqual(uniqueIds);
  expect(tree.order).toHaveLength(uniqueIds.size);
  if (uniqueIds.size === 0) return;

  // One root, and it is the center
  const roots = [...tree.nodes.values()].filter(n => n.parentId === null);
  expect(roots.map(n => n.id)).toEqual([tree.centerId]);
  expect(tree.order[0]).toBe(tree.centerId);

  const seen = new Set<string>();
  for (const id of tree.order) {
    const node = tree.nodes.get(id)!;
    if (node.parentId !== null) {
      const parent = tree.nodes.get(node.parentId)!;
      expect(seen.has(parent.id)).toBe(true); // parents come before children
      expect(node.depth).toBe(parent.depth + 1);
      expect(parent.children).toContain(id);
      expect(node.via).not.toBeNull();
      expect(node.parentEdgeIndex === null).toBe(node.via === 'orphan');
    }
    const childTotal = node.children.reduce((sum, c) => sum + tree.nodes.get(c)!.subtreeSize, 0);
    expect(node.subtreeSize).toBe(childTotal + 1);
    seen.add(id);
  }

  expect(tree.nodes.get(tree.centerId!)!.subtreeSize).toBe(uniqueIds.size);

  // Deterministic
  expect(buildGraphTree(graph)).toEqual(tree);
}
