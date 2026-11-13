interface PlaceholderNode {
  id?: unknown;
  labels?: unknown[];
  properties?: Record<string, unknown>;
}

/** The fields of a /view-graph or process-pdf payload that the placeholder check reads */
export interface GraphPayloadLike {
  graph?: { nodes?: PlaceholderNode[] } | null;
  subject?: unknown;
}

/**
 * True when the backend returned a stub graph (still being built, or the default metadata node)
 * rather than real concepts. Callers poll until this returns false.
 */
export function isPlaceholderGraph(payload: GraphPayloadLike | null | undefined): boolean {
  const nodes = payload?.graph?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return true;
  if (nodes.length > 1) return false;

  const node: PlaceholderNode = nodes[0] ?? {};
  const labels: string[] = Array.isArray(node.labels)
    ? node.labels.map((label) => String(label).toLowerCase())
    : [];
  const propSubject = String(node.properties?.subject ?? '').toLowerCase();
  const topSubject = String(payload?.subject ?? '').toLowerCase();
  if (
    labels.some((label) => label.includes('graphmetadata')) &&
    (propSubject === 'default' || topSubject === 'default')
  ) {
    return true;
  }

  const id = String(node.id || '').toLowerCase();
  const label = String(node.labels?.[0] || '').toLowerCase();
  const name = String(node.properties?.name || '').toLowerCase();
  const text = String(node.properties?.text || '').toLowerCase();
  return [id, label, name, text].some(
    (value) => value === 'default' || value.includes('placeholder'),
  );
}
