import fs from 'fs';
import path from 'path';
import { radialLayout, NodeSize, RadialTreeNode } from '../radialLayout';
import { buildGraphTree, RawGraph } from '../graphTree';
import { computeNodeSizes } from '../nodesizing';

// The generated trees below cover shapes on purpose (big random tree, 300-leaf star).
// The real /view-graph fixtures from X1 (#25) run at the bottom once they land.

/** Small seeded random generator so the fixture is the same on every run. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSize(rand: () => number): NodeSize {
  const ratio = rand();
  return { width: Math.round(140 + ratio * 140), height: Math.round(50 + ratio * 60) };
}

/** Random tree: each new node hangs off a random earlier node. */
function makeTree(count: number, seed: number) {
  const rand = seeded(seed);
  const tree = new Map<string, RadialTreeNode>();
  const sizes = new Map<string, NodeSize>();
  for (let i = 0; i < count; i++) {
    const id = `n${i}`;
    tree.set(id, { id, children: [] });
    sizes.set(id, i === 0 ? { width: 280, height: 110 } : randomSize(rand));
    if (i > 0) tree.get(`n${Math.floor(rand() * i)}`)!.children.push(id);
  }
  return { rootId: 'n0', tree, sizes };
}

/** Root with `count` leaves, the worst case for a single ring. */
function makeStar(count: number) {
  const rand = seeded(7);
  const tree = new Map<string, RadialTreeNode>([['root', { id: 'root', children: [] }]]);
  const sizes = new Map<string, NodeSize>([['root', { width: 280, height: 110 }]]);
  for (let i = 0; i < count; i++) {
    const id = `leaf${i}`;
    tree.set(id, { id, children: [] });
    tree.get('root')!.children.push(id);
    sizes.set(id, randomSize(rand));
  }
  return { rootId: 'root', tree, sizes };
}

/** Checks every pair of boxes. Slow on purpose: it must not share code with the layout. */
function countOverlaps(positions: Map<string, { x: number; y: number }>, sizes: Map<string, NodeSize>) {
  const ids = [...positions.keys()];
  let overlaps = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = positions.get(ids[i])!;
      const b = positions.get(ids[j])!;
      const sa = sizes.get(ids[i])!;
      const sb = sizes.get(ids[j])!;
      if (
        Math.abs(a.x - b.x) < (sa.width + sb.width) / 2 &&
        Math.abs(a.y - b.y) < (sa.height + sb.height) / 2
      ) {
        overlaps++;
      }
    }
  }
  return overlaps;
}

describe('radialLayout', () => {
  const large = makeTree(600, 42);

  it('lays out the large fixture with no overlapping nodes', () => {
    const { positions } = radialLayout(large.rootId, large.tree, large.sizes);
    expect(positions.size).toBe(600);
    expect(countOverlaps(positions, large.sizes)).toBe(0);
  });

  it('lays out the large fixture in under 200 ms', () => {
    const start = performance.now();
    radialLayout(large.rootId, large.tree, large.sizes);
    expect(performance.now() - start).toBeLessThan(200);
  });

  it('puts the center at the origin and deeper rings farther out', () => {
    const { positions, ringRadii } = radialLayout(large.rootId, large.tree, large.sizes);
    expect(positions.get(large.rootId)).toEqual({ x: 0, y: 0 });
    for (let d = 1; d < ringRadii.length; d++) {
      expect(ringRadii[d]).toBeGreaterThan(ringRadii[d - 1]);
    }
  });

  it('keeps each branch in its own slice, so branches do not interleave', () => {
    const { positions, depths } = radialLayout(large.rootId, large.tree, large.sizes, {
      maxOverlapPasses: 0, // look at the pure ring placement
    });
    const angle = (id: string) => {
      const p = positions.get(id)!;
      const a = Math.atan2(p.y, p.x) + Math.PI / 2; // slices start at the top
      return a < -1e-9 ? a + Math.PI * 2 : a;
    };
    // Which top-level branch each node belongs to.
    const branchOf = new Map<string, string>();
    const assign = (id: string, branch: string) => {
      branchOf.set(id, branch);
      for (const child of large.tree.get(id)!.children) assign(child, branch);
    };
    for (const top of large.tree.get(large.rootId)!.children) assign(top, top);

    const maxDepth = Math.max(...depths.values());
    for (let d = 1; d <= maxDepth; d++) {
      const ring = [...depths].filter(([, depth]) => depth === d).map(([id]) => id);
      ring.sort((a, b) => angle(a) - angle(b));
      // Going round the ring, a branch must not come back after another one started.
      const finished = new Set<string>();
      let current = '';
      for (const id of ring) {
        const branch = branchOf.get(id)!;
        if (branch === current) continue;
        expect(finished.has(branch)).toBe(false);
        if (current) finished.add(current);
        current = branch;
      }
    }
  });

  it('handles a center with 300 direct children', () => {
    const star = makeStar(300);
    const { positions } = radialLayout(star.rootId, star.tree, star.sizes);
    expect(countOverlaps(positions, star.sizes)).toBe(0);
  });

  it('handles a single node, a chain and a missing root', () => {
    const one = makeTree(1, 1);
    expect(radialLayout(one.rootId, one.tree, one.sizes).positions.size).toBe(1);

    const chain = new Map<string, RadialTreeNode>();
    const sizes = new Map<string, NodeSize>();
    for (let i = 0; i < 20; i++) {
      chain.set(`c${i}`, { id: `c${i}`, children: i < 19 ? [`c${i + 1}`] : [] });
      sizes.set(`c${i}`, { width: 280, height: 110 });
    }
    const laidOut = radialLayout('c0', chain, sizes);
    expect(laidOut.positions.size).toBe(20);
    expect(countOverlaps(laidOut.positions, sizes)).toBe(0);

    expect(radialLayout('nope', chain, sizes).positions.size).toBe(0);
  });
});

// Real /view-graph responses saved by X1 (#25). Skipped until that folder exists.
const fixtureDir = path.join(__dirname, '..', '__fixtures__');
const fixtures = fs.existsSync(fixtureDir)
  ? fs.readdirSync(fixtureDir).filter(f => f.endsWith('.json')).sort()
  : [];

if (fixtures.length > 0) {
  describe.each(fixtures)('radialLayout on fixture %s', file => {
    const json = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'));
    const graph: RawGraph = json.graph ?? json;
    const tree = buildGraphTree(graph);
    const ids = graph.nodes.map(n => String(n.id));
    const { sizes } = computeNodeSizes(
      ids,
      graph.relationships.map(r => ({ source: String(r.source), target: String(r.target) })),
      new Map()
    );

    it('places every node with no overlaps', () => {
      const { positions } = radialLayout(tree.centerId!, tree.nodes, sizes);
      expect(positions.size).toBe(tree.nodes.size);
      expect(countOverlaps(positions, sizes)).toBe(0);
    });

    it('runs in under 200 ms', () => {
      const start = performance.now();
      radialLayout(tree.centerId!, tree.nodes, sizes);
      expect(performance.now() - start).toBeLessThan(200);
    });
  });
} else {
  it.skip('radialLayout fixture tests (waiting on X1 fixtures in src/lib/__fixtures__)', () => {});
}
