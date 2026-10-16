/**
 * Radial tree layout for the knowledge graph (task L1, issue #31).
 *
 * The center node sits at the origin and each depth gets its own ring.
 * Every branch owns a slice of the circle, so branches never interleave.
 * A final pass pushes apart any node boxes that still overlap.
 *
 * Pure function: no React, no ReactFlow. Positions are node CENTERS.
 * ReactFlow wants the top-left corner, so subtract half the width and
 * height when wiring it in (see `toTopLeft`).
 */

export interface RadialTreeNode {
  id: string;
  /** Ids of this node's children in the tree built from the center. */
  children: string[];
}

export interface NodeSize {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface RadialLayoutOptions {
  /** Minimum clear space between two node boxes, in px. */
  nodeGap?: number;
  /** Extra space between neighbouring rings, in px. Scale this for Compact / Normal / Roomy. */
  ringGap?: number;
  /** Upper bound on overlap passes, so a bad graph can't freeze the page. */
  maxOverlapPasses?: number;
  /** Size used for a node missing from the size map. */
  defaultSize?: NodeSize;
}

export interface RadialLayoutResult {
  /** Center of each node reachable from the root. Root is at (0, 0). */
  positions: Map<string, Point>;
  /** Radius of each ring, indexed by depth. ringRadii[0] is 0. */
  ringRadii: number[];
  /** Depth of each positioned node. */
  depths: Map<string, number>;
  /** Overlap passes that had to move something. 0 means the rings were enough. */
  overlapPasses: number;
}

const DEFAULTS: Required<RadialLayoutOptions> = {
  nodeGap: 24,
  ringGap: 60,
  maxOverlapPasses: 30,
  defaultSize: { width: 280, height: 110 },
};

const TWO_PI = Math.PI * 2;

export function radialLayout(
  rootId: string,
  tree: Map<string, RadialTreeNode>,
  sizes: Map<string, NodeSize>,
  options: RadialLayoutOptions = {}
): RadialLayoutResult {
  const opts = { ...DEFAULTS, ...options };
  const positions = new Map<string, Point>();
  const depths = new Map<string, number>();

  if (!tree.has(rootId)) {
    return { positions, ringRadii: [], depths, overlapPasses: 0 };
  }

  const sizeOf = (id: string): NodeSize => sizes.get(id) ?? opts.defaultSize;
  // Room a node needs along its ring. The diagonal is the widest a box can
  // be in any direction, so two nodes this far apart can't touch.
  const footprint = (id: string): number => {
    const s = sizeOf(id);
    return Math.hypot(s.width, s.height) + opts.nodeGap;
  };

  // Breadth-first walk from the root. Depth is derived here, and a node
  // listed under two parents keeps the first one, so cycles are harmless.
  const order: string[] = [rootId];
  const kids = new Map<string, string[]>();
  depths.set(rootId, 0);
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const own: string[] = [];
    for (const child of tree.get(id)?.children ?? []) {
      if (!tree.has(child) || depths.has(child)) continue;
      depths.set(child, depths.get(id)! + 1);
      own.push(child);
      order.push(child);
    }
    kids.set(id, own);
  }

  // Ring radii. Each ring must clear the one inside it, and its
  // circumference must hold every node on it side by side.
  const ringCount = depths.get(order[order.length - 1])! + 1;
  const ringTotal = new Array<number>(ringCount).fill(0);
  const ringWidest = new Array<number>(ringCount).fill(0);
  for (const id of order) {
    const d = depths.get(id)!;
    const f = footprint(id);
    ringTotal[d] += f;
    if (f > ringWidest[d]) ringWidest[d] = f;
  }
  const ringRadii = new Array<number>(ringCount).fill(0);
  for (let d = 1; d < ringCount; d++) {
    const clearInner = ringRadii[d - 1] + (ringWidest[d - 1] + ringWidest[d]) / 2 + opts.ringGap;
    ringRadii[d] = Math.max(clearInner, ringTotal[d] / TWO_PI);
  }

