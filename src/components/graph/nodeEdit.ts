/** Node editor popup state and layout constants, shared by the node and the popup */
export interface NodeEditState {
  nodeId: string;
  label: string;
  color: string;
  /** The center node is painted solid in the preview, others show their colour as a border */
  isCenter: boolean;
  x: number;
  y: number;
}

export const NODE_EDIT_POPUP_WIDTH = 286;
export const NODE_EDIT_POPUP_HEIGHT = 380;
export const VIEWPORT_PADDING = 12;

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
