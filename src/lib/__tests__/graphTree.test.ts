import fs from 'fs';
import path from 'path';
import { ancestorsOf, buildGraphTree, pathTo, RawGraph } from '../graphTree';
import { assertTreeInvariants } from './treeInvariants';

type NodeSpec = [id: string, label: string, isCenter?: boolean | string];
type EdgeSpec = [source: string, target: string, type?: string];

const g = (nodes: NodeSpec[], edges: EdgeSpec[] = []): RawGraph => ({
  nodes: nodes.map(([id, label, isCenter]) => ({
    id,
    labels: [label],
    properties: isCenter === undefined ? { name: id } : { name: id, isCenter },
  })),
  relationships: edges.map(([source, target, type = 'HAS_CONCEPT']) => ({ source, target, type })),
});

const build = (graph: RawGraph) => {
  const tree = buildGraphTree(graph);
  assertTreeInvariants(graph, tree);
  return tree;
};

describe('center selection', () => {
  it('uses the isCenter Topic even when another Topic has more connections', () => {
    const tree = build(g(
      [['hub', 'Topic'], ['c', 'Topic', true], ['a', 'Concept'], ['b', 'Concept']],
      [['hub', 'a'], ['hub', 'b'], ['c', 'hub']]
    ));
    expect(tree.centerId).toBe('c');
  });

  it('falls back to the Topic with the most connections when no node has isCenter', () => {
    const tree = build(g(
      [['a', 'Concept'], ['t1', 'Topic'], ['t2', 'Topic'], ['b', 'Concept'], ['c', 'Concept']],
      [['t1', 'a'], ['t2', 'a'], ['t2', 'b'], ['t2', 'c'], ['a', 'b'], ['a', 'c']]
    ));
    // 'a' has the most connections overall but is not a Topic
    expect(tree.centerId).toBe('t2');
  });

  it('treats isCenter: "true" as set and ignores isCenter: false', () => {
    expect(build(g([['t1', 'Topic', false], ['t2', 'Topic', 'true']], [['t1', 't2']])).centerId).toBe('t2');
  });

  it('ignores isCenter on non-Topic nodes', () => {
    expect(build(g([['x', 'Concept', true], ['t', 'Topic']], [['x', 't']])).centerId).toBe('t');
  });

  it('picks the best-connected one when several Topics are flagged', () => {
    const tree = build(g(
      [['t1', 'Topic', true], ['t2', 'Topic', true], ['a', 'Concept']],
      [['t2', 'a'], ['t1', 't2']]
    ));
    expect(tree.centerId).toBe('t2');
  });

  it('breaks ties by input order', () => {
    expect(build(g([['t1', 'Topic'], ['t2', 'Topic']], [['t1', 't2']])).centerId).toBe('t1');
  });

  it('falls back to any node when there are no Topics', () => {
    const tree = build(g([['a', 'Concept'], ['b', 'Concept'], ['c', 'Concept']], [['a', 'b'], ['b', 'c']]));
    expect(tree.centerId).toBe('b');
  });

  it('returns an empty tree for an empty graph', () => {
    const tree = build(g([]));
    expect(tree).toEqual({ centerId: null, nodes: new Map(), order: [] });
  });

  it('makes a lone node the center', () => {
    const tree = build(g([['only', 'Concept']]));
    expect(tree.centerId).toBe('only');
    expect(tree.nodes.get('only')).toMatchObject({ depth: 0, subtreeSize: 1, parentId: null, via: null });
  });
});

describe('walk', () => {
  it('ignores edge direction', () => {
    const tree = build(g([['c', 'Topic', true], ['a', 'Concept'], ['b', 'Concept']], [['a', 'c'], ['b', 'a']]));
    expect(tree.nodes.get('a')).toMatchObject({ parentId: 'c', depth: 1, via: 'edge', parentEdgeIndex: 0 });
    expect(tree.nodes.get('b')).toMatchObject({ parentId: 'a', depth: 2, via: 'edge', parentEdgeIndex: 1 });
  });

  it('prefers a longer real path over a direct RELATED_TO edge', () => {
    const tree = build(g(
      [['c', 'Topic', true], ['a', 'Concept'], ['b', 'Concept']],
      [['c', 'b', 'RELATED_TO'], ['c', 'a'], ['a', 'b']]
    ));
    expect(tree.nodes.get('b')).toMatchObject({ parentId: 'a', depth: 2, via: 'edge', parentEdgeIndex: 2 });
  });

  it('uses RELATED_TO when no real edge reaches a node, then keeps walking real edges', () => {
    const tree = build(g(
      [['c', 'Topic', true], ['a', 'Concept'], ['x', 'Concept'], ['y', 'Concept']],
      [['c', 'a'], ['a', 'x', 'RELATED_TO'], ['x', 'y']]
    ));
    expect(tree.nodes.get('x')).toMatchObject({ parentId: 'a', depth: 2, via: 'related', parentEdgeIndex: 1 });
    expect(tree.nodes.get('y')).toMatchObject({ parentId: 'x', depth: 3, via: 'edge' });
  });

  it('attaches disconnected components to the center as orphans, keeping their shape', () => {
    const tree = build(g(
      [['c', 'Topic', true], ['a', 'Concept'], ['x', 'Concept'], ['y', 'Concept']],
      [['c', 'a'], ['x', 'y']]
    ));
    expect(tree.nodes.get('x')).toMatchObject({ parentId: 'c', depth: 1, via: 'orphan', parentEdgeIndex: null });
    expect(tree.nodes.get('y')).toMatchObject({ parentId: 'x', depth: 2, via: 'edge' });
    expect(tree.nodes.get('c')!.children).toEqual(['a', 'x']);
  });

  it('computes subtree sizes', () => {
    const tree = build(g(
      [['c', 'Topic', true], ['a', 'Concept'], ['b', 'Concept'], ['d', 'Concept'], ['e', 'Concept']],
      [['c', 'a'], ['c', 'b'], ['a', 'd'], ['a', 'e']]
    ));
    expect(tree.nodes.get('c')!.subtreeSize).toBe(5);
    expect(tree.nodes.get('a')!.subtreeSize).toBe(3);
    expect(tree.nodes.get('b')!.subtreeSize).toBe(1);
    expect(tree.nodes.get('a')!.children).toEqual(['d', 'e']);
  });
});

