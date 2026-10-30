import type { Edge, Node } from 'reactflow';
import type { PathHighlight } from './pathHighlight';

/**
 * Graph view styling, kept apart from graph structure.
 *
 * GraphVisualization builds the base graph (labels, colors, sizes, positions)
 * from the graph data alone. Everything that changes while the graph is open
 * lives in its own state and is layered on here: confidence scores, custom
 * edits, search hits, the active path (P1), and later the collapsed set (C1).
 * Adding a layer means adding a field to GraphLayers and handling it in
 * applyGraphStyles; nothing writes styles onto the nodes directly.
 */

/** Ids a node might be stored under in concept progress, from the node's properties */
export interface ConfidenceKeys {
  nodeId: string;
  /** conceptId, topicId, etc., in lookup order */
  altIds: string[];
  /** properties.name, if any */
  name?: string;
}

export interface ConceptProgressEntry {
  conceptId: string;
  confidenceScore: number;
}

/** A user's label/color override from the edit popup */
export interface NodeEdit {
  label: string;
  color: string;
}

export interface BaseGraph {
  subject: string;
  nodes: Node[];
  edges: Edge[];
  confidenceKeys: ConfidenceKeys[];
  /** Node types present, in first-seen order (for the legend) */
  nodeTypes: string[];
}

export interface GraphLayers {
  confidenceScores: Map<string, number>;
  nodeEdits: Record<string, NodeEdit>;
  searchHits: Set<string>;
  /** Route from the center to the clicked node; null when no path is shown */
  activePath: PathHighlight | null;
}

export const DEFAULT_NODE_BORDER = '1px solid rgba(255,255,255,0.2)';
export const SEARCH_HIT_BORDER = '3px solid #fbbf24';
export const SEARCH_HIT_SHADOW = '0 0 15px rgba(251, 191, 36, 0.6)';
/** Search ring drawn as a shadow, for hits whose border is taken by the path style or faded out */
export const SEARCH_HIT_RING = '0 0 0 3px #fbbf24';

export const PATH_COLOR = '#d4581c';
export const PATH_NODE_BORDER = `3px solid ${PATH_COLOR}`;
export const PATH_NODE_SHADOW = '0 0 16px rgba(212, 88, 28, 0.58)';
export const DEFAULT_EDGE_COLOR = '#888';

/** Opacity of everything off the path while a path is shown. Search hits stay easier to see. */
export const OFF_PATH_NODE_OPACITY = 0.18;
export const OFF_PATH_SEARCH_HIT_OPACITY = 0.55;
export const OFF_PATH_EDGE_OPACITY = 0.14;

const NODE_TRANSITION = 'opacity 160ms ease, border-color 160ms ease, box-shadow 160ms ease';
const EDGE_TRANSITION = 'opacity 160ms ease, stroke 160ms ease, stroke-width 160ms ease';

/**
 * Match each node to a confidence score. Tries, in order: the node id, its
 * alternate ids, its name against the last `_` part of a conceptId, then any
 * conceptId that contains the node id or vice versa.
 */
export function resolveConfidenceScores(
  keys: ConfidenceKeys[],
  progress: ConceptProgressEntry[]
): Map<string, number> {
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();
  progress.forEach(({ conceptId, confidenceScore }) => {
    byId.set(conceptId, confidenceScore);
    const namePart = conceptId.split('_').pop() || conceptId;
    byName.set(namePart.toLowerCase(), confidenceScore);
  });

  const scores = new Map<string, number>();
  if (byId.size === 0) return scores;

  keys.forEach(({ nodeId, altIds, name }) => {
    let score = byId.get(nodeId);

    for (let i = 0; score === undefined && i < altIds.length; i++) {
      score = byId.get(altIds[i]);
    }

    if (score === undefined && name) {
      score = byName.get(name.toLowerCase());
    }

    if (score === undefined) {
      for (const [conceptId, value] of byId) {
        if (conceptId.includes(nodeId) || nodeId.includes(conceptId)) {
          score = value;
          break;
        }
      }
    }

    if (score !== undefined) scores.set(nodeId, score);
  });

  return scores;
}

/** Combine the base graph with every layer into the nodes and edges React Flow renders */
export function applyGraphStyles(base: BaseGraph, layers: GraphLayers): { nodes: Node[]; edges: Edge[] } {
  const { confidenceScores, nodeEdits, searchHits, activePath } = layers;
  const hasPath = activePath !== null && activePath.nodeIds.length > 0;

  const nodes = base.nodes.map((node) => {
    const edit = nodeEdits[node.id];
    const isSearchHit = searchHits.has(node.id);
    const color = edit?.color ?? node.data.color;
    const pathStep = hasPath ? activePath.nodeSteps.get(node.id) : undefined;
    const onPath = pathStep !== undefined;

    let border = DEFAULT_NODE_BORDER;
    if (onPath) border = PATH_NODE_BORDER;
    else if (isSearchHit && !hasPath) border = SEARCH_HIT_BORDER;

    let opacity = 1;
    if (hasPath && !onPath) opacity = isSearchHit ? OFF_PATH_SEARCH_HIT_OPACITY : OFF_PATH_NODE_OPACITY;

    // A search hit keeps its glow alongside the path; when its border isn't yellow, a ring stands in
    const shadows: string[] = [];
    if (isSearchHit) {
      if (hasPath) shadows.push(SEARCH_HIT_RING);
      shadows.push(SEARCH_HIT_SHADOW);
    }
    if (onPath) shadows.push(PATH_NODE_SHADOW);

    return {
      ...node,
      data: {
        ...node.data,
        confidenceScore: confidenceScores.get(node.id) ?? null,
        customLabel: edit?.label,
        color,
        pathStep,
      },
      style: {
        ...node.style,
        background: color,
        border,
        boxShadow: shadows.join(', ') || 'none',
        opacity,
        transition: NODE_TRANSITION,
      },
    };
  });

  // Edge labels and animation show only along the path
  const edges = base.edges.map((edge) => {
    const edgeIndex = edge.data?.graphEdgeIndex;
    const onPath = hasPath && typeof edgeIndex === 'number' && activePath.edgeIndices.has(edgeIndex);

    return {
      ...edge,
      animated: onPath,
      label: onPath ? edge.label : undefined,
      style: {
        ...edge.style,
        stroke: onPath ? PATH_COLOR : DEFAULT_EDGE_COLOR,
        strokeWidth: onPath ? 4 : 1.5,
        opacity: hasPath && !onPath ? OFF_PATH_EDGE_OPACITY : 1,
        transition: EDGE_TRANSITION,
      },
      labelStyle: {
        ...edge.labelStyle,
        fill: onPath ? PATH_COLOR : 'transparent',
        fontWeight: onPath ? 700 : 400,
      },
      zIndex: onPath ? 1 : 0,
    };
  });

  return { nodes, edges };
}
