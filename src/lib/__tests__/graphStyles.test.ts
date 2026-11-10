import type { Edge, Node } from 'reactflow';
import { buildGraphTree } from '../graphTree';
import { getPathHighlight } from '../pathHighlight';
import {
  applyGraphStyles,
  BaseGraph,
  DEFAULT_NODE_BORDER,
  GraphLayers,
  OFF_PATH_EDGE_OPACITY,
  OFF_PATH_NODE_OPACITY,
  OFF_PATH_SEARCH_HIT_OPACITY,
  PATH_COLOR,
  PATH_NODE_BORDER,
  resolveConfidenceScores,
  SEARCH_HIT_BORDER,
  SEARCH_HIT_RING,
  SEARCH_HIT_SHADOW,
} from '../graphStyles';

const node = (id: string, color = '#111'): Node => ({
  id,
  position: { x: 10, y: 20 },
  data: { label: id, color },
  style: { background: color, border: DEFAULT_NODE_BORDER, width: '200px' },
});

const base = (ids: string[]): BaseGraph => ({
  subject: 'default',
  nodes: ids.map((id) => node(id)),
  edges: [],
  confidenceKeys: ids.map((nodeId) => ({ nodeId, altIds: [] })),
  nodeTypes: [],
});

const layers = (overrides: Partial<GraphLayers> = {}): GraphLayers => ({
  confidenceScores: new Map(),
  nodeEdits: {},
  searchHits: new Set(),
  activePath: null,
  collapse: { hiddenIds: new Set(), hiddenCounts: new Map() },
  ...overrides,
});

const byId = (nodes: Node[], id: string) => nodes.find((n) => n.id === id)!;

describe('resolveConfidenceScores', () => {
  it('matches by node id, then alternate ids in order', () => {
    const scores = resolveConfidenceScores(
      [
        { nodeId: 'a', altIds: [] },
        { nodeId: 'b', altIds: ['missing', 'concept-b', 'other-b'] },
      ],
      [
        { conceptId: 'a', confidenceScore: 0.9 },
        { conceptId: 'concept-b', confidenceScore: 0.5 },
        { conceptId: 'other-b', confidenceScore: 0.1 },
      ]
    );
    expect(scores.get('a')).toBe(0.9);
    expect(scores.get('b')).toBe(0.5);
  });

  it('matches by name against the last part of the conceptId, ignoring case', () => {
    const scores = resolveConfidenceScores(
      [{ nodeId: '4:xyz:7', altIds: [], name: 'Photosynthesis' }],
      [{ conceptId: 'bio_photosynthesis', confidenceScore: 0.3 }]
    );
    expect(scores.get('4:xyz:7')).toBe(0.3);
  });

  it('falls back to substring matches either way', () => {
    const scores = resolveConfidenceScores(
      [{ nodeId: 'n42', altIds: [] }, { nodeId: 'graph1_n7', altIds: [] }],
      [
        { conceptId: 'graph1_n42', confidenceScore: 0.6 },
        { conceptId: 'n7', confidenceScore: 0.2 },
      ]
    );
    expect(scores.get('n42')).toBe(0.6);
    expect(scores.get('graph1_n7')).toBe(0.2);
  });

  it('keeps a score of 0 and leaves unmatched nodes out', () => {
    const scores = resolveConfidenceScores(
      [{ nodeId: 'a', altIds: [] }, { nodeId: 'zzz', altIds: [] }],
      [{ conceptId: 'a', confidenceScore: 0 }]
    );
    expect(scores.get('a')).toBe(0);
    expect(scores.has('zzz')).toBe(false);
  });
});

describe('applyGraphStyles', () => {
  it('a custom edit survives new confidence scores (a quiz answer)', () => {
    const graph = base(['a', 'b']);
    const nodeEdits = { a: { label: 'My label', color: '#f00' } };

    const before = applyGraphStyles(graph, layers({ nodeEdits }));
    const after = applyGraphStyles(graph, layers({ nodeEdits, confidenceScores: new Map([['a', 0.8]]) }));

    for (const { nodes } of [before, after]) {
      expect(byId(nodes, 'a').data.customLabel).toBe('My label');
      expect(byId(nodes, 'a').data.color).toBe('#f00');
      expect(byId(nodes, 'a').style!.background).toBe('#f00');
    }
    expect(byId(before.nodes, 'a').data.confidenceScore).toBeNull();
    expect(byId(after.nodes, 'a').data.confidenceScore).toBe(0.8);
    expect(byId(after.nodes, 'b').data.customLabel).toBeUndefined();
  });

  it('highlights search hits and clears them when the search ends', () => {
    const graph = base(['a', 'b']);

    const searching = applyGraphStyles(graph, layers({ searchHits: new Set(['b']) }));
    expect(byId(searching.nodes, 'b').style!.border).toBe(SEARCH_HIT_BORDER);
    expect(byId(searching.nodes, 'a').style!.border).toBe(DEFAULT_NODE_BORDER);

    const cleared = applyGraphStyles(graph, layers());
    expect(byId(cleared.nodes, 'b').style!.border).toBe(DEFAULT_NODE_BORDER);
    expect(byId(cleared.nodes, 'b').style!.boxShadow).toBe('none');
  });

  it('search and edits stack on the same node', () => {
    const { nodes } = applyGraphStyles(
      base(['a']),
      layers({ searchHits: new Set(['a']), nodeEdits: { a: { label: 'x', color: '#0f0' } } })
    );
    expect(byId(nodes, 'a').style).toMatchObject({ background: '#0f0', border: SEARCH_HIT_BORDER, width: '200px' });
  });

  it('never touches positions or the base graph', () => {
    const graph = base(['a']);
    const snapshot = JSON.stringify(graph);
    const { nodes } = applyGraphStyles(
      graph,
      layers({ searchHits: new Set(['a']), nodeEdits: { a: { label: 'x', color: '#0f0' } } })
    );
    expect(nodes[0].position).toEqual({ x: 10, y: 20 });
    expect(JSON.stringify(graph)).toBe(snapshot);
  });
});