describe('input cleanup', () => {
  it('keeps the first of duplicate node ids', () => {
    const graph = g([['c', 'Topic', true], ['a', 'Concept'], ['a', 'Topic', true]], [['c', 'a']]);
    const tree = build(graph);
    expect(tree.centerId).toBe('c');
    expect(tree.nodes.size).toBe(2);
  });

  it('ignores edges to missing nodes and self-loops', () => {
    const tree = build(g(
      [['c', 'Topic', true], ['a', 'Concept']],
      [['c', 'ghost'], ['a', 'a'], ['a', 'a'], ['c', 'a']]
    ));
    expect(tree.nodes.get('a')).toMatchObject({ parentId: 'c', parentEdgeIndex: 3 });
  });

  it('points parentEdgeIndex at the real edge when a pair has parallel edges', () => {
    const tree = build(g(
      [['c', 'Topic', true], ['a', 'Concept']],
      [['c', 'a', 'RELATED_TO'], ['a', 'c', 'PART_OF']]
    ));
    expect(tree.nodes.get('a')).toMatchObject({ via: 'edge', parentEdgeIndex: 1 });
  });

  it('coerces non-string ids', () => {
    const graph = {
      nodes: [{ id: 1 as unknown as string, labels: ['Topic'] }, { id: 2 as unknown as string, labels: ['Concept'] }],
      relationships: [{ source: 1 as unknown as string, target: 2 as unknown as string, type: 'X' }],
    };
    const tree = build(graph);
    expect(tree.centerId).toBe('1');
    expect(pathTo(tree, '2')).toEqual(['1', '2']);
  });
});

describe('pathTo / ancestorsOf', () => {
  const tree = buildGraphTree(g(
    [['c', 'Topic', true], ['a', 'Concept'], ['b', 'Concept']],
    [['c', 'a'], ['a', 'b']]
  ));

  it('returns the route from the center', () => {
    expect(pathTo(tree, 'b')).toEqual(['c', 'a', 'b']);
    expect(pathTo(tree, 'c')).toEqual(['c']);
  });

  it('returns ancestors nearest first', () => {
    expect(ancestorsOf(tree, 'b')).toEqual(['a', 'c']);
    expect(ancestorsOf(tree, 'c')).toEqual([]);
  });

  it('returns [] for unknown ids', () => {
    expect(pathTo(tree, 'nope')).toEqual([]);
    expect(ancestorsOf(tree, 'nope')).toEqual([]);
  });
});

// Real /view-graph responses saved by X1 (#25). Skipped until that folder exists.
const fixtureDir = path.join(__dirname, '..', '__fixtures__');
const fixtures = fs.existsSync(fixtureDir)
  ? fs.readdirSync(fixtureDir).filter(f => f.endsWith('.json')).sort()
  : [];

if (fixtures.length > 0) {
  describe.each(fixtures)('fixture %s', file => {
    const json = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'));
    const graph: RawGraph = json.graph ?? json;

    it('builds a valid tree', () => {
      const tree = buildGraphTree(graph);
      assertTreeInvariants(graph, tree);
      expect(tree.centerId).not.toBeNull();
    });

    it('routes every node back to the center', () => {
      const tree = buildGraphTree(graph);
      for (const id of tree.order) {
        const route = pathTo(tree, id);
        expect(route[0]).toBe(tree.centerId);
        expect(route[route.length - 1]).toBe(id);
        expect(ancestorsOf(tree, id)).toEqual(route.slice(0, -1).reverse());
      }
    });
  });
} else {
  it.skip('fixture tests (waiting on X1 fixtures in src/lib/__fixtures__)', () => {});
}
