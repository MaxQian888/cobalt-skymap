/**
 * @jest-environment jsdom
 */

import { buildGitHubIssueUrl, redactSensitiveData } from '../feedback-utils';
import type { FeedbackSubmissionPayload } from '@/types/feedback';

function createPayload(overrides?: Partial<FeedbackSubmissionPayload>): FeedbackSubmissionPayload {
  return {
    draft: {
      type: 'bug',
      title: 'Star map crashes on open',
      description: 'The app crashes immediately after loading.',
      reproductionSteps: '1. Open app\n2. Click Star Map\n3. Crash',
      expectedBehavior: 'Star map should open normally.',
      additionalContext: 'Happens after upgrade.',
      includeSystemInfo: false,
      includeLogs: false,
    },
    diagnostics: null,
    ...overrides,
  };
}

describe('feedback-utils', () => {
  it('builds GitHub issue URL with bug template, title, body and labels', () => {
    const result = buildGitHubIssueUrl(createPayload());
    const parsed = new URL(result.url);

    expect(parsed.origin).toBe('https://github.com');
    expect(parsed.pathname).toBe('/AstroAir/skymap-test/issues/new');
    expect(parsed.searchParams.get('template')).toBe('bug_report.yml');
    expect(parsed.searchParams.get('labels')).toContain('bug');
    expect(parsed.searchParams.get('title')).toContain('[Bug]');
    expect(parsed.searchParams.get('body')).toContain('## Summary');
    expect(result.truncated).toBe(false);
  });

  it('encodes chinese and multiline text correctly', () => {
    const result = buildGitHubIssueUrl(
      createPayload({
        draft: {
          ...createPayload().draft,
          type: 'feature',
          title: '支持中文反馈',
          description: '第一行\n第二行',
          reproductionSteps: '当前流程不便',
          expectedBehavior: '希望提供更顺畅的提交体验',
        },
      })
    );
    const parsed = new URL(result.url);

    expect(parsed.searchParams.get('template')).toBe('feature_request.yml');
    expect(parsed.searchParams.get('title')).toContain('支持中文反馈');
    expect(parsed.searchParams.get('body')).toContain('第一行');
    expect(parsed.searchParams.get('body')).toContain('第二行');
  });

  it('falls back to shortened body when URL is too long', () => {
    const longText = 'x'.repeat(12000);
    const result = buildGitHubIssueUrl(
      createPayload({
        diagnostics: {
          generatedAt: new Date('2026-02-20T00:00:00.000Z').toISOString(),
          app: {
            name: 'Cobalt Skymap',
            version: '0.1.0',
            buildDate: '2026-02-20',
            environment: 'web',
          },
          logs: longText,
        },
        draft: {
          ...createPayload().draft,
          additionalContext: longText,
          includeLogs: true,
        },
      }),
      1200
    );

    const parsed = new URL(result.url);
    const body = parsed.searchParams.get('body') ?? '';

    expect(result.truncated).toBe(true);
    expect(result.fallbackNote).toBeTruthy();
    expect(body).toContain('Issue body was shortened');
  });

  it('keeps derived host identity and excludes raw hostname in diagnostics summary', () => {
    const result = buildGitHubIssueUrl(
      createPayload({
        diagnostics: {
          generatedAt: new Date('2026-03-11T00:00:00.000Z').toISOString(),
          app: {
            name: 'Cobalt Skymap',
            version: '0.1.0',
            buildDate: '2026-03-11',
            environment: 'tauri',
          },
          system: {
            os: 'windows',
            arch: 'x86_64',
            appVersion: '0.1.0',
            tauriVersion: '2.9.0',
            hostId: 'host-9a2b1c3d',
            ...( { hostname: 'MY-DESKTOP' } as unknown as Record<string, unknown>),
          } as unknown as NonNullable<FeedbackSubmissionPayload['diagnostics']>['system'],
        },
      })
    );

    const body = new URL(result.url).searchParams.get('body') ?? '';
    expect(body).toContain('host-9a2b1c3d');
    expect(body).not.toContain('MY-DESKTOP');
    expect(body).not.toContain('hostname');
  });

  it('redacts common sensitive data patterns', () => {
    const input = [
      'authorization: Bearer abc123',
      'password=secret123',
      'token=abcd',
      'api_key=my-key',
      'mail user@example.com',
      'jwt eyJhbGciOiJIUzI1NiJ9.abc.def',
    ].join('\n');

    const output = redactSensitiveData(input);

    expect(output).not.toContain('abc123');
    expect(output).not.toContain('secret123');
    expect(output).not.toContain('user@example.com');
    expect(output).toContain('[REDACTED_EMAIL]');
    expect(output).toContain('[REDACTED_JWT]');
  });
});

