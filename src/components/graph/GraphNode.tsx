import React, { memo, useState } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { Pencil } from 'lucide-react';
import { clamp, NODE_EDIT_POPUP_HEIGHT, NODE_EDIT_POPUP_WIDTH, NodeEditState, VIEWPORT_PADDING } from './nodeEdit';
import {
  collapseBadgeClass,
  dotBorderClass,
  dotsClass,
  faceClass,
  rimEditClass,
  rimPosition,
  stepClass,
  tooltipClass,
} from './graphClasses';

interface GraphNodeProps extends NodeProps {
  onEditRequest?: (edit: NodeEditState) => void;
  onToggleCollapse?: (nodeId: string) => void;
}

const LABEL_MAX_CHARS = 30;
const DOT_COUNT = 3;

/** Filled confidence dots (0-3) for a 0-1 score, or null when the concept has no score yet */
function filledDotsFor(score: number | null | undefined): number | null {
  if (score === null || score === undefined) return null;
  if (score > 0.7) return 3;
  if (score > 0.4) return 2;
  if (score > 0) return 1;
  return 0;
}

const truncate = (text: string) => (text.length <= LABEL_MAX_CHARS ? text : `${text.substring(0, LABEL_MAX_CHARS)}...`);

/** A graph node: a white disc with its label, confidence dots, path step and edit button */
export const GraphNode = memo(function GraphNode({ id, data, onEditRequest, onToggleCollapse }: GraphNodeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const label: string = data.customLabel || data.label;
  const filled = filledDotsFor(data.confidenceScore);
  const dotFill = data.isCenter ? '#ffffff' : '#147d74';

  const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Keep this click from reaching React Flow's onNodeClick (path highlight)
    // and the window listener that closes the popup
    e.stopPropagation();

    // Place the popup above the pencil, or below it if there's no room
    const rect = e.currentTarget.getBoundingClientRect();
    const preferredX = rect.left + rect.width / 2 - NODE_EDIT_POPUP_WIDTH / 2;
    const preferredYAbove = rect.top - NODE_EDIT_POPUP_HEIGHT - 12;
    const preferredYBelow = rect.bottom + 12;

    // Keep the popup inside the graph panel horizontally, falling back to the window edges
    const panel = e.currentTarget.closest('.react-flow')?.getBoundingClientRect();
    const fitsInPanel = panel && panel.width >= NODE_EDIT_POPUP_WIDTH + 2 * VIEWPORT_PADDING;
    const minX = fitsInPanel ? panel.left + VIEWPORT_PADDING : VIEWPORT_PADDING;
    const maxX = fitsInPanel
      ? panel.right - NODE_EDIT_POPUP_WIDTH - VIEWPORT_PADDING
      : window.innerWidth - NODE_EDIT_POPUP_WIDTH - VIEWPORT_PADDING;
    const maxY = window.innerHeight - NODE_EDIT_POPUP_HEIGHT - VIEWPORT_PADDING;

    onEditRequest?.({
      nodeId: id,
      label,
      isCenter: Boolean(data.isCenter),
      color: data.color || '#3b82f6',
      x: clamp(preferredX, minX, maxX),
      y: clamp(preferredYAbove > VIEWPORT_PADDING ? preferredYAbove : preferredYBelow, VIEWPORT_PADDING, maxY),
    });
  };

  const isCollapsed = data.hiddenCount > 0;
  const collapseLabel = isCollapsed ? `Expand branch (${data.hiddenCount} hidden)` : 'Collapse branch';

  const handleCollapseClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Keep this click from reaching React Flow's onNodeClick (path highlight and selection)
    e.stopPropagation();
    onToggleCollapse?.(id);
  };

  // React Flow selects the node on Enter or Space; the button's own click does the toggling
  const handleCollapseKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
  };

  const confidenceLabel = filled === null
    ? 'No confidence score yet'
    : `Confidence ${Math.round(data.confidenceScore * 100)}%`;

  return (
    <>
      <Handle type="target" position={Position.Top} className="nodrag nopan" />
      <div
        className={faceClass(Boolean(data.isCenter))}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className={dotsClass} role="img" aria-label={confidenceLabel}>
          {Array.from({ length: DOT_COUNT }, (_, i) => (
            <span
              key={i}
              className={dotBorderClass(Boolean(data.isCenter), filled === null)}
              style={{ background: filled !== null && i < filled ? dotFill : 'transparent' }}
            />
          ))}
        </span>
        {data.customLabel || truncate(data.label)}
      </div>
      {/* Rim buttons sit outside the face, which clips to the disc, so they can sit on its border */}
      {data.pathStep != null && (
        <span className={`${stepClass} ${rimPosition.topLeft}`} aria-label={`Path step ${data.pathStep}`}>
          {data.pathStep}
        </span>
      )}
      {data.collapsible && (
        <button
          type="button"
          className={`${collapseBadgeClass(isCollapsed)} ${rimPosition.topRight} nodrag nopan`}
          onClick={handleCollapseClick}
          onKeyDown={handleCollapseKeyDown}
          title={collapseLabel}
          aria-label={collapseLabel}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? `+${data.hiddenCount}` : '−'}
        </button>
      )}
      <button
        type="button"
        className={`${rimEditClass} ${rimPosition.bottomRight} nodrag nopan`}
        onClick={handleEditClick}
        title="Edit node"
        aria-label="Edit node"
      >
        <Pencil size={14} strokeWidth={3} aria-hidden="true" />
      </button>
      {showTooltip && !data.customLabel && data.description && (
        <div className={tooltipClass} role="tooltip">{data.description}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="nodrag nopan" />
    </>
  );
});
