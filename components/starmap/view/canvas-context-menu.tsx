'use client';

import { memo, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import {
  Copy,
  Crosshair,
  MapPin,
  Plus,
  Target,
  Compass,
  ZoomIn,
  ZoomOut,
  Camera,
  RotateCw,
  Grid3X3,
  Settings,
  Search,
  RotateCcw,
  Navigation,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuShortcut,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useAladinStore, useEquipmentStore, useSettingsStore, useStellariumStore } from '@/lib/stores';
import { useEquipmentFOVRead } from '@/lib/hooks/use-equipment-fov-props';
import { degreesToHMS, degreesToDMS, rad2deg } from '@/lib/astronomy/starmap-utils';
import type { ClickCoords, SelectedObjectData } from '@/lib/core/types';
import type { ContextMenuStellariumSettings } from '@/types/starmap/view';
import { clipboardService } from '@/lib/services/clipboard-service';
import { SlewConfirmDialog } from '@/components/starmap/mount/slew-confirm-dialog';
import { useMobileShell } from '@/components/starmap/view/use-mobile-shell';

interface CanvasContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  coords: ClickCoords | null;
  selectedObject: SelectedObjectData | null;
  mountConnected: boolean;
  stellariumSettings: ContextMenuStellariumSettings;
  onOpenChange: (open: boolean) => void;
  onAddToTargetList: () => void;
  onNavigateToCoords: () => void;
  onOpenGoToDialog: () => void;
  onSetPendingMarkerCoords: (coords: { ra: number; dec: number; raString: string; decString: string }) => void;
  onSetFramingCoordinates: (data: { ra: number; dec: number; raString: string; decString: string; name: string }) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetFov: (fov: number) => void;
  onToggleStellariumSetting: (key: keyof ContextMenuStellariumSettings) => void;
  onToggleSearch: () => void;
  onResetView: () => void;
}

