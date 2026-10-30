import type { Node } from 'reactflow';
import { GraphTree, pathTo } from './graphTree';

/** One row in the graph search results list (P3) */
export interface SearchResultItem {
  id: string;
  label: string;
  type: string;
  color: string;
  /** Labels from the center down to the result's parent, for telling apart results with the same name */
  trail: string[];
}

/**
 * Turn the ids the search API returned into list rows, in the order the API ranked them.
 * Ids are deduplicated, and ids with no rendered node (filtered out, or stale) are dropped.
 * Labels and colors come from the styled nodes so custom edits show up in the list.
 */
export function buildSearchResultItems(hitIds: string[], nodes: Node[], tree: GraphTree): SearchResultItem[] {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const labelOf = (id: string): string => {
    const data = nodeById.get(id)?.data;
    return data?.customLabel || data?.label || id;
  };

  const seen = new Set<string>();
  const items: SearchResultItem[] = [];
  for (const id of hitIds) {
    const node = nodeById.get(id);
    if (!node || seen.has(id)) continue;
    seen.add(id);

    items.push({
      id,
      label: labelOf(id),
      type: node.data?.type ?? 'Node',
      color: node.data?.color ?? '#64748b',
      trail: pathTo(tree, id).slice(0, -1).map(labelOf),
    });
  }
  return items;
}
