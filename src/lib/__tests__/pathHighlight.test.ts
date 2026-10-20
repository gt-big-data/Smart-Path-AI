import { buildGraphTree, RawGraph } from '../graphTree';
import { getPathHighlight } from '../pathHighlight';

const graph: RawGraph = {
  nodes: [
    {
      id: 'center',
      labels: ['Topic'],
      properties: { isCenter: true },
    },
    {
      id: 'first',
      labels: ['Concept'],
    },
    {
      id: 'second',
      labels: ['Concept'],
    },
    {
      id: 'other',
      labels: ['Concept'],
    },
  ],
  relationships: [
    {
      source: 'center',
      target: 'first',
      type: 'HAS_CONCEPT',
    },
    {
      source: 'other',
      target: 'center',
      type: 'HAS_CONCEPT',
    },
    {
      source: 'second',
      target: 'first',
      type: 'BUILDS_ON',
    },
  ],
};

describe('getPathHighlight', () => {
  const tree = buildGraphTree(graph);

  it('returns ordered nodes, one-based steps, and exact tree edges', () => {
    const highlight = getPathHighlight(tree, 'second');

    expect(highlight.nodeIds).toEqual([
      'center',
      'first',
      'second',
    ]);

    expect([...highlight.nodeSteps]).toEqual([
      ['center', 1],
      ['first', 2],
      ['second', 3],
    ]);

    expect([...highlight.edgeIndices]).toEqual([0, 2]);
  });

  it('returns an empty highlight for an unknown node', () => {
    const highlight = getPathHighlight(tree, 'missing');

    expect(highlight.nodeIds).toEqual([]);
    expect(highlight.nodeSteps.size).toBe(0);
    expect(highlight.edgeIndices.size).toBe(0);
  });

  it('does not invent an edge for an orphan attachment', () => {
    const orphanTree = buildGraphTree({
      nodes: [
        {
          id: 'center',
          labels: ['Topic'],
          properties: { isCenter: true },
        },
        {
          id: 'orphan',
          labels: ['Concept'],
        },
      ],
      relationships: [],
    });

    const highlight = getPathHighlight(orphanTree, 'orphan');

    expect(highlight.nodeIds).toEqual(['center', 'orphan']);
    expect(highlight.edgeIndices.size).toBe(0);
  });
});