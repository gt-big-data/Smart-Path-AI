import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

const DEFAULT_SIDEBAR_WIDTH = 244;
const MIN_SIDEBAR_WIDTH = 210;
const MAX_SIDEBAR_WIDTH = 420;

/** Drag-to-resize state for the sidebar's right edge */
export function useSidebarResize() {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleStartSidebarResize = (event: ReactMouseEvent) => {
    event.preventDefault();
    setIsResizingSidebar(true);
    resizeStartRef.current = { startX: event.clientX, startWidth: sidebarWidth };
  };

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (event: MouseEvent) => {
      const resizeStart = resizeStartRef.current;
      if (!resizeStart) return;
      const nextWidth = resizeStart.startWidth + event.clientX - resizeStart.startX;
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, nextWidth)));
    };
    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      resizeStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, sidebarWidth]);

  return { sidebarWidth, isResizingSidebar, handleStartSidebarResize };
}
