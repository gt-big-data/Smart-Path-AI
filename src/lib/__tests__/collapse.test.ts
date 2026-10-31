import fs from 'fs';
import path from 'path';
import type { Edge, Node } from 'reactflow';
import { describe, expect, it } from 'vitest';
import { buildGraphTree, GraphTree, RawGraph } from '../graphTree';
import { collapseLayer, countBelow, expandTo } from '../collapse';
import { applyGraphStyles, BaseGraph, GraphLayers } from '../graphStyles';
import { getPathHighlight } from '../pathHighlight';

type NodeSpec = [id: string, label: string, isCenter?: boolean];
type EdgeSpec = [source: string, target: string, type?: string];

const g = (nodes: NodeSpec[], edges: EdgeSpec[] = []): RawGraph => ({
  nodes: nodes.map(([id, label, isCenter]) => ({
    id,
    labels: [label],
    properties: isCenter === undefined ? { name: id } : { name: id, isCenter },
  })),
  relationships: edges.map(([source, target, type = 'HAS_CONCEPT']) => ({ source, target, type })),
});

/** Every node below id in the tree */
const descendants = (tree: GraphTree, id: string): string[] =>
  tree.nodes.get(id)!.children.flatMap(child => [child, ...descendants(tree, child)]);

/**
 *        c
 *      /   \
 *     a     b
 *    / \     \
 *   a1  a2    b1
 *   |
 *  a11        plus a cross-link a2 → b1 that the tree leaves out
 */
const graph = g(
  [['c', 'Topic', true], ['a', 'Concept'], ['b', 'Concept'], ['a1', 'Concept'], ['a2', 'Concept'], ['a11', 'Concept'], ['b1', 'Concept']],
  [['c', 'a'], ['c', 'b'], ['a', 'a1'], ['a', 'a2'], ['a1', 'a11'], ['b', 'b1'], ['a2', 'b1', 'RELATED_TO']]
);
const tree = buildGraphTree(graph);
const sorted = (ids: Iterable<string>) => [...ids].sort();

describe('collapseLayer', () => {
  it('hides nothing when nothing is collapsed', () => {
    const layer = collapseLayer(tree, new Set());
    expect(layer.hiddenIds.size).toBe(0);
    expect(layer.hiddenCounts.size).toBe(0);
  });

  it("hides a collapsed node's whole subtree but not the node itself", () => {
    const layer = collapseLayer(tree, new Set(['a']));
    expect(sorted(layer.hiddenIds)).toEqual(['a1', 'a11', 'a2']);
    expect(layer.hiddenCounts).toEqual(new Map([['a', 3]]));
  });

  it('follows the tree, not cross-links: b1 stays visible when a collapses', () => {
    expect(collapseLayer(tree, new Set(['a'])).hiddenIds.has('b1')).toBe(false);
  });

  it('counts a collapsed node inside another collapsed branch by its own subtree', () => {
    const layer = collapseLayer(tree, new Set(['a', 'a1']));
    expect(sorted(layer.hiddenIds)).toEqual(['a1', 'a11', 'a2']);
    expect(layer.hiddenCounts).toEqual(new Map([['a', 3], ['a1', 1]]));
  });

  it('handles several collapsed branches at once', () => {
    const layer = collapseLayer(tree, new Set(['a1', 'b']));
    expect(sorted(layer.hiddenIds)).toEqual(['a11', 'b1']);
    expect(layer.hiddenCounts).toEqual(new Map([['a1', 1], ['b', 1]]));
  });

  it('collapsing the center hides everything else', () => {
    const layer = collapseLayer(tree, new Set(['c']));
    expect(layer.hiddenIds.size).toBe(tree.nodes.size - 1);
    expect(layer.hiddenIds.has('c')).toBe(false);
    expect(layer.hiddenCounts.get('c')).toBe(tree.nodes.size - 1);
  });

  it('ignores leaves and ids that are not in the tree', () => {
    const layer = collapseLayer(tree, new Set(['a11', 'b1', 'missing']));
    expect(layer.hiddenIds.size).toBe(0);
    expect(layer.hiddenCounts.size).toBe(0);
  });

  it("leaves undrawn nodes out of the count (the view drops unconnected nodes that only have a type for a label)", () => {
    // u has no edges, so the tree hangs it off the center as an orphan, but the view never draws it
    const withUndrawn = buildGraphTree(g([['c', 'Topic', true], ['x', 'Concept'], ['u', 'Concept']], [['c', 'x']]));
    const drawn = new Set(['c', 'x']);
    expect(withUndrawn.nodes.get('u')!.parentId).toBe('c');
    expect(collapseLayer(withUndrawn, new Set(['c']), drawn).hiddenCounts).toEqual(new Map([['c', 1]]));
  });

  it('ignores a node whose only children are undrawn', () => {
    const onlyUndrawn = buildGraphTree(g([['c', 'Topic', true], ['u', 'Concept']]));
    const layer = collapseLayer(onlyUndrawn, new Set(['c']), new Set(['c']));
    expect(layer.hiddenCounts.size).toBe(0);
    expect(layer.hiddenIds.size).toBe(0);
  });

  it('hides orphans when the center collapses, and their own children when they collapse', () => {
    const withOrphans = buildGraphTree(
      g([['c', 'Topic', true], ['x', 'Concept'], ['o', 'Concept'], ['o1', 'Concept']], [['c', 'x'], ['o', 'o1']])
    );
    expect(withOrphans.nodes.get('o')!.via).toBe('orphan');
    expect(sorted(collapseLayer(withOrphans, new Set(['c'])).hiddenIds)).toEqual(['o', 'o1', 'x']);
    expect(sorted(collapseLayer(withOrphans, new Set(['o'])).hiddenIds)).toEqual(['o1']);
  });
});

