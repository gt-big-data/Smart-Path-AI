/**
 * T1 baseline (issue #35): time the graph layout on every X1 fixture.
 *
 * Compares the force-directed layout the graph view used before L1 (#31) with
 * the radial layout on main, using the same nodes, edges and sizes that
 * GraphVisualization's baseGraph hands them. Also counts overlapping node
 * boxes, so speed isn't bought with a worse picture.
 *
 * Run:  npm run bench:layout            (or: node scripts/bench/run.mjs)
 * Opts: RUNS=20 WARMUP=3 FIXTURES=large,small
 *
 * `legacyForceDirectedLayout` is copied verbatim from GraphVisualization.tsx at
 * 2fddf3b0, the parent of 29db0f60 "wire in radial layout". Don't tidy it: the
 * point is to time the code that shipped.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { performance } from 'perf_hooks';
import type { Edge, Node } from 'reactflow';
import { buildGraphTree, GraphTree, RawGraph } from '../../src/lib/graphTree';
import { computeNodeSizes } from '../../src/lib/nodesizing';
import { radialLayout, toTopLeft, NodeSize, Point, RadialTreeNode } from '../../src/lib/radialLayout';

const FIXTURE_DIR = path.resolve(process.cwd(), 'src/lib/__fixtures__');
const RUNS = Number(process.env.RUNS ?? 15);
const WARMUP = Number(process.env.WARMUP ?? 2);
const FIXTURES = (process.env.FIXTURES ?? 'large,history,small,no-center').split(',');
const DEFAULT_NODE_SIZE: NodeSize = { width: 200, height: 70 };
const NODE_GAP = 24; // radialLayout's default clear space between boxes

// ---- Old layout, verbatim from 2fddf3b0 ----------------------------------------
const legacyForceDirectedLayout = (nodes: Node[], edges: Edge[], spacing: number = 360) => {
  const positions: { x: number; y: number }[] = [];
  const width = Math.max(1000, nodes.length * 200);
  const height = Math.max(800, nodes.length * 150);

  const cols = Math.ceil(Math.sqrt(nodes.length));
  nodes.forEach((_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    positions.push({
      x: col * spacing + (Math.random() * 50 - 25),
      y: row * spacing + (Math.random() * 50 - 25),
    });
  });

  const iterations = 50;
  for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < nodes.length; j++) {
      for (let k = j + 1; k < nodes.length; k++) {
        const dx = positions[k].x - positions[j].x;
        const dy = positions[k].y - positions[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < spacing) {
          const force = (spacing - distance) / distance;
          const moveX = dx * force * 0.1;
          const moveY = dy * force * 0.1;
          positions[k].x += moveX;
          positions[k].y += moveY;
          positions[j].x -= moveX;
          positions[j].y -= moveY;
        }
      }
    }

    edges.forEach(edge => {
      const sourceIndex = nodes.findIndex(n => n.id === edge.source);
      const targetIndex = nodes.findIndex(n => n.id === edge.target);
      if (sourceIndex >= 0 && targetIndex >= 0) {
        const dx = positions[targetIndex].x - positions[sourceIndex].x;
        const dy = positions[targetIndex].y - positions[sourceIndex].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > spacing) {
          const force = (distance - spacing) / distance;
          const moveX = dx * force * 0.05;
          const moveY = dy * force * 0.05;
          positions[sourceIndex].x += moveX;
          positions[sourceIndex].y += moveY;
          positions[targetIndex].x -= moveX;
          positions[targetIndex].y -= moveY;
        }
      }
    });
  }

  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));
  const maxY = Math.max(...positions.map(p => p.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  positions.forEach(pos => {
    pos.x = pos.x - centerX + width / 2;
    pos.y = pos.y - centerY + height / 2;
  });

  return positions;
};
// ---- end verbatim ---------------------------------------------------------------

/** GraphVisualization.layoutRadially on main (top-left positions for React Flow). */
function layoutRadially(nodes: Node[], tree: GraphTree, sizes: Map<string, NodeSize>): Map<string, Point> {
  const ids = new Set(nodes.map(n => n.id));
  const sizeOf = (id: string) => sizes.get(id) ?? DEFAULT_NODE_SIZE;
  const radialTree = new Map<string, RadialTreeNode>();
  tree.nodes.forEach((t, id) => {
    if (ids.has(id)) radialTree.set(id, { id, children: t.children.filter(c => ids.has(c)) });
  });
  const positions = new Map<string, Point>();
  if (tree.centerId && radialTree.has(tree.centerId)) {
    const { positions: centers } = radialLayout(tree.centerId, radialTree, sizes, { defaultSize: DEFAULT_NODE_SIZE });
    centers.forEach((c, id) => positions.set(id, toTopLeft(c, sizeOf(id))));
  }
  let bottom = 0;
  positions.forEach((p, id) => { bottom = Math.max(bottom, p.y + sizeOf(id).height); });
  let x = 0;
  for (const n of nodes) {
    if (positions.has(n.id)) continue;
    positions.set(n.id, { x, y: bottom + 200 });
    x += sizeOf(n.id).width + 40;
  }
  return positions;
}

