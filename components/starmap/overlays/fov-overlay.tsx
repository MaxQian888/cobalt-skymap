'use client';

import { useRef, useEffect, useState } from 'react';
import { RotateCw, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { FOVOverlayProps } from '@/types/starmap/overlays';
import {
  calculateOverlayDimensions,
  calculateMosaicLayout,
} from '@/lib/astronomy/fov-calculations';

export function FOVOverlay({
  enabled,
  sensorWidth,
  sensorHeight,
  focalLength,
  currentFov,
  rotationAngle,
  onRotationChange,
  mosaic,
  pixelSize,
  framePlacement = { x: 0, y: 0 },
  onFramePlacementChange,
  dragToPosition = false,
  gridType = 'crosshair',
  frameColor = '#3b82f6',
  frameStyle = 'solid',
  overlayOpacity = 80,
}: FOVOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);

  if (!enabled) return <div ref={containerRef} className="absolute inset-0 pointer-events-none" />;

  // Calculate overlay dimensions using extracted utility
  const dims = calculateOverlayDimensions(
    sensorWidth, sensorHeight, focalLength, currentFov,
    containerSize.width, containerSize.height, mosaic, pixelSize
  );
  const {
    isTooLarge, scaledPanelWidth, scaledPanelHeight,
    scaledStepX, scaledStepY, scaledTotalWidth, scaledTotalHeight,
    cameraFovWidth, cameraFovHeight,
  } = dims;
  const availableOffsetX = Math.max((containerSize.width - scaledTotalWidth) / 2, 0);
  const availableOffsetY = Math.max((containerSize.height - scaledTotalHeight) / 2, 0);
  const translateX = availableOffsetX * framePlacement.x;
  const translateY = availableOffsetY * framePlacement.y;

  const mosaicCols = mosaic.enabled ? mosaic.cols : 1;
  const mosaicRows = mosaic.enabled ? mosaic.rows : 1;

  // Generate mosaic panel positions
  const panels = calculateMosaicLayout(
    scaledPanelWidth, scaledPanelHeight,
    scaledStepX, scaledStepY,
    mosaicCols, mosaicRows
  );

  const handleFrameDragStart = (
    startClientX: number,
    startClientY: number
  ) => {
    if (!dragToPosition || !onFramePlacementChange) return;

    const startPlacement = framePlacement;

    const handlePointerMove = (clientX: number, clientY: number) => {
      const nextPlacement = {
        x: availableOffsetX > 0 ? startPlacement.x + (clientX - startClientX) / availableOffsetX : 0,
        y: availableOffsetY > 0 ? startPlacement.y + (clientY - startClientY) / availableOffsetY : 0,
      };
      onFramePlacementChange(nextPlacement);
    };

    const handleMouseMove = (event: MouseEvent) => {
      handlePointerMove(event.clientX, event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      handlePointerMove(touch.clientX, touch.clientY);
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', cleanup);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', cleanup);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', cleanup);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', cleanup);
  };

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {isTooLarge ? (
        // Show warning when FOV is larger than view
        <Alert className="bg-black/70 backdrop-blur-sm border-yellow-500/50 w-auto max-w-xs">
          <AlertTriangle className="h-4 w-4 text-yellow-400" />
          <AlertDescription className="text-xs text-yellow-400">
            Camera FOV ({cameraFovWidth.toFixed(1)}° × {cameraFovHeight.toFixed(1)}°) is larger than current view
          </AlertDescription>
        </Alert>
      ) : (
        <div
          data-testid="fov-overlay-frame"
          className="relative transition-transform duration-100"
          style={{
            width: `${scaledTotalWidth}px`,
            height: `${scaledTotalHeight}px`,
            transform: `translate(${translateX}px, ${translateY}px) rotate(${rotationAngle}deg)`,
            opacity: overlayOpacity / 100,
            pointerEvents: dragToPosition || !!onRotationChange ? 'auto' : 'none',
          }}
          onMouseDown={(event) => {
            if (!dragToPosition) return;
            if ((event.target as HTMLElement).closest('[data-rotation-handle="true"]')) return;
            event.preventDefault();
            handleFrameDragStart(event.clientX, event.clientY);
          }}
          onTouchStart={(event) => {
            if (!dragToPosition) return;
            if ((event.target as HTMLElement).closest('[data-rotation-handle="true"]')) return;
            event.preventDefault();
            const touch = event.touches[0];
            if (!touch) return;
            handleFrameDragStart(touch.clientX, touch.clientY);
          }}
        >
          {/* Mosaic Panels */}
          {panels.map((panel, idx) => (
            <div
              key={idx}
              className="absolute border-2 transition-colors"
              style={{
                left: `${panel.x}px`,
                top: `${panel.y}px`,
                width: `${scaledPanelWidth}px`,
                height: `${scaledPanelHeight}px`,
                borderColor: panel.isCenter ? frameColor : `${frameColor}80`,
                backgroundColor: panel.isCenter ? `${frameColor}1A` : `${frameColor}0D`,
                borderStyle: frameStyle,
                boxShadow: panel.isCenter ? `0 0 15px ${frameColor}4D` : 'none',
              }}
            >
              {/* Corner markers for each panel */}
              <div className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2" style={{ borderColor: `${frameColor}99` }} />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2" style={{ borderColor: `${frameColor}99` }} />
              <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2" style={{ borderColor: `${frameColor}99` }} />
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2" style={{ borderColor: `${frameColor}99` }} />
              
              {/* Panel number label */}
              {mosaic.enabled && (mosaicCols > 1 || mosaicRows > 1) && (
                <div className="absolute top-1 left-1 text-[10px] font-mono" style={{ color: `${frameColor}B3` }}>
                  {idx + 1}
                </div>
              )}
              
              {/* Grid overlays */}
              {panel.isCenter && gridType !== 'none' && (
                <>
                  {/* Crosshair - always show center cross */}
                  {(gridType === 'crosshair' || gridType === 'thirds' || gridType === 'golden') && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="w-4 h-0.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: `${frameColor}99` }} />
                      <div className="h-4 w-0.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: `${frameColor}99` }} />
                    </div>
                  )}
                  
                  {/* Rule of Thirds */}
                  {gridType === 'thirds' && (
                    <>
                      <div className="absolute top-1/3 left-0 right-0 h-px" style={{ backgroundColor: `${frameColor}4D` }} />
                      <div className="absolute top-2/3 left-0 right-0 h-px" style={{ backgroundColor: `${frameColor}4D` }} />
                      <div className="absolute left-1/3 top-0 bottom-0 w-px" style={{ backgroundColor: `${frameColor}4D` }} />
                      <div className="absolute left-2/3 top-0 bottom-0 w-px" style={{ backgroundColor: `${frameColor}4D` }} />
                      {/* Intersection points */}
                      <div className="absolute top-1/3 left-1/3 w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: `${frameColor}80` }} />
                      <div className="absolute top-1/3 left-2/3 w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: `${frameColor}80` }} />
                      <div className="absolute top-2/3 left-1/3 w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: `${frameColor}80` }} />
                      <div className="absolute top-2/3 left-2/3 w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: `${frameColor}80` }} />
                    </>
                  )}
                  
                  {/* Golden Ratio (phi ≈ 0.618) */}
                  {gridType === 'golden' && (
                    <>
                      <div className="absolute h-px" style={{ top: '38.2%', left: 0, right: 0, backgroundColor: `${frameColor}4D` }} />
                      <div className="absolute h-px" style={{ top: '61.8%', left: 0, right: 0, backgroundColor: `${frameColor}4D` }} />
                      <div className="absolute w-px" style={{ left: '38.2%', top: 0, bottom: 0, backgroundColor: `${frameColor}4D` }} />
                      <div className="absolute w-px" style={{ left: '61.8%', top: 0, bottom: 0, backgroundColor: `${frameColor}4D` }} />
                      {/* Golden spiral approximation points */}
                      <div className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ top: '38.2%', left: '38.2%', backgroundColor: `${frameColor}80` }} />
                      <div className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ top: '38.2%', left: '61.8%', backgroundColor: `${frameColor}80` }} />
                      <div className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ top: '61.8%', left: '38.2%', backgroundColor: `${frameColor}80` }} />
                      <div className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ top: '61.8%', left: '61.8%', backgroundColor: `${frameColor}80` }} />
                    </>
                  )}
                  
                  {/* Diagonal lines */}
                  {gridType === 'diagonal' && (
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                      <line x1="0" y1="0" x2="100%" y2="100%" stroke={`${frameColor}4D`} strokeWidth="1" />
                      <line x1="100%" y1="0" x2="0" y2="100%" stroke={`${frameColor}4D`} strokeWidth="1" />
                      {/* Center point */}
                      <circle cx="50%" cy="50%" r="3" fill={`${frameColor}80`} />
                    </svg>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Rotation handle */}
          {onRotationChange && (
            <div
              data-rotation-handle="true"
              className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-auto cursor-grab active:cursor-grabbing touch-none"
              onMouseDown={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                if (!rect) return;
                
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const dx = moveEvent.clientX - centerX;
                  const dy = moveEvent.clientY - centerY;
                  const angle = Math.atan2(dx, -dy) * (180 / Math.PI);
                  onRotationChange(Math.round(angle));
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                if (!rect) return;
                
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                const handleTouchMove = (moveEvent: TouchEvent) => {
                  const touch = moveEvent.touches[0];
                  if (!touch) return;
                  const dx = touch.clientX - centerX;
                  const dy = touch.clientY - centerY;
                  const angle = Math.atan2(dx, -dy) * (180 / Math.PI);
                  onRotationChange(Math.round(angle));
                };
                
                const handleTouchEnd = () => {
                  document.removeEventListener('touchmove', handleTouchMove);
                  document.removeEventListener('touchend', handleTouchEnd);
                };
                
                document.addEventListener('touchmove', handleTouchMove, { passive: false });
                document.addEventListener('touchend', handleTouchEnd);
              }}
            >
              <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: frameColor }}>
                <RotateCw className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
          )}

          {/* FOV label */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap bg-background/70 px-2 py-1 rounded flex items-center gap-2" style={{ color: frameColor }}>
            {mosaic.enabled && (mosaicCols > 1 || mosaicRows > 1) ? (
              <span>{mosaicCols}×{mosaicRows} @ {cameraFovWidth.toFixed(1)}°×{cameraFovHeight.toFixed(1)}°</span>
            ) : (
              <span>{cameraFovWidth.toFixed(1)}° × {cameraFovHeight.toFixed(1)}°</span>
            )}
            {rotationAngle !== 0 && (
              <span className="text-primary/80">({rotationAngle}°)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

