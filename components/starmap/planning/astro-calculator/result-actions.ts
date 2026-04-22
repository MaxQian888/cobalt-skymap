import { useTranslations } from 'next-intl';
import { degreesToDMS, degreesToHMS } from '@/lib/astronomy/starmap-utils';
import { usePlanningUiStore } from '@/lib/stores/planning-ui-store';
import { useTargetListStore } from '@/lib/stores/target-list-store';
import type { SessionDraftV2 } from '@/types/starmap/session-planner-v2';
import { copyTextWithFeedback } from '@/lib/utils/clipboard-feedback';
import type { CalculatorMetaSummary } from './orchestrator';
import type { AstroCalculatorObserverContext } from './types';

export interface AstroCalculatorActionTarget {
  name: string;
  ra: number;
  dec: number;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

export interface AstroCalculatorExportPayload {
  title: string;
  fileStem: string;
  targetName?: string;
  observerContext?: AstroCalculatorObserverContext;
  metaSummary?: CalculatorMetaSummary | null;
  diagnostics?: string[];
  contentLines: string[];
}

function toPlanDateIso(sharedDate?: string): string {
  const fallback = new Date();
  const year = fallback.getFullYear();
  const month = String(fallback.getMonth() + 1).padStart(2, '0');
  const day = String(fallback.getDate()).padStart(2, '0');
  const normalized = sharedDate ?? `${year}-${month}-${day}`;
  return new Date(`${normalized}T00:00:00`).toISOString();
}

export function buildAstroCalculatorExportText({
  title,
  targetName,
  observerContext,
  metaSummary,
  diagnostics = [],
  contentLines,
}: AstroCalculatorExportPayload): string {
  const lines: string[] = [title];

  if (targetName) {
    lines.push(`Target: ${targetName}`);
  }

  if (observerContext) {
    lines.push(`Site: ${observerContext.locationName}`);
    lines.push(`Observer: ${observerContext.latitude.toFixed(4)}, ${observerContext.longitude.toFixed(4)} @ ${observerContext.elevation}m`);
    lines.push(`Timezone: ${observerContext.timezone}`);
    lines.push(`Shared date/time: ${observerContext.sharedDate} ${observerContext.sharedTime}`);
    lines.push(
      `Constraints: minAltitude=${observerContext.constraints.minAltitude} moonInterference=${observerContext.constraints.moonInterference}`,
    );
  }

  if (metaSummary) {
    lines.push(
      `Diagnostics: tauri=${metaSummary.sourceCounts.tauri} fallback=${metaSummary.sourceCounts.fallback} cacheHits=${metaSummary.cacheHits} cacheMisses=${metaSummary.cacheMisses} degraded=${metaSummary.degradedCount} warnings=${metaSummary.warningsCount}`,
    );
  }

  diagnostics
    .filter((line) => line.trim().length > 0)
    .forEach((line) => lines.push(`Note: ${line}`));

  lines.push('');
  lines.push(...contentLines);

  return lines.join('\n');
}

function downloadTextFile(fileStem: string, text: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileStem}.txt`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function useAstroCalculatorResultActions(observerContext?: AstroCalculatorObserverContext) {
  const t = useTranslations();
  const addTarget = useTargetListStore((state) => state.addTarget);
  const createList = useTargetListStore((state) => state.createList);
  const setActiveList = useTargetListStore((state) => state.setActiveList);
  const addEntryToList = useTargetListStore((state) => state.addEntryToList);
  const launchPlannerWithDraftSeed = usePlanningUiStore((state) => state.launchPlannerWithDraftSeed);

  const copyResults = async (payload: AstroCalculatorExportPayload): Promise<string> => {
    const text = buildAstroCalculatorExportText(payload);
    await copyTextWithFeedback({
      text,
      successMessage: t('astroCalc.copySuccess'),
      errorMessage: t('astroCalc.copyFailed'),
    });
    return text;
  };

  const exportResults = (payload: AstroCalculatorExportPayload): string => {
    const text = buildAstroCalculatorExportText(payload);
    downloadTextFile(payload.fileStem, text);
    return text;
  };

  const addTargetToList = (target: AstroCalculatorActionTarget): void => {
    addTarget({
      name: target.name,
      ra: target.ra,
      dec: target.dec,
      raString: degreesToHMS(target.ra),
      decString: degreesToDMS(target.dec),
      priority: target.priority ?? 'medium',
      tags: target.tags ?? ['astro-calculator'],
    });
  };

  const openPlannerForTarget = (target: AstroCalculatorActionTarget): void => {
    const listId = createList({
      name: `Astro Calculator - ${target.name}`,
      description: observerContext
        ? `${observerContext.locationName} • ${observerContext.sharedDate}`
        : 'Astro Calculator handoff',
    });

    addEntryToList(listId, {
      name: target.name,
      ra: target.ra,
      dec: target.dec,
      raString: degreesToHMS(target.ra),
      decString: degreesToDMS(target.dec),
      priority: target.priority ?? 'medium',
      tags: target.tags ?? ['astro-calculator'],
    });
    setActiveList(listId);

    const draft: SessionDraftV2 = {
      name: `Astro Calculator - ${target.name}`,
      notes: observerContext
        ? `Astro Calculator handoff for ${target.name} at ${observerContext.locationName}`
        : `Astro Calculator handoff for ${target.name}`,
      planDate: toPlanDateIso(observerContext?.sharedDate),
      strategy: 'balanced',
      constraints: {
        minAltitude: observerContext?.constraints.minAltitude ?? 0,
        minImagingTime: 30,
        useExposurePlanDuration: false,
      },
      excludedTargetIds: [],
      manualEdits: [],
    };

    launchPlannerWithDraftSeed(draft);
  };

  return {
    copyResults,
    exportResults,
    addTargetToList,
    openPlannerForTarget,
  };
}
