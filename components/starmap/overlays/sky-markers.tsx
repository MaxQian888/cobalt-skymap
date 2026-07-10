'use client';

import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useMarkerStore, useStellariumStore, type SkyMarker } from '@/lib/stores';
import { useBatchProjection } from '@/lib/hooks';
import { useMarkerDrag, type MarkerDragHandlers } from '@/lib/hooks/use-marker-drag';
import { screenToRaDec } from '@/lib/core/screen-to-radec';
import { edgeIndicatorPosition, selectIndicators } from '@/lib/core/offscreen-indicator';
import { computeVisibleLabels } from '@/lib/core/label-collision';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import { MarkerIconDisplay } from '@/lib/constants/marker-icons';
import type { SkyMarkersProps } from '@/types/starmap/overlays';
import {
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Navigation,
  Move,
  ChevronUp,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuLabel,
} from '@/components/ui/context-menu';

export function SkyMarkers({
  containerWidth,
  containerHeight,
  interactionOnly = false,
  onMarkerClick,
  onMarkerDoubleClick,
  onMarkerEdit,
  onMarkerDelete,
  onMarkerNavigate,
}: SkyMarkersProps) {
  const t = useTranslations();
  const markers = useMarkerStore((state) => state.markers);
  const groupVisibility = useMarkerStore((state) => state.groupVisibility);
  const showMarkers = useMarkerStore((state) => state.showMarkers);
  const showLabels = useMarkerStore((state) => state.showLabels);
  const globalMarkerSize = useMarkerStore((state) => state.globalMarkerSize);
  const activeMarkerId = useMarkerStore((state) => state.activeMarkerId);
  const setActiveMarker = useMarkerStore((state) => state.setActiveMarker);
  const toggleMarkerVisibility = useMarkerStore((state) => state.toggleMarkerVisibility);
  const removeMarker = useMarkerStore((state) => state.removeMarker);
  const movingMarkerId = useMarkerStore((state) => state.movingMarkerId);
  const setMovingMarker = useMarkerStore((state) => state.setMovingMarker);
  const updateMarker = useMarkerStore((state) => state.updateMarker);
  const showOffscreenIndicators = useMarkerStore((state) => state.showOffscreenIndicators);

  // Live preview position (screen px) while a marker is in move mode.
  const [movePreview, setMovePreview] = useState<{ x: number; y: number } | null>(null);

  const movingMarker = useMemo(
    () => (movingMarkerId ? markers.find((m) => m.id === movingMarkerId) ?? null : null),
    [markers, movingMarkerId],
  );

  // Clear the live preview during render when move mode ends, instead of
  // mirroring it in an effect (see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [prevMovingMarkerId, setPrevMovingMarkerId] = useState(movingMarkerId);
  if (movingMarkerId !== prevMovingMarkerId) {
    setPrevMovingMarkerId(movingMarkerId);
    if (!movingMarkerId) {
      setMovePreview(null);
    }
  }

  // Escape cancels move mode.
  useEffect(() => {
    if (!movingMarkerId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMovingMarker(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movingMarkerId, setMovingMarker]);

  const enterMoveMode = useCallback((marker: SkyMarker) => {
    setMovingMarker(marker.id);
    toast.info(t('markers.movingHint'));
  }, [setMovingMarker, t]);

  const commitMove = useCallback((clientX: number, clientY: number, overlayEl: HTMLElement) => {
    if (!movingMarkerId) return;
    const stel = useStellariumStore.getState().stel;
    if (!stel) {
      setMovingMarker(null);
      return;
    }
    const rect = overlayEl.getBoundingClientRect();
    const coords = screenToRaDec(stel, clientX - rect.left, clientY - rect.top, rect.width, rect.height);
    if (coords) {
      updateMarker(movingMarkerId, {
        ra: coords.ra,
        dec: coords.dec,
        raString: degreesToHMS(coords.ra),
        decString: degreesToDMS(coords.dec),
      });
      toast.success(t('markers.markerMoved'));
    }
    setMovingMarker(null);
  }, [movingMarkerId, setMovingMarker, updateMarker, t]);

  // Compute visible markers with useMemo to avoid creating new array on each render
  const visibleMarkers = useMemo(() => {
    if (!showMarkers) return [];
    return markers.filter((m) => {
      if (!m.visible) return false;
      const group = m.group?.trim() || 'Default';
      return groupVisibility[group] ?? true;
    });
  }, [markers, showMarkers, groupVisibility]);

  // Use unified batch projection hook for coordinate conversion.
  // Adaptive mode: full frame-rate tracking while the view moves (no trailing
  // during fast pans), zero reprojection cost while the view is static.
  const wantOffscreenIndicators = showOffscreenIndicators && !interactionOnly;

  const projectedMarkers = useBatchProjection({
    containerWidth,
    containerHeight,
    items: visibleMarkers,
    getRa: (marker) => marker.ra,
    getDec: (marker) => marker.dec,
    enabled: showMarkers,
    intervalMs: 0,
    adaptive: true,
    includeOffscreen: wantOffscreenIndicators,
    loopId: 'sky-markers',
  });

  // Map projected items to marker positions for rendering
  const renderableMarkers = useMemo(() => {
    return projectedMarkers
      .filter((p) => p.visible)
      .map((p) => ({
        marker: p.item,
        x: p.x,
        y: p.y,
        visible: p.visible,
      }));
  }, [projectedMarkers]);

  // Edge chevrons pointing at the nearest off-screen markers (Stellarium only;
  // Aladin projections never carry a direction).
  const offscreenIndicators = useMemo(() => {
    if (!wantOffscreenIndicators) return [];
    const candidates = projectedMarkers
      .filter((p) => !p.visible && p.dir)
      .map((p) => ({ item: p.item, dir: p.dir! }));
    return selectIndicators(candidates, 8)
      .map(({ item, dir }) => {
        const placement = edgeIndicatorPosition(dir.dx, dir.dy, containerWidth, containerHeight);
        return placement ? { marker: item, ...placement } : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [wantOffscreenIndicators, projectedMarkers, containerWidth, containerHeight]);

  // Label anti-collision: hide labels whose estimated boxes overlap a
  // higher-priority one (active marker first, then recency). Recomputed only
  // when the projection updates.
  const visibleLabelIds = useMemo(() => {
    if (!showLabels) return null;
    return computeVisibleLabels(
      renderableMarkers.map(({ marker, x, y }) => ({
        id: marker.id,
        x,
        y,
        text: marker.name,
        fontSize: Math.max(10, (marker.size || globalMarkerSize) * 0.55),
        iconSize: marker.size || globalMarkerSize,
        priority: marker.id === activeMarkerId ? Number.POSITIVE_INFINITY : marker.updatedAt,
      })),
    );
  }, [showLabels, renderableMarkers, globalMarkerSize, activeMarkerId]);

  // Marker action handlers (accept marker directly, no shared state needed)
  const handleEdit = useCallback((marker: SkyMarker) => {
    onMarkerEdit?.(marker);
  }, [onMarkerEdit]);

  const handleDelete = useCallback((marker: SkyMarker) => {
    if (onMarkerDelete) {
      onMarkerDelete(marker);
    } else {
      removeMarker(marker.id);
    }
  }, [onMarkerDelete, removeMarker]);

  const handleNavigate = useCallback((marker: SkyMarker) => {
    setActiveMarker(marker.id);
    onMarkerNavigate?.(marker);
  }, [onMarkerNavigate, setActiveMarker]);

  const handleToggleVisibility = useCallback((marker: SkyMarker) => {
    toggleMarkerVisibility(marker.id);
  }, [toggleMarkerVisibility]);

  if (renderableMarkers.length === 0 && offscreenIndicators.length === 0 && !movingMarker) {
    return null;
  }

  return (
    // z-10: explicitly above the canvas, below panels/toolbars (z-30/40/50).
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
      {renderableMarkers.map(({ marker, x, y }) => (
        <MarkerItem
          key={marker.id}
          marker={marker}
          x={x}
          y={y}
          isActive={marker.id === activeMarkerId}
          isMoving={marker.id === movingMarkerId}
          showLabel={showLabels}
          labelVisible={visibleLabelIds?.has(marker.id) ?? true}
          markerSize={marker.size || globalMarkerSize}
          interactionOnly={interactionOnly}
          onSetActive={setActiveMarker}
          onClick={onMarkerClick}
          onDoubleClick={onMarkerDoubleClick}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onNavigate={handleNavigate}
          onToggleVisibility={handleToggleVisibility}
          onMove={enterMoveMode}
          t={t}
        />
      ))}

      {/* Edge chevrons pointing toward off-screen markers; click navigates. */}
      {offscreenIndicators.map(({ marker, x, y, angleDeg }) => (
        <button
          key={`offscreen-${marker.id}`}
          type="button"
          data-testid="marker-offscreen-indicator"
          className="absolute pointer-events-auto flex items-center justify-center rounded-full border border-border/50 bg-background/70 backdrop-blur-sm transition-transform hover:scale-110"
          style={{
            left: x,
            top: y,
            width: 24,
            height: 24,
            transform: 'translate(-50%, -50%)',
          }}
          aria-label={`${t('markers.goTo')}: ${marker.name}`}
          title={marker.name}
          onClick={(e) => {
            e.stopPropagation();
            handleNavigate(marker);
          }}
        >
          <ChevronUp
            className="h-4 w-4"
            style={{ color: marker.color, transform: `rotate(${angleDeg}deg)` }}
            aria-hidden
          />
        </button>
      ))}

      {/* Explicit move mode: a capture layer intentionally blocks sky panning;
          click/drag-release places the marker, Escape cancels. */}
      {movingMarker && !interactionOnly && (
        <div
          data-testid="marker-move-layer"
          className="absolute inset-0 pointer-events-auto cursor-crosshair"
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setMovePreview({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onPointerUp={(e) => commitMove(e.clientX, e.clientY, e.currentTarget)}
        >
          {movePreview && (
            <div
              className="absolute pointer-events-none opacity-70"
              style={{ left: movePreview.x, top: movePreview.y, transform: 'translate(-50%, -50%)' }}
            >
              {(() => {
                const PreviewIcon = MarkerIconDisplay[movingMarker.icon];
                const previewSize = movingMarker.size || globalMarkerSize;
                return (
                  <PreviewIcon
                    style={{
                      color: movingMarker.color,
                      width: previewSize,
                      height: previewSize,
                      filter: `drop-shadow(0 0 4px ${movingMarker.color})`,
                    }}
                  />
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MarkerItemProps {
  marker: SkyMarker;
  x: number;
  y: number;
  isActive: boolean;
  isMoving: boolean;
  showLabel: boolean;
  /** False when the anti-collision pass hides this label (fades, stays mounted). */
  labelVisible: boolean;
  markerSize: number;
  interactionOnly: boolean;
  onSetActive: (id: string | null) => void;
  onClick?: (marker: SkyMarker) => void;
  onDoubleClick?: (marker: SkyMarker) => void;
  onEdit: (marker: SkyMarker) => void;
  onDelete: (marker: SkyMarker) => void;
  onNavigate: (marker: SkyMarker) => void;
  onToggleVisibility: (marker: SkyMarker) => void;
  onMove: (marker: SkyMarker) => void;
  t: ReturnType<typeof useTranslations>;
}

const MarkerItem = memo(function MarkerItem({
  marker,
  x,
  y,
  isActive,
  isMoving,
  showLabel,
  labelVisible,
  markerSize,
  interactionOnly,
  onSetActive,
  onClick,
  onDoubleClick,
  onEdit,
  onDelete,
  onNavigate,
  onToggleVisibility,
  onMove,
  t,
}: MarkerItemProps) {
  const IconComponent = MarkerIconDisplay[marker.icon];
  const activeSize = Math.round(markerSize * 1.4);
  const size = isActive ? activeSize : markerSize;
  const hitAreaSize = Math.max(18, markerSize + 8);

  // Drags that start on the marker pan the sky (forwarded to the engine);
  // Alt+drag on desktop enters explicit move mode instead. Aladin
  // (interactionOnly) keeps the original behavior — its listeners differ.
  const dragHandlers: MarkerDragHandlers = useMarkerDrag({
    enabled: !interactionOnly,
    onAltDragStart: () => {
      onMove(marker);
      return true;
    },
  });

  return (
    <ContextMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <ContextMenuTrigger asChild>
            <div
              className="absolute pointer-events-auto cursor-pointer transition-transform hover:scale-125"
              style={{
                left: x,
                top: y,
                transform: 'translate(-50%, -50%)',
                // Hide the original while its move preview follows the pointer.
                opacity: isMoving ? 0.25 : undefined,
              }}
              onPointerDown={dragHandlers.onPointerDown}
              onPointerMove={dragHandlers.onPointerMove}
              onPointerUp={dragHandlers.onPointerUp}
              onPointerCancel={dragHandlers.onPointerCancel}
              onClickCapture={dragHandlers.onClickCapture}
              onClick={(e) => {
                e.stopPropagation();
                onSetActive(marker.id);
                onClick?.(marker);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClick?.(marker);
              }}
            >
              {interactionOnly ? (
                <div
                  className="rounded-full"
                  style={{
                    width: hitAreaSize,
                    height: hitAreaSize,
                    background: 'transparent',
                  }}
                />
              ) : (
                <>
                  <IconComponent
                    className="drop-shadow-lg"
                    style={{
                      color: marker.color,
                      width: size,
                      height: size,
                      filter: `drop-shadow(0 0 ${isActive ? 4 : 2}px ${marker.color})`,
                    }}
                  />
                  {isActive && (
                    <div
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{
                        backgroundColor: marker.color,
                        opacity: 0.3,
                        transform: 'scale(1.5)',
                      }}
                    />
                  )}
                </>
              )}
              {showLabel && (
                <div
                  className={`absolute left-full top-1/2 -translate-y-1/2 ml-1 whitespace-nowrap text-xs font-medium pointer-events-none select-none transition-opacity duration-150 ${labelVisible ? 'opacity-100' : 'opacity-0'}`}
                  style={{
                    color: marker.color,
                    textShadow: '0 0 3px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.6)',
                    fontSize: Math.max(10, markerSize * 0.55),
                  }}
                >
                  {marker.name}
                </div>
              )}
            </div>
          </ContextMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="font-medium">{marker.name}</div>
          {marker.description && (
            <div className="text-xs text-muted-foreground mt-1">
              {marker.description}
            </div>
          )}
          <div className="text-xs font-mono text-muted-foreground mt-1">
            {marker.raString} / {marker.decString}
          </div>
        </TooltipContent>
      </Tooltip>
      <ContextMenuContent className="w-48" aria-label={t('markers.contextMenu')}>
        <ContextMenuLabel className="text-xs">
          <div className="font-medium truncate" style={{ color: marker.color }}>
            {marker.name}
          </div>
          <div className="font-mono text-muted-foreground font-normal">
            {marker.raString}
          </div>
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onNavigate(marker)}>
          <Navigation className="h-4 w-4 mr-2" />
          {t('markers.goTo')}
        </ContextMenuItem>
        {!interactionOnly && (
          <ContextMenuItem onSelect={() => onMove(marker)}>
            <Move className="h-4 w-4 mr-2" />
            {t('markers.moveMarker')}
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => onEdit(marker)}>
          <Edit className="h-4 w-4 mr-2" />
          {t('common.edit')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onToggleVisibility(marker)}>
          {marker.visible ? (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              {t('markers.hide')}
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              {t('markers.show')}
            </>
          )}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => onDelete(marker)}
          variant="destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {t('common.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
