import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PALETTE_OPTIONS } from '../../lib/graphPalette';
import { clamp, NODE_EDIT_POPUP_HEIGHT, NODE_EDIT_POPUP_WIDTH, NodeEditState, VIEWPORT_PADDING } from './nodeEdit';
import {
  editApply,
  editCancel,
  editClose,
  editField,
  editFooter,
  editHeader,
  editInput,
  editLegend,
  editPopupClass,
  editTitle,
  preview,
  previewLabel,
  previewNodeClass,
  swatchClass,
  swatches,
} from './graphClasses';

interface NodeEditPopupProps {
  editState: NodeEditState;
  onClose: () => void;
  onSave: (id: string, label: string, color: string) => void;
}

/** Floating editor for a node's label and color. Draggable by its header; Apply saves, Cancel discards. */
export default function NodeEditPopup({ editState, onClose, onSave }: NodeEditPopupProps) {
  const [label, setLabel] = useState(editState.label);
  const [color, setColor] = useState(editState.color);
  const [position, setPosition] = useState({ x: editState.x, y: editState.y });
  const dragStateRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    setLabel(editState.label);
    setColor(editState.color);
    setPosition({ x: editState.x, y: editState.y });
  }, [editState]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.dragging) return;
      const maxX = window.innerWidth - NODE_EDIT_POPUP_WIDTH - VIEWPORT_PADDING;
      const maxY = window.innerHeight - NODE_EDIT_POPUP_HEIGHT - VIEWPORT_PADDING;
      setPosition({
        x: clamp(e.clientX - dragStateRef.current.offsetX, VIEWPORT_PADDING, maxX),
        y: clamp(e.clientY - dragStateRef.current.offsetY, VIEWPORT_PADDING, maxY),
      });
    };
    const handleMouseUp = () => {
      dragStateRef.current.dragging = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent<HTMLElement>) => {
    dragStateRef.current = {
      dragging: true,
      offsetX: e.clientX - position.x,
      offsetY: e.clientY - position.y,
    };
  };

  return (
    <div
      className={editPopupClass}
      role="dialog"
      aria-labelledby="node-edit-title"
      onClick={(e) => e.stopPropagation()}
      style={{ top: position.y, left: position.x }}
    >
      <header className={editHeader} onMouseDown={handleDragStart}>
        <h2 id="node-edit-title" className={editTitle}>Edit node</h2>
        <button
          type="button"
          className={editClose}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label="Close node editor"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </header>

      <label className={editField}>
        <span>Label</span>
        <input
          type="text"
          className={editInput}
          value={label}
          maxLength={64}
          autoFocus
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>

      <fieldset className={editField}>
        <legend className={editLegend}>Color</legend>
        <div className={swatches}>
          {PALETTE_OPTIONS.map((option) => {
            const selected = color === option;
            return (
              <button
                key={option}
                type="button"
                className={swatchClass(selected)}
                style={{ background: option }}
                onClick={() => setColor(option)}
                title={option}
                aria-label={`Use color ${option}`}
                aria-pressed={selected}
              />
            );
          })}
        </div>
      </fieldset>

      <div className={editField}>
        <span>Preview</span>
        <div className={preview}>
          <span className={previewNodeClass(editState.isCenter)} style={{ borderColor: color }}>
            <span className={previewLabel}>{label.trim() || 'Untitled node'}</span>
          </span>
        </div>
      </div>

      <footer className={editFooter}>
        <button type="button" className={editCancel} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={editApply}
          onClick={() => {
            onSave(editState.nodeId, label, color);
            onClose();
          }}
        >
          Apply
        </button>
      </footer>
    </div>
  );
}
