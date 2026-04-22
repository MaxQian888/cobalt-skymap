'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckCircle,
  XCircle,
  MapPin,
  RotateCw,
  Ruler,
  Eye,
  Copy,
  Check,
  Sparkles,
  ScanSearch,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SolveResultCardProps } from '@/types/starmap/plate-solving';
import { clipboardService } from '@/lib/services/clipboard-service';

// Re-export types for backward compatibility
export type { SolveResultCardProps } from '@/types/starmap/plate-solving';

// ============================================================================
// Component
// ============================================================================

export function SolveResultCard({
  result,
  onGoTo,
  consumption,
  onSelectObject,
  onNavigateAnnotation,
  onCreateMarkerFromAnnotation,
}: SolveResultCardProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const parsedError = (() => {
    if (!result.errorMessage) return { code: null as string | null, message: null as string | null, attempts: null as string | null };
    const codeMatch = result.errorMessage.match(/^\[([a-z_]+)\]\s*(.*)$/i);
    const message = codeMatch ? codeMatch[2] : result.errorMessage;
    const attemptsMatch = message.match(/\(Attempt\s+(\d+\/\d+)\)\s*$/i);
    return {
      code: codeMatch ? codeMatch[1] : null,
      message: attemptsMatch ? message.replace(attemptsMatch[0], '').trim() : message,
      attempts: attemptsMatch ? attemptsMatch[1] : null,
    };
  })();

  const handleCopyCoordinates = useCallback(async () => {
    if (!result.success || !result.coordinates) return;
    const text = `RA: ${result.coordinates.raHMS}  Dec: ${result.coordinates.decDMS}  PA: ${result.positionAngle.toFixed(2)}°  Scale: ${result.pixelScale.toFixed(2)}"/px  FOV: ${result.fov.width.toFixed(2)}° × ${result.fov.height.toFixed(2)}°`;
    try {
      await clipboardService.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [result]);

  return (
    <Card className={result.success ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          {result.success ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
          <span className="font-medium">
            {result.success 
              ? (t('plateSolving.solveSuccess') || 'Plate Solve Successful!')
              : (t('plateSolving.solveFailed') || 'Plate Solve Failed')
            }
          </span>
        </div>

        {result.success && result.coordinates && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{t('coordinates.ra')}: {result.coordinates.raHMS}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{t('coordinates.dec')}: {result.coordinates.decDMS}</span>
            </div>
            <div className="flex items-center gap-2">
              <RotateCw className="h-4 w-4 text-muted-foreground" />
              <span>{t('plateSolving.rotation') || 'Rotation'}: {result.positionAngle.toFixed(2)}°</span>
            </div>
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <span>{t('plateSolving.pixelScale') || 'Scale'}: {result.pixelScale.toFixed(2)}&quot;/px</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span>{t('plateSolving.fov') || 'FOV'}: {result.fov.width.toFixed(2)}° × {result.fov.height.toFixed(2)}°</span>
            </div>

            <div className="flex gap-2 mt-3">
              {onGoTo && (
                <Button onClick={onGoTo} className="flex-1">
                  <MapPin className="h-4 w-4 mr-2" />
                  {t('plateSolving.goToPosition') || 'Go to Position'}
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size={onGoTo ? 'icon' : 'default'}
                    className={onGoTo ? '' : 'flex-1'}
                    onClick={handleCopyCoordinates}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {!onGoTo && (
                      <span className="ml-2">
                        {copied ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy')}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                {onGoTo && (
                  <TooltipContent>
                    {copied ? (t('common.copied') || 'Copied!') : (t('plateSolving.copyCoordinates') || 'Copy Coordinates')}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>

            {consumption && (
              <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    <span>{t('plateSolving.annotationCount') || 'Annotations'}</span>
                    <span className="ml-1">{consumption.artifacts.annotationCount}</span>
                  </Badge>
                  <Badge variant="outline">
                    <span>{t('plateSolving.detectedObjects') || 'Detected Objects'}</span>
                    <span className="ml-1">{consumption.objects.count}</span>
                  </Badge>
                  {consumption.artifacts.wcsState === 'missing' && (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                      {t('plateSolving.wcsMissing') || 'WCS missing'}
                    </Badge>
                  )}
                </div>

                {consumption.objects.previewNames.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <ScanSearch className="h-3.5 w-3.5" />
                      <span>{t('plateSolving.detectedObjects') || 'Detected Objects'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {consumption.objects.previewNames.map((name) => (
                        onSelectObject ? (
                          <Button
                            key={name}
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 rounded-full px-3 text-xs"
                            onClick={() => onSelectObject(name)}
                          >
                            {name}
                          </Button>
                        ) : (
                          <Badge key={name} variant="secondary">{name}</Badge>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {consumption.analysis.available && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{t('plateSolving.analysisSummary') || 'Analysis Summary'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>{t('plateSolving.analysisStars') || 'Stars'}: {consumption.analysis.starCount}</div>
                      <div>{t('plateSolving.analysisMedianHfd') || 'Median HFD'}: {consumption.analysis.medianHfd ?? '--'}</div>
                    </div>
                  </div>
                )}

                {consumption.annotations.some((annotation) => annotation.actionability.disabledReason) && (
                  <div className="space-y-1">
                    {consumption.annotations
                      .filter((annotation) => annotation.actionability.disabledReason)
                      .map((annotation) => (
                        <div
                          key={`${annotation.names.join('-')}-${annotation.annotationType}`}
                          className="flex items-center gap-2 text-xs text-amber-300"
                        >
                          <TriangleAlert className="h-3.5 w-3.5" />
                          <span>
                            {t(`plateSolving.annotationActionDisabled.${annotation.actionability.disabledReason}`) || annotation.actionability.disabledReason}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {consumption.annotations.some((annotation) => annotation.actionability.canNavigate && annotation.derivedCoordinates) && (
                  <div className="space-y-2">
                    {consumption.annotations
                      .filter((annotation) => annotation.actionability.canNavigate && annotation.derivedCoordinates)
                      .map((annotation) => (
                        <div
                          key={`${annotation.names.join('-')}-${annotation.annotationType}-actions`}
                          className="flex flex-wrap gap-2"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => onNavigateAnnotation?.(annotation.derivedCoordinates!)}
                          >
                            {t('plateSolving.goToAnnotation') || 'Go to Annotation'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => onCreateMarkerFromAnnotation?.({
                              ra: annotation.derivedCoordinates!.ra,
                              dec: annotation.derivedCoordinates!.dec,
                              name: annotation.names[0] ?? annotation.annotationType,
                            })}
                          >
                            {t('plateSolving.addAnnotationMarker') || 'Add Marker'}
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!result.success && result.errorMessage && (
          <Alert variant="destructive" className="mt-2">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {parsedError.message}
              {parsedError.code && (
                <span className="ml-2 text-xs uppercase tracking-wide">
                  ({parsedError.code})
                </span>
              )}
              {parsedError.attempts && (
                <span className="ml-2 text-xs">
                  {t('plateSolving.retryOnFailure') || 'Retry'} {parsedError.attempts}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          {t('plateSolving.solveTime') || 'Solve time'}: {(result.solveTime / 1000).toFixed(1)}s
          <span className="ml-2">• {result.solverName}</span>
        </p>
      </CardContent>
    </Card>
  );
}
