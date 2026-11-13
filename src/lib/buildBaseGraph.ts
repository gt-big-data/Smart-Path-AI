import type { Edge, Node } from 'reactflow';
import { computeNodeSizes } from './nodesizing';
import type { GraphTree } from './graphTree';
import { radialLayout, toTopLeft, NodeSize, Point, RadialTreeNode } from './radialLayout';
import { BaseGraph, ConfidenceKeys, DEFAULT_NODE_BORDER } from './graphStyles';
import { getNodeColor } from './graphPalette';
import type { GraphData } from '../types/graph';

/** Node diameter range in px. Connection count scales each node within it. */
const NODE_DIAMETER = { min: 84, max: 132 };

/** Size used for nodes whose real size isn't known yet. Must match NODE_DIAMETER.min. */
export const DEFAULT_NODE_SIZE: NodeSize = { width: NODE_DIAMETER.min, height: NODE_DIAMETER.min };

const NAME_BASED_NODE_TYPES = [
  'Topic', 'Subtopic', 'Event', 'Figure', 'Location',
  'Concept', 'Document', 'Work', 'Author', 'LiteraryDevice',
  'Theme', 'CriticalTheory', 'Genre', 'Formula', 'Property',
  'Theorem', 'Proof', 'Equation', 'Principle', 'Theory',
  'Evidence', 'Scientist',
];

const TEXT_PROPERTIES = [
  'text', 'description', 'illustration', 'explanation',
  'content', 'title', 'label', 'summary', 'definition', 'name',
];

const truncateWords = (text: string, maxWords = 4): string => {
  const words = text.split(' ');
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ')}...`;
};

/** Display label for a raw graph node: its name for name-based types, else the first readable property */
export function getNodeLabel(node: any): string {
  const shouldUseName = node.labels.some((label: string) => NAME_BASED_NODE_TYPES.includes(label));
  if (shouldUseName && node.properties.name && node.properties.name.trim()) {
    return truncateWords(node.properties.name.trim());
  }

  for (const prop of TEXT_PROPERTIES) {
    const value = node.properties[prop];
    if (value && typeof value === 'string' && value.trim()) {
      return truncateWords(value.trim());
    }
  }

  for (const [key, value] of Object.entries(node.properties || {})) {
    if (typeof value === 'string' && value.trim() && key !== 'id') {
      return truncateWords(value.trim());
    }
  }

  const nodeType = node.labels?.[0] || 'Node';
  console.warn('Node with no displayable properties, using fallback:', {
    labels: node.labels,
    properties: Object.keys(node.properties || {}),
    id: node.id,
    fallback: nodeType,
  });
  return nodeType;
}

const isFallbackLabel = (label: string, nodeType: string): boolean => {
  const normalizedLabel = label.toLowerCase().trim();
  return label === nodeType ||
    label === 'Node' ||
    normalizedLabel === 'other' ||
    normalizedLabel === 'unknown' ||
    normalizedLabel === 'undefined' ||
    normalizedLabel === 'null' ||
    normalizedLabel === '';
};

/**
 * Top-left positions for React Flow: the center in the middle and one ring per depth
 * (src/lib/radialLayout.ts). Nodes the tree doesn't reach go in a row under the outer ring.
 */
function layoutRadially(nodes: Node[], tree: GraphTree, sizes: Map<string, NodeSize>): Map<string, Point> {
  const ids = new Set(nodes.map(node => node.id));
  const sizeOf = (id: string) => sizes.get(id) ?? DEFAULT_NODE_SIZE;

  // The tree is built from the raw graph; drop nodes that weren't rendered
  const radialTree = new Map<string, RadialTreeNode>();
  tree.nodes.forEach((treeNode, id) => {
    if (ids.has(id)) radialTree.set(id, { id, children: treeNode.children.filter(child => ids.has(child)) });
  });

  const positions = new Map<string, Point>();
  if (tree.centerId && radialTree.has(tree.centerId)) {
    const { positions: centers } = radialLayout(tree.centerId, radialTree, sizes, { defaultSize: DEFAULT_NODE_SIZE });
    centers.forEach((center, id) => positions.set(id, toTopLeft(center, sizeOf(id))));
  }

  const unplaced = nodes.filter(node => !positions.has(node.id));
  if (unplaced.length > 0) {
    let bottom = 0;
    positions.forEach((pos, id) => { bottom = Math.max(bottom, pos.y + sizeOf(id).height); });
    let x = 0;
    unplaced.forEach(node => {
      positions.set(node.id, { x, y: bottom + 200 });
      x += sizeOf(node.id).width + 40;
    });
  }
  return positions;
}

