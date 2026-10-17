/** Node as returned by /view-graph */
export interface RawGraphNode {
  id: string;
  labels?: string[];
  properties?: Record<string, unknown>;
}

/** Relationship as returned by /view-graph */
export interface RawGraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface RawGraph {
  nodes: RawGraphNode[];
  relationships: RawGraphEdge[];
}

/**
 * How a node joined the tree:
 * 'edge'    — through a real (non-RELATED_TO) relationship
 * 'related' — through a RELATED_TO relationship, used only when no real edge reaches it
 * 'orphan'  — not reachable from the center at all; attached to the center directly
 */
export type TreeVia = 'edge' | 'related' | 'orphan';

export interface GraphTreeNode {
  id: string;
  /** null only for the center */
  parentId: string | null;
  depth: number;
  /** In visit order */
  children: string[];
  /** Number of nodes in this subtree, including this node */
  subtreeSize: number;
  /** null only for the center */
  via: TreeVia | null;
  /** Index into relationships[] of the edge to the parent; null for the center and orphans */
  parentEdgeIndex: number | null;
}

export interface GraphTree {
  /** null only for an empty graph */
  centerId: string | null;
  nodes: Map<string, GraphTreeNode>;
  /** Every node in the order the walk reached it; parents always come before children */
  order: string[];
}

interface Link {
  edgeIndex: number;
  related: boolean;
}

const RELATED_TO = 'RELATED_TO';

const isTopic = (node: RawGraphNode) => node.labels?.includes('Topic') ?? false;

const isCenterFlagged = (node: RawGraphNode) => {
  const flag = node.properties?.isCenter;
  return flag === true || flag === 'true';
};

/**
 * Build a spanning tree of the graph rooted at its center node.
 * Edge direction is ignored. Real edges are preferred over RELATED_TO edges,
 * so a node is reached through as few RELATED_TO hops as possible.
 * Output is deterministic for a given input order. Call once per graph load.
 */
export function buildGraphTree(graph: RawGraph): GraphTree {
  // Pass 1: Unique nodes in input order (first occurrence wins, like GraphVisualization)
  const nodeById = new Map<string, RawGraphNode>();
  const position = new Map<string, number>();
  for (const node of graph.nodes) {
    const id = String(node.id);
    if (nodeById.has(id)) continue;
    position.set(id, nodeById.size);
    nodeById.set(id, node);
  }
  const ids = [...nodeById.keys()];

  if (ids.length === 0) {
    return { centerId: null, nodes: new Map(), order: [] };
  }

  // Pass 2: Undirected adjacency, one link per neighbor pair (a real edge beats RELATED_TO)
  const links = new Map<string, Map<string, Link>>();
  const degree = new Map<string, number>();
  ids.forEach(id => {
    links.set(id, new Map());
    degree.set(id, 0);
  });

  graph.relationships.forEach((rel, edgeIndex) => {
    const source = String(rel.source);
    const target = String(rel.target);
    if (!nodeById.has(source) || !nodeById.has(target) || source === target) return;

    degree.set(source, degree.get(source)! + 1);
    degree.set(target, degree.get(target)! + 1);

    const related = rel.type === RELATED_TO;
    for (const [from, to] of [[source, target], [target, source]]) {
      const existing = links.get(from)!.get(to);
      if (!existing || (existing.related && !related)) {
        links.get(from)!.set(to, { edgeIndex, related });
      }
    }
  });

  // Neighbors sorted by input order so the walk is stable across renders
  const neighbors = new Map<string, [string, Link][]>();
  links.forEach((byNeighbor, id) => {
    neighbors.set(
      id,
      [...byNeighbor].sort(([a], [b]) => position.get(a)! - position.get(b)!)
    );
  });

  const centerId = pickCenter(ids, nodeById, degree);

  // Pass 3: Walk outward from the center
  const nodes = new Map<string, GraphTreeNode>();
  const order: string[] = [];

  const attach = (id: string, parentId: string | null, via: TreeVia | null, edgeIndex: number | null) => {
    const parent = parentId === null ? null : nodes.get(parentId)!;
    nodes.set(id, {
      id,
      parentId,
      depth: parent ? parent.depth + 1 : 0,
      children: [],
      subtreeSize: 1,
      via,
      parentEdgeIndex: edgeIndex,
    });
    parent?.children.push(id);
    order.push(id);
  };

  // Grows the tree from the node at order[from]: BFS over real edges until nothing new
  // is reached, then one hop over RELATED_TO edges, then real edges again, and so on.
  const grow = (from: number) => {
    let next = from;
    for (;;) {
      for (; next < order.length; next++) {
        const id = order[next];
        for (const [neighbor, link] of neighbors.get(id)!) {
          if (!link.related && !nodes.has(neighbor)) attach(neighbor, id, 'edge', link.edgeIndex);
        }
      }

      const reachedEnd = order.length;
      for (let i = from; i < reachedEnd; i++) {
        const id = order[i];
        for (const [neighbor, link] of neighbors.get(id)!) {
          if (link.related && !nodes.has(neighbor)) attach(neighbor, id, 'related', link.edgeIndex);
        }
      }
      if (order.length === reachedEnd) return;
    }
  };

  attach(centerId, null, null, null);
  grow(0);

  // Anything still unreached hangs off the center, keeping its own component's shape
  for (const id of ids) {
    if (nodes.has(id)) continue;
    attach(id, centerId, 'orphan', null);
    grow(order.length - 1);
  }

  // Pass 4: Subtree sizes, children before parents
  for (let i = order.length - 1; i > 0; i--) {
    const node = nodes.get(order[i])!;
    nodes.get(node.parentId!)!.subtreeSize += node.subtreeSize;
  }

  return { centerId, nodes, order };
}

/**
 * Center = the Topic flagged isCenter. Graphs built before the flag existed fall back
 * to the Topic with the most connections (same rule as the backend's
 * ensure_center_based_structure), then to any node. Ties go to the earliest node.
 */
function pickCenter(
  ids: string[],
  nodeById: Map<string, RawGraphNode>,
  degree: Map<string, number>
): string {
  const topics = ids.filter(id => isTopic(nodeById.get(id)!));
  const flagged = topics.filter(id => isCenterFlagged(nodeById.get(id)!));
  const pool = flagged.length > 0 ? flagged : topics.length > 0 ? topics : ids;

  return pool.reduce((best, id) => (degree.get(id)! > degree.get(best)! ? id : best));
}

/** The center node's name, tidied for use as a chat title. null if the graph has no named center. */
export function centerNodeName(graph: RawGraph, maxLength = 60): string | null {
  const { centerId } = buildGraphTree(graph);
  const center = graph.nodes.find(node => String(node.id) === centerId);
  const raw = center?.properties?.name ?? center?.properties?.text;
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (!name) return null;
  return name.length > maxLength ? `${name.slice(0, maxLength - 1).trimEnd()}…` : name;
}

/** Node ids from the center to nodeId, both included. [] if nodeId is not in the tree. */
export function pathTo(tree: GraphTree, nodeId: string): string[] {
  if (!tree.nodes.has(nodeId)) return [];

  const path: string[] = [];
  for (let id: string | null = nodeId; id !== null; id = tree.nodes.get(id)!.parentId) {
    path.push(id);
  }
  return path.reverse();
}

/** Node ids from nodeId's parent up to the center. [] for the center or an unknown id. */
export function ancestorsOf(tree: GraphTree, nodeId: string): string[] {
  return pathTo(tree, nodeId).slice(0, -1).reverse();
}