/** What baseGraph computes before the layout: deduped nodes, valid edges, sizes, old spacing. */
function prepare(graph: RawGraph) {
  const seen = new Set<string>();
  const nodeIds: string[] = [];
  for (const n of graph.nodes) {
    const id = String(n.id);
    if (!seen.has(id)) { seen.add(id); nodeIds.push(id); }
  }
  const edges: Edge[] = graph.relationships
    .map((r, i) => ({ id: `${r.source}-${r.target}-${r.type}-${i}`, source: String(r.source), target: String(r.target) }))
    .filter(e => seen.has(e.source) && seen.has(e.target));
  const { sizes } = computeNodeSizes(nodeIds, edges, new Map(), { scale: 'log' });
  const nodes: Node[] = nodeIds.map(id => ({ id, data: {}, position: { x: 0, y: 0 } }));
  const widths = [...sizes.values()].map(s => s.width).sort((a, b) => a - b);
  const legacySpacing = Math.max(360, (widths[Math.floor(widths.length / 2)] ?? 200) + 100);
  return { nodes, edges, sizes, legacySpacing };
}

/** Pairs of top-left boxes that overlap, and pairs closer than NODE_GAP. All pairs; slow on purpose. */
function overlapStats(ids: string[], pos: (id: string) => Point, sizes: Map<string, NodeSize>) {
  let overlapping = 0;
  let tooClose = 0;
  for (let i = 0; i < ids.length; i++) {
    const a = pos(ids[i]); const sa = sizes.get(ids[i]) ?? DEFAULT_NODE_SIZE;
    for (let j = i + 1; j < ids.length; j++) {
      const b = pos(ids[j]); const sb = sizes.get(ids[j]) ?? DEFAULT_NODE_SIZE;
      const dx = Math.abs(a.x + sa.width / 2 - (b.x + sb.width / 2));
      const dy = Math.abs(a.y + sa.height / 2 - (b.y + sb.height / 2));
      const ox = (sa.width + sb.width) / 2;
      const oy = (sa.height + sb.height) / 2;
      if (dx < ox && dy < oy) overlapping++;
      else if (dx < ox + NODE_GAP - 1e-6 && dy < oy + NODE_GAP - 1e-6) tooClose++;
    }
  }
  return { overlapping, tooClose };
}

function time(fn: () => void) {
  for (let i = 0; i < WARMUP; i++) fn();
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const q = (p: number) => samples[Math.min(samples.length - 1, Math.floor(p * samples.length))];
  return { median: q(0.5), p95: q(0.95), min: samples[0], max: samples[samples.length - 1] };
}

const ms = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2));

const results: Record<string, unknown>[] = [];
console.log(`Node ${process.version} · ${os.cpus()[0]?.model ?? 'unknown CPU'} · ${os.cpus().length} cores · RUNS=${RUNS} WARMUP=${WARMUP}\n`);

for (const name of FIXTURES) {
  const graph: RawGraph = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), 'utf8')).graph;
  const { nodes, edges, sizes, legacySpacing } = prepare(graph);
  const ids = nodes.map(n => n.id);
  const prebuiltTree = buildGraphTree(graph);

  const legacy = time(() => legacyForceDirectedLayout(nodes, edges, legacySpacing));
  const radialWithTree = time(() => layoutRadially(nodes, buildGraphTree(graph), sizes));
  const radialOnly = time(() => layoutRadially(nodes, prebuiltTree, sizes));

  const legacyPos = legacyForceDirectedLayout(nodes, edges, legacySpacing);
  const legacyOverlap = overlapStats(ids, id => legacyPos[ids.indexOf(id)], sizes);
  const radialPos = layoutRadially(nodes, prebuiltTree, sizes);
  const radialOverlap = overlapStats(ids, id => radialPos.get(id)!, sizes);

  console.log(`${name}: ${nodes.length} nodes, ${edges.length} edges`);
  console.table({
    'legacy force-directed (pre-L1)': { median_ms: ms(legacy.median), p95_ms: ms(legacy.p95), min_ms: ms(legacy.min), max_ms: ms(legacy.max), overlapping_pairs: legacyOverlap.overlapping, closer_than_gap: legacyOverlap.tooClose },
    'radial: tree + layout (main)': { median_ms: ms(radialWithTree.median), p95_ms: ms(radialWithTree.p95), min_ms: ms(radialWithTree.min), max_ms: ms(radialWithTree.max), overlapping_pairs: radialOverlap.overlapping, closer_than_gap: radialOverlap.tooClose },
    'radial: layout only': { median_ms: ms(radialOnly.median), p95_ms: ms(radialOnly.p95), min_ms: ms(radialOnly.min), max_ms: ms(radialOnly.max), overlapping_pairs: '', closer_than_gap: '' },
  });
  results.push({ fixture: name, nodes: nodes.length, edges: edges.length, legacy, radialWithTree, radialOnly, legacyOverlap, radialOverlap });
}

if (process.env.JSON_OUT) fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(results, null, 2));
