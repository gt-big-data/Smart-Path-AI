import type { Node } from 'reactflow';
import {
  applyGraphStyles,
  BaseGraph,
  DEFAULT_NODE_BORDER,
  GraphLayers,
  resolveConfidenceScores,
  SEARCH_HIT_BORDER,
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