export const CanvasContextMenu = memo(function CanvasContextMenu({
  open,
  position,
  coords,
  selectedObject,
  mountConnected,
  stellariumSettings,
  onOpenChange,
  onAddToTargetList,
  onNavigateToCoords,
  onOpenGoToDialog,
  onSetPendingMarkerCoords,
  onSetFramingCoordinates,
  onZoomIn,
  onZoomOut,
  onSetFov,
  onToggleStellariumSetting,
  onToggleSearch,
  onResetView,
}: CanvasContextMenuProps) {
  const t = useTranslations();
  // The menu portals to <body>, escaping the [data-shell] scope, so shell
  // adaptations (hide keyboard hints, 44px rows) must be applied inline.
  const { isMobileShell } = useMobileShell();
  const [mountTargetAction, setMountTargetAction] = useState<{
    name: string;
    ra: number;
    dec: number;
  } | null>(null);
  const skyEngine = useSettingsStore((state) => state.skyEngine);
  const setSkyEngine = useSettingsStore((state) => state.setSkyEngine);
  const isStellarium = skyEngine === 'stellarium';

  const catalogLayers = useAladinStore((state) => state.catalogLayers);
  const toggleCatalogLayer = useAladinStore((state) => state.toggleCatalogLayer);
  const overlayLayers = useAladinStore((state) => state.imageOverlayLayers);
  const toggleImageOverlayLayer = useAladinStore((state) => state.toggleImageOverlayLayer);
  const mocLayers = useAladinStore((state) => state.mocLayers);
  const toggleMocLayer = useAladinStore((state) => state.toggleMocLayer);
  const fitsLayers = useAladinStore((state) => state.fitsLayers);
  const toggleFitsLayer = useAladinStore((state) => state.toggleFitsLayer);

  // Equipment FOV read props — shared hook avoids duplicating selectors
  const { fovSimEnabled, mosaic } = useEquipmentFOVRead();
  const setFovSimEnabled = useEquipmentStore((s) => s.setFOVEnabled);
  const setRotationAngle = useEquipmentStore((s) => s.setRotationAngle);
  const setMosaic = useEquipmentStore((s) => s.setMosaic);

  // Copy view center coordinates
  const handleCopyViewCenter = useCallback(() => {
    const getCurrentViewDirection = useStellariumStore.getState().getCurrentViewDirection;
    if (getCurrentViewDirection) {
      const dir = getCurrentViewDirection();
      const ra = rad2deg(dir.ra);
      const dec = rad2deg(dir.dec);
      const raStr = degreesToHMS(((ra % 360) + 360) % 360);
      const decStr = degreesToDMS(dec);
      void clipboardService.writeText(`${raStr} ${decStr}`);
    }
    onOpenChange(false);
  }, [onOpenChange]);

  // Copy click position
  const handleCopyClickPosition = useCallback(() => {
    if (coords) {
      void clipboardService.writeText(`${coords.raStr} ${coords.decStr}`);
    }
    onOpenChange(false);
  }, [coords, onOpenChange]);

  // Copy object coordinates
  const handleCopyObjectCoordinates = useCallback(() => {
    if (selectedObject) {
      void clipboardService.writeText(`${selectedObject.ra} ${selectedObject.dec}`);
    }
    onOpenChange(false);
  }, [selectedObject, onOpenChange]);

  // Slew to object
  const handleSlewToObject = useCallback(() => {
    if (selectedObject) {
      if (mountConnected) {
        setMountTargetAction({
          name: selectedObject.names[0] || '',
          ra: selectedObject.raDeg,
          dec: selectedObject.decDeg,
        });
      } else {
        onSetFramingCoordinates({
          ra: selectedObject.raDeg,
          dec: selectedObject.decDeg,
          raString: selectedObject.ra,
          decString: selectedObject.dec,
          name: selectedObject.names[0] || '',
        });
      }
    }
    onOpenChange(false);
  }, [mountConnected, onOpenChange, onSetFramingCoordinates, selectedObject]);

  // Add marker here
  const handleAddMarkerHere = useCallback(() => {
    if (coords) {
      onSetPendingMarkerCoords({
        ra: coords.ra,
        dec: coords.dec,
        raString: coords.raStr,
        decString: coords.decStr,
      });
    }
    onOpenChange(false);
  }, [coords, onSetPendingMarkerCoords, onOpenChange]);

  // Keep server/client initial render consistent to avoid hydration mismatch,
  // then recompute from runtime viewport/safe-area after hydration.
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const triggerPosition = useMemo(() => {
    if (!isHydrated || typeof window === 'undefined') {
      return position;
    }

    const rootStyles = window.getComputedStyle(document.documentElement);
    const safeAreaTop = Number.parseFloat(rootStyles.getPropertyValue('--safe-area-top')) || 0;
    const safeAreaBottom = Number.parseFloat(rootStyles.getPropertyValue('--safe-area-bottom')) || 0;
    const safeAreaLeft = Number.parseFloat(rootStyles.getPropertyValue('--safe-area-left')) || 0;
    const safeAreaRight = Number.parseFloat(rootStyles.getPropertyValue('--safe-area-right')) || 0;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const minX = safeAreaLeft + 8;
    const minY = safeAreaTop + 8;
    const maxX = Math.max(minX, viewportWidth - safeAreaRight - 8);
    const maxY = Math.max(minY, viewportHeight - safeAreaBottom - 8);
    return {
      x: Math.min(Math.max(position.x, minX), maxX),
      y: Math.min(Math.max(position.y, minY), maxY),
    };
  }, [isHydrated, position]);

  return (
    <>
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {/* Invisible trigger positioned at click location */}
      <DropdownMenuTrigger asChild>
        <div
          className="fixed w-0 h-0 pointer-events-none"
          style={{
            left: triggerPosition.x,
            top: triggerPosition.y,
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={
          'w-64 bg-card border-border max-h-[calc(80vh-var(--safe-area-top)-var(--safe-area-bottom))] max-h-[calc(80dvh-var(--safe-area-top)-var(--safe-area-bottom))] overflow-y-auto' +
          (isMobileShell
            ? ' [&_[data-slot=dropdown-menu-item]]:min-h-11 [&_[data-slot=dropdown-menu-sub-trigger]]:min-h-11 [&_[data-slot=dropdown-menu-checkbox-item]]:min-h-11'
            : '')
        }
        align="start"
        collisionPadding={8}
      >
        {/* Click Position Info */}
        {coords && (
          <>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              <div className="font-medium text-foreground mb-1">{t('coordinates.clickPosition')}</div>
              <div className="font-mono">{t('coordinates.ra')}: {coords.raStr}</div>
              <div className="font-mono">{t('coordinates.dec')}: {coords.decStr}</div>
            </div>
            <DropdownMenuSeparator className="bg-border" />
          </>
        )}

        {/* Selected Object Actions */}
        {selectedObject && (
          <>
            <div className="px-2 py-1.5 text-xs">
              <div className="font-medium text-primary truncate">{selectedObject.names[0]}</div>
            </div>
            <DropdownMenuItem
              onClick={handleCopyObjectCoordinates}
              className="text-foreground"
            >
              <Copy className="h-4 w-4 mr-2" />
              {t('coordinates.copyObjectCoordinates')}
              {!isMobileShell && <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>}
            </DropdownMenuItem>
            {mountConnected && (
              <DropdownMenuItem
                onClick={handleSlewToObject}
                className="text-foreground"
              >
                <Navigation className="h-4 w-4 mr-2" />
                {t('actions.slewToObject')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-border" />
          </>
        )}

        {/* Add to Target List */}
        <DropdownMenuItem
          onClick={() => {
            onAddToTargetList();
            onOpenChange(false);
          }}
          disabled={!coords && !selectedObject}
          className="text-foreground"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('actions.addToTargetList')}
        </DropdownMenuItem>

        {/* Add Marker Here */}
        {coords && (
          <DropdownMenuItem
            onClick={handleAddMarkerHere}
            className="text-foreground"
          >
            <MapPin className="h-4 w-4 mr-2" />
            {t('markers.addMarkerHere')}
          </DropdownMenuItem>
        )}

        {/* Center View on Click */}
        {coords && (
          <DropdownMenuItem
            onClick={() => {
              onNavigateToCoords();
              onOpenChange(false);
            }}
            className="text-foreground"
          >
            <Target className="h-4 w-4 mr-2" />
            {t('actions.centerViewHere')}
          </DropdownMenuItem>
        )}

        {/* Go to Coordinates */}
        <DropdownMenuItem
          onClick={onOpenGoToDialog}
          className="text-foreground"
        >
          <Compass className="h-4 w-4 mr-2" />
          {t('coordinates.goToCoordinates')}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-border" />

        {/* Zoom Controls */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-foreground">
            <ZoomIn className="h-4 w-4 mr-2" />
            {t('zoom.zoom')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="bg-card border-border">
            <DropdownMenuItem onClick={() => { onZoomIn(); onOpenChange(false); }} className="text-foreground">
              <ZoomIn className="h-4 w-4 mr-2" />
              {t('zoom.zoomIn')}
              {!isMobileShell && <DropdownMenuShortcut>+</DropdownMenuShortcut>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onZoomOut(); onOpenChange(false); }} className="text-foreground">
              <ZoomOut className="h-4 w-4 mr-2" />
              {t('zoom.zoomOut')}
              {!isMobileShell && <DropdownMenuShortcut>-</DropdownMenuShortcut>}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={() => { onSetFov(1); onOpenChange(false); }} className="text-foreground">
              {t('zoom.fovPreset', { value: 1 })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onSetFov(5); onOpenChange(false); }} className="text-foreground">
              {t('zoom.fovPreset', { value: 5 })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onSetFov(15); onOpenChange(false); }} className="text-foreground">
              {t('zoom.fovPreset', { value: 15 })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onSetFov(30); onOpenChange(false); }} className="text-foreground">
              {t('zoom.fovPreset', { value: 30 })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onSetFov(60); onOpenChange(false); }} className="text-foreground">
              {t('zoom.fovPreset', { value: 60 })} ({t('zoom.default')})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onSetFov(90); onOpenChange(false); }} className="text-foreground">
              {t('zoom.fovPreset', { value: 90 })}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* FOV Overlay */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-foreground">
            <Camera className="h-4 w-4 mr-2" />
            {t('fov.fovOverlay')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="bg-card border-border">
            {isStellarium ? (
              <>
                <DropdownMenuCheckboxItem
                  checked={fovSimEnabled}
                  onCheckedChange={setFovSimEnabled}
                  className="text-foreground"
                >
                  {t('fov.showFovOverlay')}
                </DropdownMenuCheckboxItem>
                {fovSimEnabled && (
                  <>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem
                      onClick={() => { setRotationAngle(0); onOpenChange(false); }}
                      className="text-foreground"
                    >
                      <RotateCw className="h-4 w-4 mr-2" />
                      {t('fov.resetRotation')}
                    </DropdownMenuItem>
                    <DropdownMenuCheckboxItem
                      checked={mosaic.enabled}
                      onCheckedChange={(checked: boolean) => setMosaic({ ...mosaic, enabled: checked })}
                      className="text-foreground"
                    >
                      <Grid3X3 className="h-4 w-4 mr-2" />
                      {t('fov.enableMosaic')}
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </>
            ) : (
              <>
                <DropdownMenuItem disabled className="text-muted-foreground">
                  {t('settings.stellariumFeatureUnavailable')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-foreground"
                  onClick={() => {
                    setSkyEngine('stellarium');
                    onOpenChange(false);
                  }}
                >
                  {t('settings.switchToStellarium')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="bg-border" />

        {/* Display Settings */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-foreground">
            <Settings className="h-4 w-4 mr-2" />
            {t('settings.display')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="bg-card border-border w-48">
            {isStellarium ? (
              <>
                <DropdownMenuCheckboxItem
                  checked={stellariumSettings.constellationsLinesVisible}
                  onCheckedChange={() => onToggleStellariumSetting('constellationsLinesVisible')}
                  className="text-foreground"
                >
                  {t('settings.constellationLines')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={stellariumSettings.equatorialLinesVisible}
                  onCheckedChange={() => onToggleStellariumSetting('equatorialLinesVisible')}
                  className="text-foreground"
                >
                  {t('settings.equatorialGrid')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={stellariumSettings.azimuthalLinesVisible}
                  onCheckedChange={() => onToggleStellariumSetting('azimuthalLinesVisible')}
                  className="text-foreground"
                >
                  {t('settings.azimuthalGrid')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={stellariumSettings.dsosVisible}
                  onCheckedChange={() => onToggleStellariumSetting('dsosVisible')}
                  className="text-foreground"
                >
                  {t('settings.deepSkyObjects')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuCheckboxItem
                  checked={stellariumSettings.surveyEnabled}
                  onCheckedChange={() => onToggleStellariumSetting('surveyEnabled')}
                  className="text-foreground"
                >
                  {t('settings.skySurveys')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={stellariumSettings.atmosphereVisible}
                  onCheckedChange={() => onToggleStellariumSetting('atmosphereVisible')}
                  className="text-foreground"
                >
                  {t('settings.atmosphere')}
                </DropdownMenuCheckboxItem>
              </>
            ) : (
              <>
                {catalogLayers.map((layer) => (
                  <DropdownMenuCheckboxItem
                    key={layer.id}
                    checked={layer.enabled}
                    onCheckedChange={() => toggleCatalogLayer(layer.id)}
                    className="text-foreground"
                  >
                    {layer.name}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator className="bg-border" />
                {mocLayers.map((layer) => (
                  <DropdownMenuCheckboxItem
                    key={layer.id}
                    checked={layer.visible}
                    onCheckedChange={() => toggleMocLayer(layer.id)}
                    className="text-foreground"
                  >
                    {layer.name}
                  </DropdownMenuCheckboxItem>
                ))}
                {overlayLayers.map((layer) => (
                  <DropdownMenuCheckboxItem
                    key={layer.id}
                    checked={layer.enabled}
                    onCheckedChange={() => toggleImageOverlayLayer(layer.id)}
                    className="text-foreground"
                  >
                    {layer.name}
                  </DropdownMenuCheckboxItem>
                ))}
                {fitsLayers.map((layer) => (
                  <DropdownMenuCheckboxItem
                    key={layer.id}
                    checked={layer.enabled}
                    onCheckedChange={() => toggleFitsLayer(layer.id)}
                    className="text-foreground"
                  >
                    {layer.name}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  className="text-foreground"
                  onClick={() => {
                    setSkyEngine('stellarium');
                    onOpenChange(false);
                  }}
                >
                  {t('settings.switchToStellarium')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="bg-border" />

        {/* Coordinates */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-foreground">
            <MapPin className="h-4 w-4 mr-2" />
            {t('coordinates.coordinates')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="bg-card border-border">
            {coords && (
              <DropdownMenuItem
                onClick={handleCopyClickPosition}
                className="text-foreground"
              >
                <Copy className="h-4 w-4 mr-2" />
                {t('coordinates.copyClickPosition')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={handleCopyViewCenter}
              className="text-foreground"
            >
              <Crosshair className="h-4 w-4 mr-2" />
              {t('coordinates.copyViewCenter')}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="bg-border" />

        {/* Search */}
        <DropdownMenuItem
          onClick={() => {
            onToggleSearch();
            onOpenChange(false);
          }}
          className="text-foreground"
        >
          <Search className="h-4 w-4 mr-2" />
          {t('starmap.searchObjects')}
          {!isMobileShell && <DropdownMenuShortcut>Ctrl+F</DropdownMenuShortcut>}
        </DropdownMenuItem>

        {/* Reset View */}
        <DropdownMenuItem onClick={() => { onResetView(); onOpenChange(false); }} className="text-foreground">
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('starmap.resetView')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {mountTargetAction && (
      <SlewConfirmDialog
        open={true}
        onOpenChange={(dialogOpen) => {
          if (!dialogOpen) {
            setMountTargetAction(null);
          }
        }}
        targetName={mountTargetAction.name}
        targetRa={mountTargetAction.ra}
        targetDec={mountTargetAction.dec}
      />
    )}
    </>
  );
});
CanvasContextMenu.displayName = 'CanvasContextMenu';
