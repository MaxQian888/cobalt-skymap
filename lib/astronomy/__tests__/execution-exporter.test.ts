import { exportExecutionSummary } from '../execution-exporter';
import type { ObservationSession } from '@/lib/tauri/types';

function makeExecutionSession(): ObservationSession {
  return {
    id: 'session-1',
    date: '2025-06-15',
    observations: [
      {
        id: 'obs-1',
        object_name: 'M31',
        observed_at: '2025-06-15T20:45:00.000Z',
        image_paths: [],
        execution_target_id: 'target-1',
      },
    ],
    equipment_ids: [],
    source_plan_id: 'plan-1',
    source_plan_name: 'Tonight Plan',
    execution_status: 'completed',
    execution_summary: {
      completed_targets: 1,
      skipped_targets: 1,
      failed_targets: 0,
      total_targets: 2,
      total_observations: 1,
    },
    execution_targets: [
      {
        id: 'exec-target-1',
        target_id: 'target-1',
        target_name: 'M31',
        scheduled_start: '2025-06-15T20:30:00.000Z',
        scheduled_end: '2025-06-15T22:00:00.000Z',
        scheduled_duration_minutes: 90,
        order: 1,
        status: 'completed',
        observation_ids: ['obs-1'],
      },
      {
        id: 'exec-target-2',
        target_id: 'target-2',
        target_name: 'M42',
        scheduled_start: '2025-06-15T22:15:00.000Z',
        scheduled_end: '2025-06-15T23:15:00.000Z',
        scheduled_duration_minutes: 60,
        order: 2,
        status: 'skipped',
        observation_ids: [],
        skip_reason: 'Clouds',
      },
    ],
    created_at: '2025-06-15T19:00:00.000Z',
    updated_at: '2025-06-15T23:20:00.000Z',
  };
}

describe('execution-exporter', () => {
  it('exports markdown summary with completed and skipped targets', () => {
    const output = exportExecutionSummary(makeExecutionSession(), {
      format: 'markdown',
    });

    expect(output).toContain('# Observation Execution Summary');
    expect(output).toContain('Tonight Plan');
    expect(output).toContain('M31');
    expect(output).toContain('completed');
    expect(output).toContain('M42');
    expect(output).toContain('skipped');
  });

  it('exports json summary with execution metadata', () => {
    const output = exportExecutionSummary(makeExecutionSession(), {
      format: 'json',
    });

    const parsed = JSON.parse(output) as {
      sourcePlanId: string;
      targets: Array<{ targetName: string }>;
    };
    expect(parsed.sourcePlanId).toBe('plan-1');
    expect(parsed.targets).toHaveLength(2);
    expect(parsed.targets[0].targetName).toBe('M31');
  });

  it('exports csv rows for execution targets', () => {
    const output = exportExecutionSummary(makeExecutionSession(), {
      format: 'csv',
    });

    expect(output).toContain('order,target_name,status');
    expect(output).toContain('"M31",completed');
    expect(output).toContain('"M42",skipped');
  });

  it('falls back to unknown metadata and handles missing targets in markdown', () => {
    const session: ObservationSession = {
      ...makeExecutionSession(),
      source_plan_id: undefined,
      source_plan_name: undefined,
      execution_status: undefined,
      execution_targets: undefined,
    };

    const output = exportExecutionSummary(session, {
      format: 'markdown',
    });

    expect(output).toContain('- Plan: Unknown Plan');
    expect(output).toContain('- Plan ID: unknown');
    expect(output).toContain('- Status: unknown');
    expect(output).toContain('## Targets');
  });

  it('escapes CSV fields and keeps populated actual times', () => {
    const session: ObservationSession = {
      ...makeExecutionSession(),
      execution_targets: [
        {
          id: 'exec-target-1',
          target_id: 'target-1',
          target_name: 'M "31"',
          scheduled_start: '2025-06-15T20:30:00.000Z',
          scheduled_end: '2025-06-15T22:00:00.000Z',
          scheduled_duration_minutes: 90,
          order: 1,
          status: 'completed',
          observation_ids: ['obs-1'],
          actual_start: '2025-06-15T20:35:00.000Z',
          actual_end: '2025-06-15T21:55:00.000Z',
        },
      ],
    };

    const output = exportExecutionSummary(session, {
      format: 'csv',
    });

    expect(output).toContain('"M ""31"""');
    expect(output).toContain('2025-06-15T20:35:00.000Z');
    expect(output).toContain('2025-06-15T21:55:00.000Z');
  });

  it('defaults to markdown when the format is unknown at runtime', () => {
    const output = exportExecutionSummary(
      makeExecutionSession(),
      { format: 'yaml' as never },
    );

    expect(output).toContain('# Observation Execution Summary');
    expect(output).toContain('Tonight Plan');
  });

  it('serializes empty target collections for json and csv exports', () => {
    const session: ObservationSession = {
      ...makeExecutionSession(),
      execution_targets: undefined,
    };

    const jsonOutput = exportExecutionSummary(session, {
      format: 'json',
    });
    const csvOutput = exportExecutionSummary(session, {
      format: 'csv',
    });

    const parsed = JSON.parse(jsonOutput) as { targets: unknown[] };
    expect(parsed.targets).toEqual([]);
    expect(csvOutput.trim()).toBe('order,target_name,status,scheduled_start,scheduled_end,actual_start,actual_end,observation_count,skip_reason');
  });
});
