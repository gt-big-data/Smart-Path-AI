// src/lib/nodeizing.ts

export interface SizingOptions {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  /**
   * 'linear'     — raw ratio (your current approach)
   * 'log'        — logarithmic, compresses extremes (recommended)
   * 'percentile' — rank-based, immune to outlier spikes
   */
  scale?: 'linear' | 'log' | 'percentile';
  /** 0–1 weight of confidence score on sizing. 0 = connections only. */
  confidenceWeight?: number;
}

const DEFAULTS: Required<SizingOptions> = {
  minWidth: 140,
  maxWidth: 280,  // Reduced from 320 — prevents huge nodes crowding layout
  minHeight: 50,
  maxHeight: 110,
  scale: 'log',
  confidenceWeight: 0,
};

export interface NodeSizeResult {
  width: number;
  height: number;
}

export interface NodeSizingContext {
  /** Map from nodeId → computed size */
  sizes: Map<string, NodeSizeResult>;
  /** Exposed for debugging / legend */
  connectionCount: Map<string, number>;
  stats: { min: number; max: number; median: number };
}

/**
 * Compute sizes for all nodes in one pass.
 * Call once per graph load, not per node render.
 */
export function computeNodeSizes(
  nodeIds: string[],
  edges: { source: string; target: string }[],
  confidenceMap: Map<string, number>,
  options: SizingOptions = {}
): NodeSizingContext {
  const opts = { ...DEFAULTS, ...options };

  // --- Pass 1: Count connections ---
  const connectionCount = new Map<string, number>();
  // Initialize all nodes at 0 so isolated nodes are included
  nodeIds.forEach(id => connectionCount.set(id, 0));
  edges.forEach(edge => {
    connectionCount.set(edge.source, (connectionCount.get(edge.source) ?? 0) + 1);
    connectionCount.set(edge.target, (connectionCount.get(edge.target) ?? 0) + 1);
  });

  const counts = nodeIds.map(id => connectionCount.get(id) ?? 0);
  const sorted = [...counts].sort((a, b) => a - b);
  const minConnections = sorted[0] ?? 0;
  const maxConnections = sorted[sorted.length - 1] ?? 1;
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1;

  // --- Pass 2: Compute ratio per node ---
  const sizes = new Map<string, NodeSizeResult>();

  for (const nodeId of nodeIds) {
    const count = connectionCount.get(nodeId) ?? 0;
    const confidence = confidenceMap.get(nodeId) ?? null;

    let ratio: number;

    if (maxConnections === minConnections) {
      // All nodes have equal connections — use uniform mid-size (0.5 = centred in the range)
      ratio = 0.5;
    } else if (opts.scale === 'log') {
      // Log scale: compresses outliers, spreads the middle
      const logMin = Math.log1p(minConnections);
      const logMax = Math.log1p(maxConnections);
      ratio = (Math.log1p(count) - logMin) / (logMax - logMin);
    } else if (opts.scale === 'percentile') {
      // Rank-based: every node gets a proportional rank 0–1.
      // Use findIndex (first occurrence) so tied nodes share the same rank
      // instead of all being pushed to ratio=1.0 by a filter(c <= count).
      const firstIdx = sorted.findIndex(c => c === count);
      ratio = (firstIdx + 1) / sorted.length;
    } else {
      // Linear (your original)
      ratio = (count - minConnections) / (maxConnections - minConnections);
    }

    // Blend in confidence score as an additive nudge
    if (confidence !== null && opts.confidenceWeight > 0) {
      // High confidence = slightly larger (mastered concepts = central)
      // Low confidence = slightly smaller (struggling = less prominent)
      const confidenceBonus = (confidence - 0.5) * opts.confidenceWeight;
      ratio = Math.max(0, Math.min(1, ratio + confidenceBonus));
    }

    sizes.set(nodeId, {
      width: Math.round(opts.minWidth + ratio * (opts.maxWidth - opts.minWidth)),
      height: Math.round(opts.minHeight + ratio * (opts.maxHeight - opts.minHeight)),
    });
  }

  return { sizes, connectionCount, stats: { min: minConnections, max: maxConnections, median } };
}
