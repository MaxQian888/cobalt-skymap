/**
 * Session plan export utilities
 * Supports: Plain text, Markdown, JSON, NINA Simple Sequence XML
 */

import type { SessionPlan, ScheduledTarget } from '@/types/starmap/planning';
import { formatTimeShort, formatDuration } from './astro-utils';
import { degreesToHMS, degreesToDMS } from './starmap-utils';

function getPlannedMinutes(scheduled: ScheduledTarget): number {
  return Math.max(0, Math.round(scheduled.duration * 60));
}

function getDesiredMinutes(scheduled: ScheduledTarget): number | undefined {
  const anyTarget = scheduled as ScheduledTarget & { desiredDurationMinutes?: number };
  if (
    typeof anyTarget.desiredDurationMinutes === 'number' &&
    Number.isFinite(anyTarget.desiredDurationMinutes) &&
    anyTarget.desiredDurationMinutes > 0
  ) {
    return anyTarget.desiredDurationMinutes;
  }
  const totalExposure = scheduled.target.exposurePlan?.totalExposure;
  return typeof totalExposure === 'number' && totalExposure > 0 ? totalExposure : undefined;
}

function getExposureDetails(scheduled: ScheduledTarget): {
  filter: string;
  singleExposureSec: number;
  subFrames: number;
  gain: number;
  offset: number;
} {
  const exposurePlan = scheduled.target.exposurePlan;
  const filter = exposurePlan?.filter || 'L';
  const singleExposureSec =
    exposurePlan?.singleExposure && exposurePlan.singleExposure > 0
      ? exposurePlan.singleExposure
      : exposurePlan?.advanced?.recommendedExposureSec && exposurePlan.advanced.recommendedExposureSec > 0
        ? exposurePlan.advanced.recommendedExposureSec
        : 300;

  let subFrames = exposurePlan?.subFrames ?? 0;
  if (subFrames <= 0 && exposurePlan?.totalExposure && exposurePlan.totalExposure > 0 && singleExposureSec > 0) {
    subFrames = Math.max(1, Math.round((exposurePlan.totalExposure * 60) / singleExposureSec));
  }
  if (subFrames <= 0) subFrames = 1;

  const gain =
    typeof exposurePlan?.advanced?.recommendedGain === 'number' && Number.isFinite(exposurePlan.advanced.recommendedGain)
      ? Math.round(exposurePlan.advanced.recommendedGain)
      : -1;

  return {
    filter,
    singleExposureSec,
    subFrames,
    gain,
    offset: -1,
  };
}

function roundSeconds(value: number): number {
  return Math.round(value * 100000) / 100000;
}

function splitRaDegToHms(raDeg: number): { hours: number; minutes: number; seconds: number } {
  const normalizedDeg = ((raDeg % 360) + 360) % 360;
  const totalHours = normalizedDeg / 15;

  let hours = Math.trunc(totalHours);
  const secondsTotal = totalHours * 3600;
  let minutes = Math.trunc((secondsTotal - hours * 3600) / 60);
  let seconds = roundSeconds(secondsTotal - hours * 3600 - minutes * 60);

  if (seconds >= 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  }

  return { hours, minutes, seconds };
}

function splitDecDegToDms(decDeg: number): {
  negative: boolean;
  degrees: number;
  minutes: number;
  seconds: number;
} {
  const negative = decDeg < 0;
  const abs = Math.abs(decDeg);

  let degrees = Math.trunc(abs);
  const secondsTotal = abs * 3600;
  let minutes = Math.trunc((secondsTotal - degrees * 3600) / 60);
  let seconds = roundSeconds(secondsTotal - degrees * 3600 - minutes * 60);

  if (seconds >= 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes = 0;
    degrees += 1;
  }

  return {
    negative,
    degrees: negative ? -degrees : degrees,
    minutes,
    seconds,
  };
}

// ============================================================================
// Export Formats
// ============================================================================

export type PlanExportFormat = 'text' | 'markdown' | 'json' | 'nina-xml' | 'csv' | 'sgp-csv';