  // Angle each branch needs: enough for the node itself and for all of its
  // descendants on their own rings. Bigger branches need bigger slices.
  const need = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const d = depths.get(id)!;
    let fromChildren = 0;
    for (const child of kids.get(id)!) fromChildren += need.get(child)!;
    const own = d === 0 ? 0 : footprint(id) / ringRadii[d];
    need.set(id, Math.max(own, fromChildren));
  }

  // If the branches need more than a full circle, grow every ring by the
  // same factor. Needs shrink by that factor, so they then fit exactly.
  const total = need.get(rootId)!;
  let shrink = 1;
  if (total > TWO_PI) {
    shrink = total / TWO_PI;
    for (let d = 1; d < ringCount; d++) ringRadii[d] *= shrink;
  }

  // Hand out slices from the root outward. Each child gets a share of its
  // parent's slice in proportion to its need and sits in the middle of it.
  const sliceStart = new Map<string, number>([[rootId, -Math.PI / 2]]);
  const sliceWidth = new Map<string, number>([[rootId, TWO_PI]]);
  positions.set(rootId, { x: 0, y: 0 });
  for (const id of order) {
    const children = kids.get(id)!;
    if (children.length === 0) continue;
    let childNeed = 0;
    for (const child of children) childNeed += need.get(child)!;
    const width = sliceWidth.get(id)!;
    let cursor = sliceStart.get(id)!;
    for (const child of children) {
      const share = width * (need.get(child)! / childNeed);
      const angle = cursor + share / 2;
      const r = ringRadii[depths.get(child)!];
      positions.set(child, { x: r * Math.cos(angle), y: r * Math.sin(angle) });
      sliceStart.set(child, cursor);
      sliceWidth.set(child, share);
      cursor += share;
    }
  }

  const overlapPasses = separateOverlaps(order, positions, sizeOf, rootId, opts);
  return { positions, ringRadii, depths, overlapPasses };
}

/**
 * Push apart node boxes that overlap. Uses a grid so each pass only compares
 * nearby nodes instead of every pair. The root never moves.
 */
function separateOverlaps(
  ids: string[],
  positions: Map<string, Point>,
  sizeOf: (id: string) => NodeSize,
  rootId: string,
  opts: Required<RadialLayoutOptions>
): number {
  const gap = opts.nodeGap / 2;
  let cell = 1;
  for (const id of ids) {
    const s = sizeOf(id);
    cell = Math.max(cell, s.width + gap, s.height + gap);
  }

  let passes = 0;
  for (; passes < opts.maxOverlapPasses; passes++) {
    const grid = new Map<string, string[]>();
    for (const id of ids) {
      const p = positions.get(id)!;
      const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push(id);
      else grid.set(key, [id]);
    }

    let moved = false;
    for (const a of ids) {
      const pa = positions.get(a)!;
      const sa = sizeOf(a);
      const cx = Math.floor(pa.x / cell);
      const cy = Math.floor(pa.y / cell);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          for (const b of grid.get(`${gx},${gy}`) ?? []) {
            if (b <= a) continue; // each pair once
            const pb = positions.get(b)!;
            const sb = sizeOf(b);
            const dx = pb.x - pa.x;
            const dy = pb.y - pa.y;
            const overlapX = (sa.width + sb.width) / 2 + gap - Math.abs(dx);
            const overlapY = (sa.height + sb.height) / 2 + gap - Math.abs(dy);
            if (overlapX <= 0 || overlapY <= 0) continue;

            // Separate along the axis that needs the smaller move.
            const alongX = overlapX < overlapY;
            const push = (alongX ? overlapX : overlapY) + 0.5;
            const sign = (alongX ? dx : dy) >= 0 ? 1 : -1;
            const shareA = a === rootId ? 0 : b === rootId ? 1 : 0.5;
            const shareB = 1 - shareA;
            if (alongX) {
              pa.x -= sign * push * shareA;
              pb.x += sign * push * shareB;
            } else {
              pa.y -= sign * push * shareA;
              pb.y += sign * push * shareB;
            }
            moved = true;
          }
        }
      }
    }
    if (!moved) break;
  }
  return passes;
}

/** Convert a center position to the top-left corner ReactFlow expects. */
export function toTopLeft(center: Point, size: NodeSize): Point {
  return { x: center.x - size.width / 2, y: center.y - size.height / 2 };
}
