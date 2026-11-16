import type { XYPosition } from 'reactflow';

/**
 * Node positions the user has dragged, remembered per graph in the browser so they survive
 * switching chats, reloads and re-renders. Nodes that were never moved keep their layout position.
 */

const storageKey = (graphId: string) => `smartpath:positions:${graphId}`;

/** The saved positions for a graph by node id, or an empty map if nothing was saved (or storage is unavailable) */
export function loadNodePositions(graphId: string): Record<string, XYPosition> {
  try {
    const raw = localStorage.getItem(storageKey(graphId));
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, XYPosition>) : {};
  } catch {
    return {};
  }
}

/** Merges the given positions into the graph's saved positions */
export function saveNodePositions(graphId: string, positions: Record<string, XYPosition>): void {
  try {
    const merged = { ...loadNodePositions(graphId), ...positions };
    localStorage.setItem(storageKey(graphId), JSON.stringify(merged));
  } catch {
    // Storage full or blocked: the graph still works, it just won't remember the move
  }
}
