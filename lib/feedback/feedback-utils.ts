import {
  getLogs,
  type LogEntry,
  formatFullTimestamp,
  LOG_LEVEL_NAMES,
  buildLogDiagnosticsBundle,
} from '@/lib/logger';
import { isTauri } from '@/lib/storage/platform';
import { tauriApi } from '@/lib/tauri/api';
import { EXTERNAL_LINKS } from '@/lib/constants/external-links';
import type {
  FeedbackDiagnostics,
  FeedbackDraft,
  FeedbackSubmissionPayload,
  FeedbackType,
  FeedbackUrlBuildResult,
  FeedbackSeverity,
  FeedbackPriority,
} from '@/types/feedback';

const APP_NAME = 'Cobalt Skymap';
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';
const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE || '';
const URL_LENGTH_THRESHOLD = 7000;
const MAX_LOG_ENTRIES = 200;

function formatLogEntry(entry: LogEntry): string {
  const timestamp = entry.timestamp instanceof Date
    ? formatFullTimestamp(entry.timestamp)
    : String(entry.timestamp);
  const level = LOG_LEVEL_NAMES[entry.level] ?? 'info';
  let line = `[${timestamp}] [${level.toUpperCase()}] [${entry.module}] ${entry.message}`;
  if ((entry.occurrenceCount ?? 1) > 1) {
    line += `\nOccurrences: ${entry.occurrenceCount} (${entry.firstTimestamp?.toISOString()} -> ${entry.lastTimestamp?.toISOString()})`;
  }
  if (entry.data !== undefined) {
    line += `\nData: ${safeStringify(entry.data)}`;
  }
  if (entry.stack) {
    line += `\nStack:\n${entry.stack}`;
  }
  return line;
}

