import React, { memo, useState } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { Pencil } from 'lucide-react';

// Node edit popup state interface
export interface NodeEditState {
  nodeId: string;
  label: string;
  color: string;
  x: number;
  y: number;
}

export const NODE_EDIT_POPUP_WIDTH = 220;
export const NODE_EDIT_POPUP_HEIGHT = 270;
export const VIEWPORT_PADDING = 12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface GraphNodeProps extends NodeProps {
  style?: React.CSSProperties;
  onEditRequest?: (edit: NodeEditState) => void;
}

const nodeStyles = {
  padding: '12px 20px',
  fontSize: '18px',
  fontWeight: '500' as const,
  textAlign: 'center' as const,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  letterSpacing: '0.5px',
  lineHeight: '1.3',
  width: '100%',
  height: '100%',
  margin: 0,
  boxSizing: 'border-box' as const,
  borderRadius: '24px',
};

const NodeTooltip = ({ content }: { content: string }) => {
  if (!content) return null;
  
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '13px',
        pointerEvents: 'none',
        zIndex: 1000,
        maxWidth: '250px',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        textAlign: 'left',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      }}
    >
      {content}
    </div>
  );
};

// Function to render confidence circles based on score
const renderConfidenceCircles = (confidenceScore: number | null) => {
  if (confidenceScore === null || confidenceScore === undefined) {
    return (
      <div style={{
        position: 'absolute',
        top: '6px',
        left: '6px',
        display: 'flex',
        gap: '3px',
        zIndex: 10,
      }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: '1.5px solid rgba(255, 255, 255, 0.7)',
            }}
          />
        ))}
      </div>
    );
  }

  let filledCircles = 0;
  if (confidenceScore > 0.7) {
    filledCircles = 3;
  } else if (confidenceScore > 0.4) {
    filledCircles = 2;
  } else if (confidenceScore > 0.0) {
    filledCircles = 1;
  } else {
    filledCircles = 0;
  }

  return (
    <div style={{
      position: 'absolute',
      top: '6px',
      left: '6px',
      display: 'flex',
      gap: '3px',
      zIndex: 10,
    }}>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: i <= filledCircles ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
            border: '1.5px solid rgba(255, 255, 255, 0.7)',
          }}
        />
      ))}
    </div>
  );
};

const pencilButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: '16px',
  bottom: '-11px',
  width: '20px',
  height: '20px',
  padding: 0,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#ffffff',
  border: '1px solid #d9dfe7',
  color: '#586476',
  cursor: 'pointer',
  zIndex: 11,
};

export const GraphNode = memo((props: GraphNodeProps) => {
  const { data, style = {}, id, onEditRequest } = props;
  const [showTooltip, setShowTooltip] = useState(false);

  const truncateText = (text: string) => {
    if (!text) return '';
    if (text.length <= 30) return text;
    return text.substring(0, 30) + '...';
  };

  const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Keep this click from reaching React Flow's onNodeClick (path highlight)
    // and the window listener that closes the popup
    e.stopPropagation();
    // Place the popup above the pencil, or below it if there's no room
    const rect = e.currentTarget.getBoundingClientRect();
    const preferredX = rect.left + rect.width / 2 - NODE_EDIT_POPUP_WIDTH / 2;
    const preferredYAbove = rect.top - NODE_EDIT_POPUP_HEIGHT - 12;
    const preferredYBelow = rect.bottom + 12;
    // Keep the popup inside the graph panel horizontally so it doesn't cover the chat/quiz panel.
    // Falls back to the window edges if the panel is narrower than the popup.
    const panel = e.currentTarget.closest('.react-flow')?.getBoundingClientRect();
    const fitsInPanel = panel && panel.width >= NODE_EDIT_POPUP_WIDTH + 2 * VIEWPORT_PADDING;
    const minX = fitsInPanel ? panel.left + VIEWPORT_PADDING : VIEWPORT_PADDING;
    const maxX = fitsInPanel
      ? panel.right - NODE_EDIT_POPUP_WIDTH - VIEWPORT_PADDING
      : window.innerWidth - NODE_EDIT_POPUP_WIDTH - VIEWPORT_PADDING;
    const maxY = window.innerHeight - NODE_EDIT_POPUP_HEIGHT - VIEWPORT_PADDING;
    const x = clamp(preferredX, minX, maxX);
    const y = clamp(preferredYAbove > VIEWPORT_PADDING ? preferredYAbove : preferredYBelow, VIEWPORT_PADDING, maxY);
    onEditRequest?.({
      nodeId: id,
      label: data.label,
      color: (style.background as string | undefined) || '#3b82f6',
      x,
      y,
    });
  };

  return (
    <>
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: '#555', width: '8px', height: '8px', top: '-4px' }} 
      />
      <div
        style={{
          ...nodeStyles,
          ...style,
          position: 'relative',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {renderConfidenceCircles(data.confidenceScore)}
        {data.customLabel || truncateText(data.label)}
        <button
          type="button"
          className="nodrag nopan"
          style={pencilButtonStyle}
          onClick={handleEditClick}
          title="Edit node"
          aria-label="Edit node"
        >
          <Pencil size={12} />
        </button>
      </div>
      {showTooltip && !data.customLabel && <NodeTooltip content={data.description} />}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: '#555', width: '8px', height: '8px', bottom: '-4px' }} 
      />
    </>
  );
});
