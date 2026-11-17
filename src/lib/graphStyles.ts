import type { Edge, Node } from 'reactflow';
import type { PathHighlight } from './pathHighlight';
import type { CollapseLayer } from './collapse';

/**
 * Graph view styling, kept apart from graph structure.
 *
 * GraphVisualization builds the base graph (labels, colors, sizes, positions)
 * from the graph data alone. Everything that changes while the graph is open
 * lives in its own state and is layered on here: confidence scores, custom
 * edits, search hits, the active path (P1) and collapsed branches (C1).
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
  /** Nodes hidden by collapsed branches, and how many each collapsed node hides (C1) */
  collapse: CollapseLayer;
}

export const DEFAULT_NODE_BORDER = '1px solid rgba(255,255,255,0.2)';
export const SEARCH_HIT_BORDER = '3px solid #fbbf24';
export const SEARCH_HIT_SHADOW = '0 0 15px rgba(251, 191, 36, 0.6)';
/** Search ring drawn as a shadow, for hits whose border is taken by the path style or faded out */
export const SEARCH_HIT_RING = '0 0 0 3px #fbbf24';

export const PATH_COLOR = '#d4581c';
export const PATH_NODE_BORDER = `3px solid ${PATH_COLOR}`;
export const PATH_NODE_SHADOW = '0 0 16px rgba(212, 88, 28, 0.58)';
export const DEFAULT_EDGE_COLOR = '#9ebbb7';
/** Edge thickness, in px. Path edges are twice as thick as the rest. */
export const EDGE_WIDTH = 2.5;
export const PATH_EDGE_WIDTH = 5;

/** Glow for a path node, in that node's own category color */
export const pathNodeShadow = (color: string) => `0 0 16px ${withAlpha(color, 0.58)}`;

/** Converts a #rrggbb color to rgba() with the given alpha; other formats are returned unchanged */
function withAlpha(color: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

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
  const { confidenceScores, nodeEdits, searchHits, activePath, collapse } = layers;
  const hasPath = activePath !== null && activePath.nodeIds.length > 0;

  // Each node's own colour, after edits; path edges take their end vertex's colour
  const colorById = new Map<string, string>(
    base.nodes.map((node): [string, string] => [node.id, nodeEdits[node.id]?.color ?? node.data.color])
  );

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
    // Each path node glows in its own colour
    if (onPath) shadows.push(pathNodeShadow(color));

    return {
      ...node,
      hidden: collapse.hiddenIds.has(String(node.id)),
      data: {
        ...node.data,
        confidenceScore: confidenceScores.get(node.id) ?? null,
        customLabel: edit?.label,
        color,
        pathStep,
        hiddenCount: collapse.hiddenCounts.get(String(node.id)) ?? 0,
        collapsible: collapse.collapsibleIds.has(String(node.id)),
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

  // Edge labels, glow and direction show only along the path. A path edge takes the colour of its
  // end vertex (the node one level further from the centre), and its glow runs from the centre outward.
  const steps = activePath?.nodeSteps;
  const edges = base.edges.map((edge) => {
    const edgeIndex = edge.data?.graphEdgeIndex;
    const onPath = hasPath && typeof edgeIndex === 'number' && activePath.edgeIndices.has(edgeIndex);
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    // Stored direction can point inward; the glow is drawn from the centre side instead
    const reversed = onPath && (steps?.get(sourceId) ?? 0) > (steps?.get(targetId) ?? 0);
    const endColor = colorById.get(reversed ? sourceId : targetId) ?? PATH_COLOR;

    return {
      ...edge,
      // Covers cross-links too: an edge into a collapsed branch hides with it
      hidden: collapse.hiddenIds.has(sourceId) || collapse.hiddenIds.has(targetId),
      // The built-in animated class draws a dotted line, so the glow is drawn by GlowEdge instead
      animated: false,
      data: { ...edge.data, onPath, reversed },
      label: onPath ? edge.label : undefined,
      style: {
        ...edge.style,
        stroke: onPath ? endColor : DEFAULT_EDGE_COLOR,
        strokeWidth: onPath ? PATH_EDGE_WIDTH : EDGE_WIDTH,
        opacity: hasPath && !onPath ? OFF_PATH_EDGE_OPACITY : 1,
        transition: EDGE_TRANSITION,
      },
      labelStyle: {
        ...edge.labelStyle,
        fill: onPath ? endColor : 'transparent',
        fontWeight: onPath ? 700 : 400,
      },
      zIndex: onPath ? 1 : 0,
    };
  });

  return { nodes, edges };
}
