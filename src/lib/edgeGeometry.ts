export interface EdgePoint {
  x: number;
  y: number;
}

export interface EdgeSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Straight segment from the boundary of the source disc to the boundary of the target disc,
 * for discs centred on the given points. Null when the discs overlap or share a centre, since
 * there is no visible gap to draw across.
 */
export function circleEdgeSegment(
  source: EdgePoint,
  sourceRadius: number,
  target: EdgePoint,
  targetRadius: number
): EdgeSegment | null {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance <= sourceRadius + targetRadius) return null;

  const ux = dx / distance;
  const uy = dy / distance;
  return {
    x1: source.x + ux * sourceRadius,
    y1: source.y + uy * sourceRadius,
    x2: target.x - ux * targetRadius,
    y2: target.y - uy * targetRadius,
  };
}
