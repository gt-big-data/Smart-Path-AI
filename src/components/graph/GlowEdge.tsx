import { memo } from 'react';
import { EdgeProps, EdgeText, useStore } from 'reactflow';
import { circleEdgeSegment } from '../../lib/edgeGeometry';
import { DEFAULT_EDGE_COLOR } from '../../lib/graphStyles';

/*
 * Straight edge between two node discs, drawn from one disc's boundary to the other's.
 * Path edges also carry a pulse: soft blobs travel outward along the solid line, separated by gaps.
 * The label is drawn last, so the pulse never covers it.
 */

// One blob then one gap. GLOW_LENGTH + GLOW_GAP is the travel period; graph-flow.css moves the
// pattern by the same amount (-150px) so each loop lines up with the next.
const GLOW_LENGTH = 44;
const GLOW_GAP = 106;
const GLOW_DASH = `${GLOW_LENGTH} ${GLOW_GAP}`;

// Two layers per blob: a wide blurred halo and a tighter, brighter core
const HALO = { width: 12, blur: 4, opacity: 0.45 };
const CORE = { width: 4, blur: 1.5, opacity: 0.95 };

// Room around the line for the blur, so it isn't clipped on a flat (zero-height) edge
const FILTER_MARGIN = 40;
// Invisible stroke around the line so hovering it still shows the relation label
const HIT_AREA_WIDTH = 20;

const toFilterId = (edgeId: string) => `graph-glow-${edgeId.replace(/[^A-Za-z0-9_-]/g, '_')}`;

export const GlowEdge = memo(function GlowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  data,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  // Handles sit at the disc centres, so the edge endpoints are the centres; the disc radius trims them
  const sourceRadius = useStore((s) => (s.nodeInternals.get(source)?.width ?? 0) / 2);
  const targetRadius = useStore((s) => (s.nodeInternals.get(target)?.width ?? 0) / 2);

  const segment = circleEdgeSegment(
    { x: sourceX, y: sourceY },
    sourceRadius,
    { x: targetX, y: targetY },
    targetRadius
  );
  if (!segment) return null;

  const { opacity, ...pathStyle } = style ?? {};
  const onPath = Boolean(data?.onPath);
  const pulseColor = typeof pathStyle.stroke === 'string' ? pathStyle.stroke : DEFAULT_EDGE_COLOR;
  // The pulse runs along the path from the start of the segment, so a reversed edge is drawn from its far end
  const { x1, y1, x2, y2 } = data?.reversed
    ? { x1: segment.x2, y1: segment.y2, x2: segment.x1, y2: segment.y1 }
    : segment;
  const d = `M ${x1} ${y1} L ${x2} ${y2}`;
  const haloFilterId = toFilterId(`${id}-halo`);
  const coreFilterId = toFilterId(`${id}-core`);
  const filterBounds = {
    x: Math.min(x1, x2) - FILTER_MARGIN,
    y: Math.min(y1, y2) - FILTER_MARGIN,
    width: Math.abs(x2 - x1) + FILTER_MARGIN * 2,
    height: Math.abs(y2 - y1) + FILTER_MARGIN * 2,
  };

  return (
    <g opacity={opacity}>
      <path d={d} fill="none" style={pathStyle} className="react-flow__edge-path" />
      {onPath && (
        <>
          <defs>
            <filter id={haloFilterId} filterUnits="userSpaceOnUse" {...filterBounds}>
              <feGaussianBlur in="SourceGraphic" stdDeviation={HALO.blur} />
            </filter>
            <filter id={coreFilterId} filterUnits="userSpaceOnUse" {...filterBounds}>
              <feGaussianBlur in="SourceGraphic" stdDeviation={CORE.blur} />
            </filter>
          </defs>
          <path
            d={d}
            fill="none"
            stroke={pulseColor}
            strokeWidth={HALO.width}
            strokeLinecap="round"
            strokeDasharray={GLOW_DASH}
            opacity={HALO.opacity}
            filter={`url(#${haloFilterId})`}
            className="graph-edge-pulse"
          />
          <path
            d={d}
            fill="none"
            stroke={pulseColor}
            strokeWidth={CORE.width}
            strokeLinecap="round"
            strokeDasharray={GLOW_DASH}
            opacity={CORE.opacity}
            filter={`url(#${coreFilterId})`}
            className="graph-edge-pulse"
          />
        </>
      )}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_AREA_WIDTH}
        className="react-flow__edge-interaction"
      />
      {label && (
        <EdgeText
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2}
          label={label}
          labelStyle={labelStyle}
          labelShowBg={labelShowBg}
          labelBgStyle={labelBgStyle}
          labelBgPadding={labelBgPadding}
          labelBgBorderRadius={labelBgBorderRadius}
        />
      )}
    </g>
  );
});