describe('countBelow', () => {
  it('counts every node below, or only the drawn ones', () => {
    expect(countBelow(tree, 'c')).toBe(6);
    expect(countBelow(tree, 'a')).toBe(3);
    expect(countBelow(tree, 'a', new Set(['a1']))).toBe(1);
  });

  it('is 0 for leaves and unknown ids', () => {
    expect(countBelow(tree, 'a11')).toBe(0);
    expect(countBelow(tree, 'missing')).toBe(0);
  });
});

describe('expandTo', () => {
  it('opens every collapsed ancestor and leaves other branches alone', () => {
    const next = expandTo(tree, new Set(['a', 'a1', 'b']), 'a11');
    expect(sorted(next)).toEqual(['b']);
    expect(collapseLayer(tree, next).hiddenIds.has('a11')).toBe(false);
  });

  it("doesn't open the node itself", () => {
    expect(sorted(expandTo(tree, new Set(['a', 'a1']), 'a1'))).toEqual(['a1']);
  });

  it('returns the same set when nothing above the node is collapsed', () => {
    const ids = new Set(['b']);
    expect(expandTo(tree, ids, 'a11')).toBe(ids);
    expect(expandTo(tree, ids, 'c')).toBe(ids);
    expect(expandTo(tree, ids, 'missing')).toBe(ids);
  });

  it("doesn't change the set it was given", () => {
    const ids = new Set(['a', 'a1']);
    expandTo(tree, ids, 'a11');
    expect(sorted(ids)).toEqual(['a', 'a1']);
  });
});