describe('applyGraphStyles with an active path', () => {
  // center -> first <- second, plus other -> center; edge data carries the relationships[] index
  const relationships = [
    { source: 'center', target: 'first', type: 'HAS_CONCEPT' },
    { source: 'other', target: 'center', type: 'HAS_CONCEPT' },
    { source: 'second', target: 'first', type: 'BUILDS_ON' },
  ];
  const tree = buildGraphTree({
    nodes: [
      { id: 'center', labels: ['Topic'], properties: { isCenter: true } },
      { id: 'first', labels: ['Concept'] },
      { id: 'second', labels: ['Concept'] },
      { id: 'other', labels: ['Concept'] },
    ],
    relationships,
  });
  const edges: Edge[] = relationships.map((rel, i) => ({
    id: `e${i}`,
    source: rel.source,
    target: rel.target,
    label: rel.type,
    animated: true,
    style: { stroke: '#888', strokeWidth: 2 },
    data: { graphEdgeIndex: i },
  }));
  const graph: BaseGraph = { ...base(['center', 'first', 'second', 'other']), edges };
  const path = getPathHighlight(tree, 'second');
  const edgeById = (styled: Edge[], id: string) => styled.find((e) => e.id === id)!;

  it('styles path nodes with step numbers and fades the rest', () => {
    const { nodes } = applyGraphStyles(graph, layers({ activePath: path }));

    expect(byId(nodes, 'center').data.pathStep).toBe(1);
    expect(byId(nodes, 'first').data.pathStep).toBe(2);
    expect(byId(nodes, 'second').data.pathStep).toBe(3);
    expect(byId(nodes, 'second').style).toMatchObject({ border: PATH_NODE_BORDER, opacity: 1 });

    expect(byId(nodes, 'other').data.pathStep).toBeUndefined();
    expect(byId(nodes, 'other').style).toMatchObject({ border: DEFAULT_NODE_BORDER, opacity: OFF_PATH_NODE_OPACITY });
  });

  it('shows labels and animation only on path edges', () => {
    const styled = applyGraphStyles(graph, layers({ activePath: path })).edges;

    for (const id of ['e0', 'e2']) {
      const edge = edgeById(styled, id);
      expect(edge.animated).toBe(true);
      expect(edge.label).toBe(relationships[Number(id.slice(1))].type);
      expect(edge.style).toMatchObject({ stroke: PATH_COLOR, opacity: 1 });
    }

    const offPath = edgeById(styled, 'e1');
    expect(offPath.animated).toBe(false);
    expect(offPath.label).toBeUndefined();
    expect(offPath.style!.opacity).toBe(OFF_PATH_EDGE_OPACITY);
  });

  it('keeps search hits visible alongside the path', () => {
    const { nodes } = applyGraphStyles(
      graph,
      layers({ activePath: path, searchHits: new Set(['other', 'first']) })
    );

    // Off the path: faded less than other nodes, with a ring in place of the yellow border
    expect(byId(nodes, 'other').style!.opacity).toBe(OFF_PATH_SEARCH_HIT_OPACITY);
    expect(byId(nodes, 'other').style!.border).toBe(DEFAULT_NODE_BORDER);
    expect(byId(nodes, 'other').style!.boxShadow).toContain(SEARCH_HIT_RING);

    // On the path: path border, with both glows
    expect(byId(nodes, 'first').style!.border).toBe(PATH_NODE_BORDER);
    expect(byId(nodes, 'first').style!.boxShadow).toContain(SEARCH_HIT_SHADOW);
  });

  it('the path survives new confidence scores and custom edits', () => {
    const { nodes } = applyGraphStyles(
      graph,
      layers({
        activePath: path,
        confidenceScores: new Map([['first', 0.4]]),
        nodeEdits: { first: { label: 'Renamed', color: '#0f0' } },
      })
    );
    expect(byId(nodes, 'first').data).toMatchObject({ pathStep: 2, confidenceScore: 0.4, customLabel: 'Renamed' });
    expect(byId(nodes, 'first').style).toMatchObject({ border: PATH_NODE_BORDER, background: '#0f0' });
  });

  it('with no path, nothing is faded and edges drop labels and animation', () => {
    const styled = applyGraphStyles(graph, layers());

    styled.nodes.forEach((node) => {
      expect(node.data.pathStep).toBeUndefined();
      expect(node.style!.opacity).toBe(1);
    });
    styled.edges.forEach((edge) => {
      expect(edge.animated).toBe(false);
      expect(edge.label).toBeUndefined();
      expect(edge.style!.opacity).toBe(1);
    });
  });
});
