/**
 * Shared hook for celestial object actions (slew, add to list)
 * Extracts duplicated logic from InfoPanel and ObjectDetailDrawer
 */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMountStore, useTargetListStore } from '@/lib/stores';
import type { SelectedObjectData } from '@/lib/core/types';
import type { FramingCoordinatesData } from '@/types/starmap/objects';

export interface UseObjectActionsOptions {
  selectedObject: SelectedObjectData | null;
  onSetFramingCoordinates?: (data: FramingCoordinatesData) => void;
  /** Called after slew action completes (e.g., close drawer) */
  onAfterSlew?: () => void;
}

export interface UseObjectActionsReturn {
  handleSlew: () => void;
  handleAddToList: () => void;
  mountConnected: boolean;
  /** Slew confirm dialog state — render <SlewConfirmDialog> with these props */
  slewDialogOpen: boolean;
  slewDialogTarget: { name: string; ra: number; dec: number } | null;
  setSlewDialogOpen: (open: boolean) => void;
  handleTargetActionStarted: () => void;
}

/**
 * Provides shared slew and add-to-list callbacks for celestial object panels.
 *
 * When mount is connected, handleSlew opens the slew confirm dialog instead
 * of immediately setting framing coordinates.
 * When mount is NOT connected, falls back to the original framing behavior.
 */
export function useObjectActions({
  selectedObject,
  onSetFramingCoordinates,
  onAfterSlew,
}: UseObjectActionsOptions): UseObjectActionsReturn {
  const t = useTranslations();
  const mountConnected = useMountStore((state) => state.mountInfo.Connected);
  const addTarget = useTargetListStore((state) => state.addTarget);

  const [slewDialogOpen, setSlewDialogOpenState] = useState(false);
  const [slewDialogTarget, setSlewDialogTarget] = useState<{ name: string; ra: number; dec: number } | null>(null);

  const setSlewDialogOpen = useCallback((open: boolean) => {
    setSlewDialogOpenState(open);
    if (!open) {
      setSlewDialogTarget(null);
    }
  }, []);

  const handleSlew = useCallback(() => {
    if (!selectedObject) return;

    if (mountConnected) {
      // Open slew confirm dialog for real mount control
      setSlewDialogTarget({
        name: selectedObject.names[0] || '',
        ra: selectedObject.raDeg,
        dec: selectedObject.decDeg,
      });
      setSlewDialogOpen(true);
    } else {
      // Fallback: set framing coordinates (no mount connected)
      onSetFramingCoordinates?.({
        ra: selectedObject.raDeg,
        dec: selectedObject.decDeg,
        raString: selectedObject.ra,
        decString: selectedObject.dec,
        name: selectedObject.names[0] || '',
      });
      onAfterSlew?.();
    }
  }, [selectedObject, mountConnected, onSetFramingCoordinates, onAfterSlew, setSlewDialogOpen]);

  const handleTargetActionStarted = useCallback(() => {
    setSlewDialogOpen(false);
    onAfterSlew?.();
  }, [onAfterSlew, setSlewDialogOpen]);

  const handleAddToList = useCallback(() => {
    if (!selectedObject) return;
    addTarget({
      name: selectedObject.names[0] || t('common.unknown'),
      ra: selectedObject.raDeg,
      dec: selectedObject.decDeg,
      raString: selectedObject.ra,
      decString: selectedObject.dec,
      priority: 'medium',
    });
  }, [selectedObject, addTarget, t]);

  return {
    handleSlew,
    handleAddToList,
    mountConnected,
    slewDialogOpen,
    slewDialogTarget,
    setSlewDialogOpen,
    handleTargetActionStarted,
  };
}