describe('applyGraphStyles with collapsed branches', () => {
  // Same ids as the graph above; edges carry their index into relationships[] like the real component
  const base: BaseGraph = {
    subject: 'default',
    nodes: graph.nodes.map((n, i): Node => ({
      id: String(n.id),
      position: { x: i * 100, y: i * 50 },
      data: { label: n.id, color: '#111' },
      style: { background: '#111' },
    })),
    edges: graph.relationships.map((r, i): Edge => ({
      id: `${r.source}-${r.target}-${i}`,
      source: r.source,
      target: r.target,
      label: r.type,
      data: { graphEdgeIndex: i },
    })),
    confidenceKeys: [],
    nodeTypes: [],
  };
  const layers = (collapsed: string[], overrides: Partial<GraphLayers> = {}): GraphLayers => ({
    confidenceScores: new Map(),
    nodeEdits: {},
    searchHits: new Set(),
    activePath: null,
    collapse: collapseLayer(tree, new Set(collapsed)),
    ...overrides,
  });
  const byId = <T extends { id: string }>(items: T[], id: string) => items.find(item => item.id === id)!;

  it('sets the hidden flag on the subtree and the hidden count on the collapsed node', () => {
    const { nodes } = applyGraphStyles(base, layers(['a']));
    expect(nodes.filter(n => n.hidden).map(n => n.id).sort()).toEqual(['a1', 'a11', 'a2']);
    expect(byId(nodes, 'a').hidden).toBe(false);
    expect(byId(nodes, 'a').data.hiddenCount).toBe(3);
    expect(byId(nodes, 'b').data.hiddenCount).toBe(0);
  });

  it('hides every edge touching a hidden node, cross-links included', () => {
    const { edges } = applyGraphStyles(base, layers(['a']));
    const hidden = edges.filter(e => e.hidden).map(e => `${e.source}-${e.target}`).sort();
    expect(hidden).toEqual(['a-a1', 'a-a2', 'a1-a11', 'a2-b1']);
  });

  // Positions React Flow tracks itself (dragged nodes) are kept by GraphVisualization's sync, checked in the browser
  it('applyGraphStyles leaves every position as the layout set it, collapsed or not', () => {
    const positions = (nodes: Node[]) => nodes.map(n => [n.id, n.position.x, n.position.y]);
    expect(positions(applyGraphStyles(base, layers(['a', 'b'])).nodes)).toEqual(positions(base.nodes));
    expect(positions(applyGraphStyles(base, layers(['c'])).nodes)).toEqual(positions(base.nodes));
  });

  it('expanding again shows everything', () => {
    const { nodes, edges } = applyGraphStyles(base, layers([]));
    expect(nodes.some(n => n.hidden)).toBe(false);
    expect(edges.some(e => e.hidden)).toBe(false);
  });

  it('keeps a path selected through a collapsed branch; the visible part keeps the path style', () => {
    const activePath = getPathHighlight(tree, 'a11');
    const { nodes } = applyGraphStyles(base, layers(['a'], { activePath }));
    expect(byId(nodes, 'a').data.pathStep).toBe(2);
    expect(byId(nodes, 'a').style!.opacity).toBe(1);
    expect(byId(nodes, 'a11').hidden).toBe(true);
    expect(byId(nodes, 'a11').data.pathStep).toBe(4);
  });
});

// Real /view-graph responses saved by X1 (#25)
const fixtureDir = path.join(__dirname, '..', '__fixtures__');
const fixtures = fs.readdirSync(fixtureDir).filter(f => f.endsWith('.json')).sort();

describe.each(fixtures)('fixture %s', (file: string) => {
  const json = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'));
  const fixtureTree = buildGraphTree(json.graph);
  const centerId = fixtureTree.centerId!;

  it("collapsing each of the center's children hides exactly its subtree", () => {
    for (const id of fixtureTree.nodes.get(centerId)!.children) {
      const layer = collapseLayer(fixtureTree, new Set([id]));
      expect(sorted(layer.hiddenIds)).toEqual(sorted(descendants(fixtureTree, id)));
      expect(layer.hiddenCounts.get(id) ?? 0).toBe(fixtureTree.nodes.get(id)!.subtreeSize - 1);
    }
  });

  it('collapsing the center hides every other node', () => {
    expect(collapseLayer(fixtureTree, new Set([centerId])).hiddenIds.size).toBe(fixtureTree.nodes.size - 1);
  });

  it('expandTo reveals any node with every branch collapsed', () => {
    const everything = new Set(fixtureTree.order.filter(id => fixtureTree.nodes.get(id)!.children.length > 0));
    for (const id of fixtureTree.order) {
      expect(collapseLayer(fixtureTree, expandTo(fixtureTree, everything, id)).hiddenIds.has(id)).toBe(false);
    }
  });
});
