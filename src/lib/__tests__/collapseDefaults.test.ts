import fs from 'fs';
import path from 'path';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGraphTree, GraphTree } from '../graphTree';
import { useCollapse } from '../collapse';
import {
  idsAtDepth,
  initialCollapsed,
  loadCollapsed,
  OPEN_COLLAPSED_ABOVE,
  OPEN_COLLAPSED_LEVELS,
  saveCollapsed,
  useCollapseDefaults,
} from '../collapseDefaults';

const fixture = (name: string) => {
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '__fixtures__', `${name}.json`), 'utf8'));
  return { graphId: json.graph_id as string, tree: buildGraphTree(json.graph) };
};
const large = fixture('large');
const small = fixture('small');
const history = fixture('history');

const depthOf = (tree: GraphTree, id: string) => tree.nodes.get(id)!.depth;
const sorted = (ids: Iterable<string>) => [...ids].sort();

// Tests run in node, so give them an in-memory localStorage
let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('D0 opening state', () => {
  it('opens graphs over 50 nodes with every node 2 rings out collapsed', () => {
    expect(OPEN_COLLAPSED_ABOVE).toBe(50);
    expect(OPEN_COLLAPSED_LEVELS).toBe(2);
    const ids = initialCollapsed(large.tree, large.tree.order.length, null);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every(id => depthOf(large.tree, id) === 2)).toBe(true);
    expect(sorted(ids)).toEqual(sorted(idsAtDepth(large.tree, 2)));
  });

  it('opens graphs of 50 nodes or fewer fully expanded', () => {
    expect(initialCollapsed(small.tree, small.tree.order.length, null)).toEqual([]);
    expect(initialCollapsed(large.tree, 50, null)).toEqual([]);
    expect(initialCollapsed(large.tree, 51, null).length).toBeGreaterThan(0);
  });

  it('uses the saved state instead of the default, even an empty one', () => {
    expect(initialCollapsed(large.tree, 554, [])).toEqual([]);
    expect(initialCollapsed(small.tree, 32, ['x'])).toEqual(['x']);
  });
});

describe('saving and loading', () => {
  it('round-trips per graph and returns null when nothing is saved', () => {
    expect(loadCollapsed('g1')).toBeNull();
    saveCollapsed('g1', new Set(['a', 'b']));
    saveCollapsed('g2', []);
    expect(loadCollapsed('g1')).toEqual(['a', 'b']);
    expect(loadCollapsed('g2')).toEqual([]);
  });

  it('ignores unreadable data and never throws when storage is blocked', () => {
    store.set('smartpath:collapsed:bad', '{not json');
    expect(loadCollapsed('bad')).toBeNull();
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    });
    expect(loadCollapsed('g1')).toBeNull();
    expect(() => saveCollapsed('g1', ['a'])).not.toThrow();
  });
});

/** Renders useCollapse + useCollapseDefaults the way GraphVisualization does */
function mount(graph: { graphId?: string; tree: GraphTree }) {
  let result!: { collapse: ReturnType<typeof useCollapse>; controls: ReturnType<typeof useCollapseDefaults> };
  function Harness({ tree, graphId }: { tree: GraphTree; graphId?: string }) {
    const drawn = tree.order.map(id => ({ id }));
    const collapse = useCollapse(tree, drawn);
    const controls = useCollapseDefaults(collapse, tree, drawn.length, graphId);
    result = { collapse, controls };
    return null;
  }
  const element = (g: typeof graph) => createElement(Harness, { tree: g.tree, graphId: g.graphId });
  let renderer!: ReturnType<typeof create>;
  act(() => { renderer = create(element(graph)); });
  return {
    get: () => result,
    hidden: () => sorted(result.collapse.layer.hiddenIds),
    switchTo: (g: typeof graph) => act(() => renderer.update(element(g))),
    act: (fn: () => void) => act(fn),
    unmount: () => act(() => renderer.unmount()),
  };
}

const deeperThan = (tree: GraphTree, depth: number) => sorted(tree.order.filter(id => depthOf(tree, id) > depth));

describe('useCollapseDefaults', () => {
  it('opens the large fixture showing only the center and 2 rings, and remembers it', () => {
    const view = mount(large);
    expect(view.hidden()).toEqual(deeperThan(large.tree, 2));
    expect(sorted(loadCollapsed(large.graphId)!)).toEqual(sorted(view.get().collapse.collapsedIds));
    view.unmount();
  });

  it('opens the small fixture fully expanded', () => {
    const view = mount(small);
    expect(view.hidden()).toEqual([]);
    view.unmount();
  });

  it('collapse to center leaves the center and its direct neighbors; expand all opens everything', () => {
    const view = mount(large);
    view.act(() => view.get().controls.collapseToCenter());
    expect(view.hidden()).toEqual(deeperThan(large.tree, 1));
    view.act(() => view.get().controls.expandAll());
    expect(view.hidden()).toEqual([]);
    expect(loadCollapsed(large.graphId)).toEqual([]);
    view.unmount();
  });

  it('reopens a graph the way it was left, over the default', () => {
    const first = mount(large);
    first.act(() => first.get().controls.expandAll());
    first.unmount();
    const again = mount(large);
    expect(again.hidden()).toEqual([]);
    again.act(() => again.get().controls.collapseToCenter());
    again.unmount();
    const third = mount(large);
    expect(third.hidden()).toEqual(deeperThan(large.tree, 1));
    third.unmount();
  });

  it('keeps each graph’s saved state separate when switching graphs', () => {
    const view = mount(large);
    view.act(() => view.get().controls.collapseToCenter());
    view.switchTo(history);
    expect(view.hidden()).toEqual(deeperThan(history.tree, 2));
    view.switchTo(large);
    expect(view.hidden()).toEqual(deeperThan(large.tree, 1));
    view.unmount();
  });

  it('still opens collapsed without a graph id, but saves nothing', () => {
    const view = mount({ tree: large.tree });
    expect(view.hidden()).toEqual(deeperThan(large.tree, 2));
    expect(store.size).toBe(0);
    view.unmount();
  });
});
