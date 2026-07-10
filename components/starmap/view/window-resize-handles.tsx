'use client';

import { type MouseEvent as ReactMouseEvent } from 'react';
import { useWindowControls } from '@/lib/hooks/use-window-controls';
import type { WindowResizeDirection } from '@/lib/tauri/app-control-api';

interface ResizeHandleSpec {
  dir: WindowResizeDirection;
  className: string;
}

// Invisible edge/corner handles. Edges are thin strips; corners are larger and
// stack above the edges so the diagonal cursor wins in the shared region.
const EDGE_HANDLES: ResizeHandleSpec[] = [
  { dir: 'North', className: 'top-0 left-0 right-0 h-[5px] cursor-ns-resize' },
  { dir: 'South', className: 'bottom-0 left-0 right-0 h-[5px] cursor-ns-resize' },
  { dir: 'West', className: 'top-0 bottom-0 left-0 w-[5px] cursor-ew-resize' },
  { dir: 'East', className: 'top-0 bottom-0 right-0 w-[5px] cursor-ew-resize' },
];

const CORNER_HANDLES: ResizeHandleSpec[] = [
  { dir: 'NorthWest', className: 'top-0 left-0 h-3 w-3 cursor-nwse-resize' },
  { dir: 'NorthEast', className: 'top-0 right-0 h-3 w-3 cursor-nesw-resize' },
  { dir: 'SouthWest', className: 'bottom-0 left-0 h-3 w-3 cursor-nesw-resize' },
  { dir: 'SouthEast', className: 'bottom-0 right-0 h-3 w-3 cursor-nwse-resize' },
];

/**
 * Frameless-window resize affordance.
 *
 * Tauri windows created with `decorations: false` lose the OS resize border, so
 * this paints invisible edge/corner strips pinned to the viewport that trigger
 * an interactive OS-level resize drag on mousedown. Rendered only for the custom
 * frameless shell (Windows/Linux); macOS keeps native decorations + edges, and
 * resize is disabled while maximized/fullscreen.
 */
export function WindowResizeHandles() {
  const { isTauriEnv, shell, isMaximized, isFullscreen, handleStartWindowResize } =
    useWindowControls();

  if (
    !isTauriEnv ||
    shell.mode !== 'custom-frameless' ||
    !shell.supportsManualDragging ||
    isMaximized ||
    isFullscreen
  ) {
    return null;
  }

  const handleMouseDown =
    (dir: WindowResizeDirection) => (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      void handleStartWindowResize(dir);
    };

  return (
    <div
      data-testid="window-resize-handles"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
    >
      {EDGE_HANDLES.map((handle) => (
        <div
          key={handle.dir}
          className={`pointer-events-auto absolute ${handle.className}`}
          onMouseDown={handleMouseDown(handle.dir)}
        />
      ))}
      {CORNER_HANDLES.map((handle) => (
        <div
          key={handle.dir}
          className={`pointer-events-auto absolute z-[61] ${handle.className}`}
          onMouseDown={handleMouseDown(handle.dir)}
        />
      ))}
    </div>
  );
}
