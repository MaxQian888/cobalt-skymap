/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';
import {
  EVENT_COLOR_MAP,
  EVENT_ICON_MAP,
  EVENT_TYPE_LABEL_KEYS,
  getEventColorClass,
  getEventIcon,
  getEventIconComponent,
  getEventTypeLabelKey,
} from '../event-visuals';

const EVENT_TYPES = [
  'lunar_phase',
  'meteor_shower',
  'planet_conjunction',
  'eclipse',
  'planet_opposition',
  'planet_elongation',
  'equinox_solstice',
  'comet',
  'asteroid',
  'supernova',
  'aurora',
  'other',
] as const;

describe('event-visuals', () => {
  it('defines icon, color, and label key for every event type', () => {
    for (const type of EVENT_TYPES) {
      expect(EVENT_ICON_MAP[type]).toBeDefined();
      expect(EVENT_COLOR_MAP[type]).toBeDefined();
      expect(EVENT_TYPE_LABEL_KEYS[type]).toBe(`eventDetail.typeLabel.${type}`);
    }
  });

  it('falls back to the "other" visuals for an unknown type', () => {
    expect(getEventIconComponent('totally-unknown')).toBe(EVENT_ICON_MAP.other);
    expect(getEventColorClass('totally-unknown')).toBe('text-muted-foreground bg-muted');
    expect(getEventTypeLabelKey('totally-unknown')).toBe('eventDetail.typeLabel.other');
  });

  it('renders an icon element with the requested className', () => {
    const { container } = render(<>{getEventIcon('lunar_phase', 'h-5 w-5')}</>);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveClass('h-5', 'w-5');
  });
});
