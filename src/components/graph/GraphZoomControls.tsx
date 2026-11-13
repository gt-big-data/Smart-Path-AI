import { Crosshair, Lock, Minus, Plus, Unlock } from 'lucide-react';
import { zoomButtonClass, zoomControlsClass } from './graphClasses';

interface GraphZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  minimapLocked: boolean;
  onToggleMinimapLock: () => void;
}

/** Stacked zoom, reset, and minimap lock controls, top right of the graph */
export default function GraphZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
  minimapLocked,
  onToggleMinimapLock,
}: GraphZoomControlsProps) {
  return (
    <div className={zoomControlsClass}>
      <button type="button" className={zoomButtonClass(false)} aria-label="Zoom in" onClick={onZoomIn}>
        <Plus size={14} />
      </button>
      <button type="button" className={zoomButtonClass(false)} aria-label="Zoom out" onClick={onZoomOut}>
        <Minus size={14} />
      </button>
      <button type="button" className={zoomButtonClass(false)} aria-label="Reset graph view" onClick={onReset}>
        <Crosshair size={14} />
      </button>
      <button
        type="button"
        className={zoomButtonClass(minimapLocked)}
        aria-label={minimapLocked ? 'Unlock minimap' : 'Lock minimap'}
        aria-pressed={minimapLocked}
        title={minimapLocked ? 'Unlock minimap' : 'Lock minimap'}
        onClick={onToggleMinimapLock}
      >
        {minimapLocked ? <Lock size={13} /> : <Unlock size={13} />}
      </button>
    </div>
  );
}