export interface PlanExportOptions {
  format: PlanExportFormat;
  planDate: Date;
  locationName?: string;
  latitude: number;
  longitude: number;
  sourcePlanId?: string;
  sourcePlanName?: string;
  exportedAt?: string;
}

// ============================================================================
// Plain Text Export
// ============================================================================

function exportAsText(plan: SessionPlan, options: PlanExportOptions): string {
  const dateStr = options.planDate.toLocaleDateString();
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const lines: string[] = [
    `Session Plan - ${dateStr}`,
    '='.repeat(40),
    `Exported At: ${exportedAt}`,
    ...(options.sourcePlanName ? [`Source Plan: ${options.sourcePlanName}`] : []),
    `Targets: ${plan.targets.length}`,
    `Total Time: ${formatDuration(plan.totalImagingTime)}`,
    `Coverage: ${plan.nightCoverage.toFixed(0)}%`,
    `Efficiency: ${plan.efficiency.toFixed(0)}%`,
    `Location: ${options.latitude.toFixed(4)}°, ${options.longitude.toFixed(4)}°`,
    '',
  ];

  for (const scheduled of plan.targets) {
    const desiredMinutes = getDesiredMinutes(scheduled);
    const exposure = getExposureDetails(scheduled);
    lines.push(
      `${scheduled.order}. ${scheduled.target.name}`,
      `   ${formatTimeShort(scheduled.startTime)} - ${formatTimeShort(scheduled.endTime)} (${formatDuration(scheduled.duration)})`,
      `   Plan: ${getPlannedMinutes(scheduled)}m${desiredMinutes ? ` / Desired: ${Math.round(desiredMinutes)}m` : ''} | ${exposure.filter} ${exposure.singleExposureSec}s × ${exposure.subFrames}`,
      `   RA: ${degreesToHMS(scheduled.target.ra)} / Dec: ${degreesToDMS(scheduled.target.dec)}`,
      `   Max Alt: ${scheduled.maxAltitude.toFixed(0)}° | Moon: ${scheduled.moonDistance.toFixed(0)}° | Score: ${scheduled.feasibility.score}`,
      ''
    );
  }

  if (plan.gaps && plan.gaps.length > 0) {
    lines.push('Gaps:');
    for (const gap of plan.gaps) {
      lines.push(`  ${formatTimeShort(gap.start)} - ${formatTimeShort(gap.end)} (${formatDuration(gap.duration)})`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Markdown Export
// ============================================================================

function exportAsMarkdown(plan: SessionPlan, options: PlanExportOptions): string {
  const dateStr = options.planDate.toLocaleDateString();
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const lines: string[] = [
    `# Session Plan — ${dateStr}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Targets | ${plan.targets.length} |`,
    `| Total Imaging Time | ${formatDuration(plan.totalImagingTime)} |`,
    `| Night Coverage | ${plan.nightCoverage.toFixed(0)}% |`,
    `| Efficiency | ${plan.efficiency.toFixed(0)}% |`,
    `| Exported At | ${exportedAt} |`,
    ...(options.sourcePlanName ? [`| Source Plan | ${options.sourcePlanName} |`] : []),
    `| Location | ${options.latitude.toFixed(4)}°, ${options.longitude.toFixed(4)}° |`,
    '',
    '## Schedule',
    '',
    '| # | Target | Time | Duration | Alt | Moon | Score | Exposure | Minutes |',
    '|---|--------|------|----------|-----|------|-------|----------|---------|',
  ];

  for (const s of plan.targets) {
    const desiredMinutes = getDesiredMinutes(s);
    const exposure = getExposureDetails(s);
    lines.push(
      `| ${s.order} | ${s.target.name} | ${formatTimeShort(s.startTime)}–${formatTimeShort(s.endTime)} | ${formatDuration(s.duration)} | ${s.maxAltitude.toFixed(0)}° | ${s.moonDistance.toFixed(0)}° | ${s.feasibility.score} | ${exposure.filter} ${exposure.singleExposureSec}s × ${exposure.subFrames} | ${getPlannedMinutes(s)}m${desiredMinutes ? ` / ${Math.round(desiredMinutes)}m` : ''} |`
    );
  }

  if (plan.gaps && plan.gaps.length > 0) {
    lines.push('', '## Gaps', '');
    for (const gap of plan.gaps) {
      lines.push(`- ${formatTimeShort(gap.start)} – ${formatTimeShort(gap.end)} (${formatDuration(gap.duration)})`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// JSON Export
// ============================================================================

function exportAsJSON(plan: SessionPlan, options: PlanExportOptions): string {
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const exportData = {
    exportVersion: 1,
    exportDate: exportedAt,
    planDate: options.planDate.toISOString(),
    source: {
      planId: options.sourcePlanId,
      planName: options.sourcePlanName,
    },
    location: {
      name: options.locationName,
      latitude: options.latitude,
      longitude: options.longitude,
    },
    summary: {
      targetCount: plan.targets.length,
      totalImagingTime: plan.totalImagingTime,
      nightCoverage: plan.nightCoverage,
      efficiency: plan.efficiency,
    },
    targets: plan.targets.map((s: ScheduledTarget) => ({
      name: s.target.name,
      ra: s.target.ra,
      dec: s.target.dec,
      raHMS: degreesToHMS(s.target.ra),
      decDMS: degreesToDMS(s.target.dec),
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      duration: s.duration,
      maxAltitude: s.maxAltitude,
      moonDistance: s.moonDistance,
      feasibilityScore: s.feasibility.score,
      feasibilityRec: s.feasibility.recommendation,
      exposure: getExposureDetails(s),
      plannedMinutes: getPlannedMinutes(s),
      desiredTotalMinutes: getDesiredMinutes(s),
      order: s.order,
    })),
    gaps: (plan.gaps ?? []).map(g => ({
      start: g.start.toISOString(),
      end: g.end.toISOString(),
      duration: g.duration,
    })),
  };
  return JSON.stringify(exportData, null, 2);
}

// ============================================================================
// NINA Legacy/Simple Sequencer XML Export (Target Set)
// ============================================================================

function exportAsNinaXml(plan: SessionPlan, options: PlanExportOptions): string {
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const exportedAt = options.exportedAt ?? new Date().toISOString();

  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<!-- Exported from Cobalt Skymap Session Planner - ${options.planDate.toLocaleDateString()} (${exportedAt}) -->`,
    ...(options.sourcePlanName ? [`<!-- Source Plan: ${escXml(options.sourcePlanName)} -->`] : []),
    '<ArrayOfCaptureSequenceList xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
  ];

  for (const s of plan.targets) {
    const exposure = getExposureDetails(s);
    const raHours = (((s.target.ra % 360) + 360) % 360) / 15;
    const decDeg = s.target.dec;
    const raParts = splitRaDegToHms(s.target.ra);
    const decParts = splitDecDegToDms(s.target.dec);

    lines.push(
      `  <CaptureSequenceList TargetName="${escXml(s.target.name)}" Mode="STANDARD" RAHours="${raParts.hours}" RAMinutes="${raParts.minutes}" RASeconds="${raParts.seconds.toFixed(5)}" NegativeDec="${decParts.negative}" DecDegrees="${decParts.degrees}" DecMinutes="${decParts.minutes}" DecSeconds="${decParts.seconds.toFixed(5)}" PositionAngle="0" Delay="0" SlewToTarget="true" CenterTarget="true">`,
      `    <Coordinates>`,
      `      <RA>${raHours.toFixed(6)}</RA>`,
      `      <Dec>${decDeg.toFixed(6)}</Dec>`,
      `      <Epoch>J2000</Epoch>`,
      `    </Coordinates>`,
      `    <CaptureSequence>`,
      `      <Enabled>true</Enabled>`,
      `      <ExposureTime>${exposure.singleExposureSec}</ExposureTime>`,
      `      <ImageType>LIGHT</ImageType>`,
      `      <FilterType>`,
      `        <Name>${escXml(exposure.filter)}</Name>`,
      `      </FilterType>`,
      `      <Binning>`,
      `        <X>1</X>`,
      `        <Y>1</Y>`,
      `      </Binning>`,
      `      <Gain>${exposure.gain}</Gain>`,
      `      <Offset>${exposure.offset}</Offset>`,
      `      <TotalExposureCount>${exposure.subFrames}</TotalExposureCount>`,
      `    </CaptureSequence>`,
      `  </CaptureSequenceList>`,
    );
  }

  lines.push(
    '</ArrayOfCaptureSequenceList>'
  );

  return lines.join('\n');
}

// ============================================================================
// CSV Export
// ============================================================================

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function exportAsCsv(plan: SessionPlan, options: PlanExportOptions): string {
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const rows = [
    'order,name,ra_deg,dec_deg,ra_hms,dec_dms,start_time,end_time,duration_hours,max_altitude_deg,moon_distance_deg,feasibility_score,filter,single_exposure_sec,subframes,planned_minutes,desired_total_minutes,plan_date_iso,exported_at_iso,source_plan_id,source_plan_name',
  ];

  for (const target of plan.targets) {
    const exposure = getExposureDetails(target);
    rows.push([
      target.order,
      escapeCsv(target.target.name),
      target.target.ra.toFixed(6),
      target.target.dec.toFixed(6),
      escapeCsv(degreesToHMS(target.target.ra)),
      escapeCsv(degreesToDMS(target.target.dec)),
      escapeCsv(target.startTime.toISOString()),
      escapeCsv(target.endTime.toISOString()),
      target.duration.toFixed(3),
      target.maxAltitude.toFixed(2),
      target.moonDistance.toFixed(2),
      target.feasibility.score,
      escapeCsv(exposure.filter),
      exposure.singleExposureSec,
      exposure.subFrames,
      getPlannedMinutes(target),
      getDesiredMinutes(target) ?? '',
      escapeCsv(options.planDate.toISOString()),
      escapeCsv(exportedAt),
      escapeCsv(options.sourcePlanId ?? ''),
      escapeCsv(options.sourcePlanName ?? ''),
    ].join(','));
  }

  return rows.join('\n');
}

// ============================================================================
// SGP CSV Export (Import Wizard friendly)
// ============================================================================

function exportAsSgpCsv(plan: SessionPlan): string {
  const rows = ['name,ra,dec,start,duration,filter,exposure,subframes'];
  for (const target of plan.targets) {
    rows.push([
      escapeCsv(target.target.name),
      escapeCsv(degreesToHMS(target.target.ra)),
      escapeCsv(degreesToDMS(target.target.dec)),
      escapeCsv(target.startTime.toISOString()),
      Math.max(1, Math.round(target.duration * 60)),
      'L',
      300,
      -1,
    ].join(','));
  }
  return rows.join('\n');
}

// ============================================================================
// Public API
// ============================================================================

export function exportSessionPlan(plan: SessionPlan, options: PlanExportOptions): string {
  const normalizedOptions: PlanExportOptions = {
    ...options,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
  };
  switch (options.format) {
    case 'text':
      return exportAsText(plan, normalizedOptions);
    case 'markdown':
      return exportAsMarkdown(plan, normalizedOptions);
    case 'json':
      return exportAsJSON(plan, normalizedOptions);
    case 'nina-xml':
      return exportAsNinaXml(plan, normalizedOptions);
    case 'csv':
      return exportAsCsv(plan, normalizedOptions);
    case 'sgp-csv':
      return exportAsSgpCsv(plan);
    default:
      return exportAsText(plan, normalizedOptions);
  }
}

export function getExportFileExtension(format: PlanExportFormat): string {
  switch (format) {
    case 'text': return '.txt';
    case 'markdown': return '.md';
    case 'json': return '.json';
    case 'nina-xml': return '.xml';
    case 'csv': return '.csv';
    case 'sgp-csv': return '.csv';
    default: return '.txt';
  }
}

export function getExportMimeType(format: PlanExportFormat): string {
  switch (format) {
    case 'text': return 'text/plain';
    case 'markdown': return 'text/markdown';
    case 'json': return 'application/json';
    case 'nina-xml': return 'application/xml';
    case 'csv': return 'text/csv';
    case 'sgp-csv': return 'text/csv';
    default: return 'text/plain';
  }
}
