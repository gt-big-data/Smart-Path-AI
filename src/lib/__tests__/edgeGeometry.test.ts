import { circleEdgeSegment } from '../edgeGeometry';

describe('circleEdgeSegment', () => {
  it('runs from the source disc edge to the target disc edge on a horizontal line', () => {
    const segment = circleEdgeSegment({ x: 0, y: 0 }, 10, { x: 100, y: 0 }, 20);
    expect(segment).toEqual({ x1: 10, y1: 0, x2: 80, y2: 0 });
  });

  it('trims both ends along the diagonal direction', () => {
    // Distance 50, unit vector (0.6, 0.8)
    const segment = circleEdgeSegment({ x: 0, y: 0 }, 5, { x: 30, y: 40 }, 5);
    expect(segment!.x1).toBeCloseTo(3);
    expect(segment!.y1).toBeCloseTo(4);
    expect(segment!.x2).toBeCloseTo(27);
    expect(segment!.y2).toBeCloseTo(36);
  });

  it('returns null when the discs overlap', () => {
    expect(circleEdgeSegment({ x: 0, y: 0 }, 30, { x: 40, y: 0 }, 30)).toBeNull();
  });

  it('returns null when the centres coincide', () => {
    expect(circleEdgeSegment({ x: 5, y: 5 }, 0, { x: 5, y: 5 }, 0)).toBeNull();
  });
});
