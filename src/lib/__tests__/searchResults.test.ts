import type { Node } from 'reactflow';
import { describe, expect, it } from 'vitest';
import { buildGraphTree, RawGraph } from '../graphTree';
import { buildSearchResultItems } from '../searchResults';

const graph: RawGraph = {
  nodes: [
    { id: 'center', labels: ['Topic'], properties: { isCenter: true } },
    { id: 'vectors', labels: ['Subtopic'] },
    { id: 'eigen', labels: ['Concept'] },
    { id: 'other', labels: ['Concept'] },
  ],
  relationships: [
    { source: 'center', target: 'vectors', type: 'HAS_SUBTOPIC' },
    { source: 'vectors', target: 'eigen', type: 'HAS_CONCEPT' },
    { source: 'center', target: 'other', type: 'HAS_CONCEPT' },
  ],
};

const tree = buildGraphTree(graph);

const node = (id: string, label: string, extra: Record<string, unknown> = {}): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: { label, type: 'Concept', color: '#123456', ...extra },
});

const nodes: Node[] = [
  node('center', 'Linear Algebra', { type: 'Topic' }),
  node('vectors', 'Vector spaces', { type: 'Subtopic' }),
  node('eigen', 'Eigenvalues'),
  node('other', 'Matrices'),
];

describe('buildSearchResultItems', () => {
  it('keeps the API order and gives each result its trail from the center', () => {
    const items = buildSearchResultItems(['eigen', 'other', 'center'], nodes, tree);

    expect(items.map(item => item.id)).toEqual(['eigen', 'other', 'center']);
    expect(items[0]).toEqual({
      id: 'eigen',
      label: 'Eigenvalues',
      type: 'Concept',
      color: '#123456',
      trail: ['Linear Algebra', 'Vector spaces'],
    });
    expect(items[1].trail).toEqual(['Linear Algebra']);
    expect(items[2].trail).toEqual([]);
  });

  it('drops duplicate ids and ids with no rendered node', () => {
    const items = buildSearchResultItems(['eigen', 'missing', 'eigen'], nodes, tree);
    expect(items.map(item => item.id)).toEqual(['eigen']);
  });

  it('uses custom labels in the result and its trail', () => {
    const edited = nodes.map(n => (n.id === 'vectors' ? node('vectors', 'Vector spaces', { customLabel: 'Spaces' }) : n));
    const [item] = buildSearchResultItems(['eigen'], edited, tree);
    expect(item.trail).toEqual(['Linear Algebra', 'Spaces']);
  });

  it('returns nothing for no hits', () => {
    expect(buildSearchResultItems([], nodes, tree)).toEqual([]);
  });
});