/**
 * Graph structure only: labels, colors, circle sizes and positions. Edits, confidence,
 * search and path highlights are layered on later by applyGraphStyles.
 */
export function buildBaseGraph(data: GraphData, graphTree: GraphTree): BaseGraph {
  const subject = data.subject || 'default';

  // One row per id: duplicate ids break React keys and inflate the graph.
  const seenNodeIds = new Set<string>();
  const nodesInput = data.graph.nodes.filter((n) => {
    const id = String(n.id);
    if (seenNodeIds.has(id)) return false;
    seenNodeIds.add(id);
    return true;
  });

  // Edge ids end in the index into relationships[], which graphTree's parentEdgeIndex refers to
  const processedEdges: Edge[] = data.graph.relationships.map((rel, i) => ({
    id: `${rel.source}-${rel.target}-${String(rel.type)}-${i}`,
    source: rel.source,
    target: rel.target,
    label: rel.type.replace(/_/g, ' '),
    type: 'smoothstep',
    style: { stroke: '#888', strokeWidth: 2 },
    labelStyle: { fill: '#888', fontSize: 10 },
    animated: false,
    data: { graphEdgeIndex: i },
  }));

  const nodeIds = nodesInput.map(n => n.id);

  // Only edges whose endpoints exist, so phantom ids don't skew connection counts
  const nodeIdSet = new Set(nodeIds);
  const safeEdges = processedEdges.filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target));

  // Sizing ignores confidence (confidenceWeight defaults to 0), so it doesn't need scores here
  const { sizes, connectionCount } = computeNodeSizes(nodeIds, safeEdges, new Map(), {
    scale: 'log',
    minWidth: NODE_DIAMETER.min,
    maxWidth: NODE_DIAMETER.max,
    minHeight: NODE_DIAMETER.min,
    maxHeight: NODE_DIAMETER.max,
  });

  const connectedNodeIds = new Set<string>();
  safeEdges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const confidenceKeys: ConfidenceKeys[] = [];
  const presentTypes: string[] = [];

  const processedNodes: Node[] = nodesInput
    .map((node): Node | null => {
      const nodeType: string = node.labels[0];
      const nodeColor = getNodeColor(nodeType, subject);
      const nodeLabel = getNodeLabel(node);

      // Unlabelled nodes that connect to nothing carry no information, so they're left out
      if (isFallbackLabel(nodeLabel, nodeType) && !connectedNodeIds.has(node.id)) {
        return null;
      }

      if (!presentTypes.includes(nodeType)) presentTypes.push(nodeType);

      confidenceKeys.push({
        nodeId: node.id,
        altIds: [
          node.properties.conceptId,
          node.properties.topicId,
          node.properties.topicID,
          node.properties.topic_id,
          node.properties.concept_id,
          node.properties.id,
        ].filter(Boolean).map(String),
        name: node.properties.name || undefined,
      });

      const size = sizes.get(node.id) ?? DEFAULT_NODE_SIZE;
      const diameter = Math.max(size.width, size.height);
      return {
        id: node.id,
        type: 'default',
        data: {
          label: nodeLabel,
          description: node.properties.description || node.properties.text,
          type: nodeType,
          subject,
          connections: connectionCount.get(node.id) ?? 0,
          color: nodeColor,
          isCenter: node.id === graphTree.centerId,
        },
        position: { x: 0, y: 0 },
        style: {
          background: nodeColor,
          color: '#ffffff',
          border: DEFAULT_NODE_BORDER,
          width: `${diameter}px`,
          height: `${diameter}px`,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
        },
      };
    })
    .filter((node): node is Node => node !== null);

  const validNodeIds = new Set(processedNodes.map(node => node.id));
  const validEdges = processedEdges.filter(edge => validNodeIds.has(edge.source) && validNodeIds.has(edge.target));

  const nodePositions = layoutRadially(processedNodes, graphTree, sizes);
  processedNodes.forEach(node => {
    node.position = nodePositions.get(node.id) ?? { x: 0, y: 0 };
  });

  return { subject, nodes: processedNodes, edges: validEdges, confidenceKeys, nodeTypes: presentTypes };
}