function safeStringify(value: unknown): string {
  try {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeLines(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}\n...[truncated]`;
}

function defaultLabels(type: FeedbackType, severity?: FeedbackSeverity, priority?: FeedbackPriority): string[] {
  const labels = type === 'bug' ? ['bug'] : ['enhancement'];
  if (type === 'bug' && severity) {
    labels.push(`severity:${severity}`);
  }
  if (type === 'feature' && priority) {
    labels.push(`priority:${priority}`);
  }
  return labels;
}

function defaultTemplate(type: FeedbackType): string {
  return type === 'bug' ? 'bug_report.yml' : 'feature_request.yml';
}

function buildTitle(type: FeedbackType, title: string): string {
  const prefix = type === 'bug' ? '[Bug]' : '[Feature]';
  return `${prefix} ${title.trim()}`.trim();
}

function sanitizeSystemDiagnostics(
  system: FeedbackDiagnostics['system'] | undefined
): FeedbackDiagnostics['system'] | undefined {
  if (!system) {
    return undefined;
  }

  // Explicitly whitelist fields to avoid leaking raw hostnames or unknown keys.
  return {
    os: system.os,
    arch: system.arch,
    tauriVersion: system.tauriVersion,
    appVersion: system.appVersion,
    platform: system.platform,
    hardwareConcurrency: system.hardwareConcurrency,
    language: system.language,
    family: system.family,
    osType: system.osType,
    osVersion: system.osVersion,
    locale: system.locale,
    exeExtension: system.exeExtension,
    hostId: system.hostId,
  };
}

function summarizeDiagnostics(diagnostics: FeedbackDiagnostics): Record<string, unknown> {
  return {
    generatedAt: diagnostics.generatedAt,
    app: diagnostics.app,
    system: sanitizeSystemDiagnostics(diagnostics.system) ?? null,
    includesLogs: Boolean(diagnostics.logs),
    logLength: diagnostics.logs?.length ?? 0,
  };
}

function createMinimalPayload(payload: FeedbackSubmissionPayload): FeedbackSubmissionPayload {
  const { draft, diagnostics } = payload;
  const minimizedDraft: FeedbackDraft = {
    ...draft,
    description: truncate(draft.description, 1600),
    reproductionSteps: truncate(draft.reproductionSteps, 1200),
    expectedBehavior: truncate(draft.expectedBehavior, 1200),
    additionalContext: truncate(draft.additionalContext, 900),
  };
  const minimizedDiagnostics = diagnostics
    ? {
        ...diagnostics,
        logs: undefined,
      }
    : undefined;
  return {
    ...payload,
    draft: minimizedDraft,
    diagnostics: minimizedDiagnostics,
  };
}

export function redactSensitiveData(input: string): string {
  if (!input) {
    return input;
  }

  const replacements: Array<[RegExp, string]> = [
    [/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi, '[REDACTED_EMAIL]'],
    [/\b(authorization|token|password|passwd|pwd|secret|api[_-]?key|cookie|set-cookie)\s*[:=]\s*([^\r\n]+)/gi, '$1=[REDACTED]'],
    [/[?&](access_token|token|api_key|apikey|key|password)=([^&\s]+)/gi, '?$1=[REDACTED]'],
    [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g, '[REDACTED_JWT]'],
  ];

  return replacements.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), input);
}

export async function collectDiagnostics(options: {
  includeSystemInfo: boolean;
  includeLogs: boolean;
}): Promise<FeedbackDiagnostics | null> {
  if (!options.includeSystemInfo && !options.includeLogs) {
    return null;
  }

  const diagnostics: FeedbackDiagnostics = {
    generatedAt: new Date().toISOString(),
    app: {
      name: APP_NAME,
      version: APP_VERSION,
      buildDate: BUILD_DATE,
      environment: isTauri() ? 'tauri' : 'web',
      locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
      href: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    },
  };

  if (options.includeSystemInfo) {
    if (isTauri()) {
      try {
        const systemInfo = await tauriApi.appSettings.getSystemInfo();
        diagnostics.system = sanitizeSystemDiagnostics({
          os: systemInfo.os,
          arch: systemInfo.arch,
          tauriVersion: systemInfo.tauri_version,
          appVersion: systemInfo.app_version,
          family: systemInfo.family,
          osType: systemInfo.os_type,
          osVersion: systemInfo.os_version,
          locale: systemInfo.locale,
          exeExtension: systemInfo.exe_extension,
          hostId: systemInfo.host_id,
          platform: systemInfo.platform ?? (typeof navigator !== 'undefined' ? navigator.platform : undefined),
          hardwareConcurrency:
            typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
          language: typeof navigator !== 'undefined' ? navigator.language : undefined,
        });
      } catch {
        diagnostics.system = sanitizeSystemDiagnostics({
          platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
          hardwareConcurrency:
            typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
          language: typeof navigator !== 'undefined' ? navigator.language : undefined,
        });
      }
    } else {
      diagnostics.system = sanitizeSystemDiagnostics({
        platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
        hardwareConcurrency:
          typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
        language: typeof navigator !== 'undefined' ? navigator.language : undefined,
      });
    }
  }

  if (options.includeLogs) {
    const logs = getLogs()
      .slice(-MAX_LOG_ENTRIES)
      .map((entry) => formatLogEntry(entry))
      .join('\n\n');
    diagnostics.logs = redactSensitiveData(logs);
  }

  return diagnostics;
}

export function buildIssueBodyMarkdown(payload: FeedbackSubmissionPayload): string {
  const { draft, diagnostics } = payload;
  const description = redactSensitiveData(normalizeLines(draft.description));
  const steps = redactSensitiveData(normalizeLines(draft.reproductionSteps));
  const expected = redactSensitiveData(normalizeLines(draft.expectedBehavior));
  const additional = redactSensitiveData(normalizeLines(draft.additionalContext));

  const sections: string[] = [];

  sections.push(`## ${draft.type === 'bug' ? 'Summary' : 'Feature Summary'}`);
  sections.push(description || '_No description provided._');

  if (draft.type === 'bug' && draft.severity) {
    sections.push(`**Severity:** ${draft.severity}`);
  }
  if (draft.type === 'feature' && draft.priority) {
    sections.push(`**Priority:** ${draft.priority}`);
  }

  if (draft.type === 'bug') {
    sections.push('## Steps To Reproduce');
    sections.push(steps || '_Not provided._');
    sections.push('## Expected Behavior');
    sections.push(expected || '_Not provided._');
  } else {
    sections.push('## Problem / Use Case');
    sections.push(steps || '_Not provided._');
    sections.push('## Proposed Solution');
    sections.push(expected || '_Not provided._');
  }

  if (additional) {
    sections.push('## Additional Context');
    sections.push(additional);
  }

  if (diagnostics) {
    sections.push('## Diagnostics (Redacted)');
    sections.push('<details><summary>Environment</summary>');
    sections.push('');
    sections.push('```json');
    sections.push(JSON.stringify(summarizeDiagnostics(diagnostics), null, 2));
    sections.push('```');
    sections.push('');
    sections.push('</details>');

    if (diagnostics.logs) {
      sections.push('<details><summary>Recent Logs</summary>');
      sections.push('');
      sections.push('```text');
      sections.push(truncate(redactSensitiveData(diagnostics.logs), 4000));
      sections.push('```');
      sections.push('');
      sections.push('</details>');
    }
  }

  return `${sections.join('\n\n').trim()}\n`;
}

export function buildGitHubIssueUrl(
  payload: FeedbackSubmissionPayload,
  threshold: number = URL_LENGTH_THRESHOLD
): FeedbackUrlBuildResult {
  const labels = payload.labels?.length
    ? payload.labels
    : defaultLabels(payload.draft.type, payload.draft.severity, payload.draft.priority);
  const markdownBody = buildIssueBodyMarkdown(payload);
  const url = EXTERNAL_LINKS.newIssueUrl({
    template: defaultTemplate(payload.draft.type),
    title: buildTitle(payload.draft.type, payload.draft.title),
    body: markdownBody,
    labels,
  });

  if (url.length <= threshold) {
    return {
      url,
      markdownBody,
      truncated: false,
      diagnosticsIncluded: Boolean(payload.diagnostics),
      estimatedLength: url.length,
    };
  }

  const fallbackPayload = createMinimalPayload(payload);
  const fallbackMarkdown = `${buildIssueBodyMarkdown(fallbackPayload)}\n> Issue body was shortened to avoid URL length limits. Please attach the diagnostics bundle manually.\n`;
  const fallbackUrl = EXTERNAL_LINKS.newIssueUrl({
    template: defaultTemplate(fallbackPayload.draft.type),
    title: buildTitle(fallbackPayload.draft.type, fallbackPayload.draft.title),
    body: fallbackMarkdown,
    labels,
  });

  return {
    url: fallbackUrl,
    markdownBody: fallbackMarkdown,
    truncated: true,
    diagnosticsIncluded: Boolean(fallbackPayload.diagnostics),
    estimatedLength: fallbackUrl.length,
    fallbackNote:
      'Issue body was shortened because URL length exceeded the safe threshold. Attach diagnostics bundle manually.',
  };
}

export async function exportDiagnosticsBundle(
  diagnostics: FeedbackDiagnostics
): Promise<string | null> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `skymap-diagnostics-${timestamp}.json`;
  const sanitizedSystem = sanitizeSystemDiagnostics(diagnostics.system);
  const logsBundle = buildLogDiagnosticsBundle(getLogs().slice(-MAX_LOG_ENTRIES), {
    app: diagnostics.app,
    filters: {
      source: 'feedback-export',
      maxEntries: MAX_LOG_ENTRIES,
    },
  });
  const payload = JSON.stringify(
    {
      bundleVersion: '2.0',
      generatedAt: diagnostics.generatedAt,
      runtime: logsBundle.runtime,
      app: diagnostics.app,
      system: sanitizedSystem,
      diagnostics: {
        ...diagnostics,
        system: sanitizedSystem,
        logs: diagnostics.logs ? redactSensitiveData(diagnostics.logs) : undefined,
      },
      logsBundle,
    },
    null,
    2
  );

  if (isTauri()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const path = await save({
        defaultPath: filename,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!path || Array.isArray(path)) {
        return null;
      }
      await writeTextFile(path, payload);
      return path;
    } catch {
      // Fallback to browser download when native save is unavailable.
    }
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}
