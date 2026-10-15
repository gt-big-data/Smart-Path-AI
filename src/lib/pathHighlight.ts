import { GraphTree, pathTo } from './graphTree';

export interface PathHighlight {
  nodeIds: string[];
  nodeSteps: Map<string, number>;
  edgeIndices: Set<number>;
}


export function getPathHighlight(
  tree: GraphTree,
  targetId: string
): PathHighlight {
  const nodeIds = pathTo(tree, targetId);

  const nodeSteps = new Map(
    nodeIds.map((id, index) => [id, index + 1])
  );

  const edgeIndices = new Set<number>();

  for (const id of nodeIds.slice(1)) {
    const edgeIndex = tree.nodes.get(id)?.parentEdgeIndex;

    if (edgeIndex !== null && edgeIndex !== undefined) {
      edgeIndices.add(edgeIndex);
    }
  }

  return {
    nodeIds,
    nodeSteps,
    edgeIndices,
  };
}