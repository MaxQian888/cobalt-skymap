import { convertTauriEvents, mapEventType } from '../event-utils';

describe('event-utils', () => {
  it('maps all known event type families to canonical categories', () => {
    expect(mapEventType('new_moon')).toBe('lunar_phase');
    expect(mapEventType('solar_eclipse')).toBe('eclipse');
    expect(mapEventType('major_meteor_shower')).toBe('meteor_shower');
    expect(mapEventType('planetary_conjunction')).toBe('planet_conjunction');
    expect(mapEventType('mars_opposition')).toBe('planet_opposition');
    expect(mapEventType('greatest_elongation')).toBe('planet_elongation');
    expect(mapEventType('spring_equinox')).toBe('equinox_solstice');
    expect(mapEventType('winter_solstice')).toBe('equinox_solstice');
  });

  it('maps unknown event types to other', () => {
    expect(mapEventType('totally_unknown_event')).toBe('other');
  });

  it('converts tauri timestamp to date and keeps active window', () => {
    const converted = convertTauriEvents([
      {
        id: 'test-window',
        event_type: 'meteor_shower',
        name: 'Perseids',
        date: '2024-08-12',
        time: null,
        timestamp: 1723420800,
        description: 'Meteor shower',
        visibility: 'good',
        magnitude: null,
        details: {
          active_end: '2024-08-24',
        },
      },
    ]);

    expect(converted).toHaveLength(1);
    expect(converted[0].type).toBe('meteor_shower');
    expect(converted[0].date.toISOString()).toContain('2024-08-12');
    expect(converted[0].endDate?.toISOString()).toContain('2024-08-24');
  });

  it('falls back to date+time parsing when timestamp is missing', () => {
    const converted = convertTauriEvents([
      {
        id: 'test-time',
        event_type: 'full_moon',
        name: 'Full Moon',
        date: '2024-09-18',
        time: '02:44:00',
        description: 'Lunar phase',
      },
    ]);

    expect(converted[0].date.toISOString()).toContain('2024-09-18T02:44:00');
  });

  it('prefers ends_at, defaults visibility, and tolerates invalid timestamps', () => {
    const converted = convertTauriEvents([
      {
        id: 'test-fallbacks',
        event_type: 'solar_eclipse',
        name: 'Eclipse',
        date: 'not-a-date',
        time: '25:61:00',
        description: 'Fallback handling',
        visibility: null,
        magnitude: null,
        details: {
          ends_at: '2024-04-09T00:00:00.000Z',
          active_end: '2024-04-10T00:00:00.000Z',
        },
      },
    ]);

    expect(converted[0].type).toBe('eclipse');
    expect(converted[0].visibility).toBe('good');
    expect(converted[0].magnitude).toBeUndefined();
    expect(converted[0].endDate?.toISOString()).toBe('2024-04-09T00:00:00.000Z');
    expect(Number.isNaN(converted[0].date.getTime())).toBe(false);
  });

  it('parses plain dates and drops invalid optional end dates', () => {
    const converted = convertTauriEvents([
      {
        id: 'test-date-only',
        event_type: 'meteor_shower',
        name: 'Date Only Event',
        date: '2024-10-01',
        description: 'No explicit time',
        details: {
          ends_at: 'not-a-date',
          active_end: '',
        },
      },
    ]);

    expect(converted[0].date.toISOString()).toContain('2024-10-01');
    expect(converted[0].endDate).toBeUndefined();
  });
});
