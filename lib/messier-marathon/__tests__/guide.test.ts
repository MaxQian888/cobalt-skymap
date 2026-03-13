import {
  evaluateMessierMarathonSession,
  updateMessierMarathonCheckpointStatus,
} from '../guide';

jest.mock('@/lib/catalogs', () => ({
  getMessierObjects: jest.fn(() => ([
    { id: 'M74', name: 'M74', ra: 24, dec: 15 },
    { id: 'M42', name: 'M42', ra: 84, dec: -5 },
    { id: 'M51', name: 'M51', ra: 202, dec: 47 },
    { id: 'M13', name: 'M13', ra: 250, dec: 36 },
    { id: 'M30', name: 'M30', ra: 325, dec: -23 },
  ])),
}));

jest.mock('@/lib/astronomy/astro-utils', () => ({
  calculateTwilightTimes: jest.fn(),
  calculateTargetVisibility: jest.fn(),
}));

const { calculateTwilightTimes, calculateTargetVisibility } = jest.requireMock(
  '@/lib/astronomy/astro-utils',
) as {
  calculateTwilightTimes: jest.Mock;
  calculateTargetVisibility: jest.Mock;
};

describe('messier marathon guide domain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds deterministic stage checkpoints and recommended readiness', () => {
    calculateTwilightTimes.mockReturnValue({
      astronomicalDusk: new Date('2026-03-21T19:30:00.000Z'),
      astronomicalDawn: new Date('2026-03-22T05:10:00.000Z'),
      darknessDuration: 9.67,
    });

    calculateTargetVisibility.mockImplementation((ra: number) => {
      switch (ra) {
        case 24:
          return {
            darkImagingStart: new Date('2026-03-21T19:35:00.000Z'),
            darkImagingEnd: new Date('2026-03-21T20:10:00.000Z'),
            darkImagingHours: 0.58,
            transitAltitude: 38,
          };
        case 84:
          return {
            darkImagingStart: new Date('2026-03-21T20:30:00.000Z'),
            darkImagingEnd: new Date('2026-03-21T22:10:00.000Z'),
            darkImagingHours: 1.67,
            transitAltitude: 56,
          };
        case 202:
          return {
            darkImagingStart: new Date('2026-03-21T23:00:00.000Z'),
            darkImagingEnd: new Date('2026-03-22T01:40:00.000Z'),
            darkImagingHours: 2.67,
            transitAltitude: 71,
          };
        case 250:
          return {
            darkImagingStart: new Date('2026-03-22T03:10:00.000Z'),
            darkImagingEnd: new Date('2026-03-22T04:10:00.000Z'),
            darkImagingHours: 1,
            transitAltitude: 62,
          };
        case 325:
          return {
            darkImagingStart: new Date('2026-03-22T04:45:00.000Z'),
            darkImagingEnd: new Date('2026-03-22T05:05:00.000Z'),
            darkImagingHours: 0.33,
            transitAltitude: 29,
          };
        default:
          return {
            darkImagingStart: null,
            darkImagingEnd: null,
            darkImagingHours: 0,
            transitAltitude: 0,
          };
      }
    });

    const result = evaluateMessierMarathonSession({
      date: new Date('2026-03-21T12:00:00.000Z'),
      latitude: 35,
      longitude: -105,
    });

    expect(result.readiness).toBe('recommended');
    expect(result.visibleTargetCount).toBe(5);
    expect(result.checkpoints.map((checkpoint) => checkpoint.targetId)).toEqual([
      'M74',
      'M42',
      'M51',
      'M13',
      'M30',
    ]);
    expect(result.checkpoints.filter((checkpoint) => checkpoint.critical).map((checkpoint) => checkpoint.targetId)).toEqual([
      'M74',
      'M30',
    ]);
    expect(result.stages.map((stage) => stage.id)).toEqual([
      'dusk',
      'early-evening',
      'prime-night',
      'pre-dawn',
      'final-window',
    ]);
    expect(result.recovery.mode).toBe('full');
    expect(result.recovery.nextCheckpointId).toBe('M74');
  });

  it('marks the night as not recommended when astronomical darkness is missing', () => {
    calculateTwilightTimes.mockReturnValue({
      astronomicalDusk: null,
      astronomicalDawn: null,
      darknessDuration: 0,
    });
    calculateTargetVisibility.mockReturnValue({
      darkImagingStart: null,
      darkImagingEnd: null,
      darkImagingHours: 0,
      transitAltitude: 0,
    });

    const result = evaluateMessierMarathonSession({
      date: new Date('2026-06-15T12:00:00.000Z'),
      latitude: 69,
      longitude: 18,
    });

    expect(result.readiness).toBe('not_recommended');
    expect(result.limitingFactors.map((factor) => factor.code)).toContain(
      'no-astronomical-night',
    );
    expect(result.checkpoints).toHaveLength(0);
  });

  it('switches to best-effort recovery when a critical checkpoint is skipped', () => {
    calculateTwilightTimes.mockReturnValue({
      astronomicalDusk: new Date('2026-03-21T19:30:00.000Z'),
      astronomicalDawn: new Date('2026-03-22T05:10:00.000Z'),
      darknessDuration: 9.67,
    });
    calculateTargetVisibility.mockImplementation((ra: number) => ({
      darkImagingStart: new Date(ra === 24 ? '2026-03-21T19:35:00.000Z' : '2026-03-21T23:00:00.000Z'),
      darkImagingEnd: new Date(ra === 24 ? '2026-03-21T20:10:00.000Z' : '2026-03-22T01:00:00.000Z'),
      darkImagingHours: ra === 24 ? 0.58 : 2,
      transitAltitude: 50,
    }));

    const session = evaluateMessierMarathonSession({
      date: new Date('2026-03-21T12:00:00.000Z'),
      latitude: 35,
      longitude: -105,
    });

    const updated = updateMessierMarathonCheckpointStatus(session, 'M74', 'skipped');

    expect(updated.recovery.mode).toBe('best_effort');
    expect(updated.recovery.reasonCode).toBe('critical-checkpoint-missed');
    expect(updated.recovery.catchUpTargetIds[0]).toBe('M42');
    expect(updated.recovery.nextCheckpointId).toBe('M42');
    expect(updated.checkpoints.find((checkpoint) => checkpoint.targetId === 'M74')?.status).toBe('skipped');
  });
});
