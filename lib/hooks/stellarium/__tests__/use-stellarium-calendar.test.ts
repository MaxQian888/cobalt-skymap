/**
 * Tests for use-stellarium-calendar.ts
 * Stellarium calendar event query
 */

import { renderHook } from '@testing-library/react';
import { useStellariumCalendar } from '../use-stellarium-calendar';
import { useRef } from 'react';

describe('useStellariumCalendar', () => {
  it('should return runCalendar function', () => {
    const { result } = renderHook(() => {
      const ref = useRef(null);
      return useStellariumCalendar(ref);
    });
    expect(typeof result.current.runCalendar).toBe('function');
  });

  it('should return empty array when stel is null', async () => {
    const { result } = renderHook(() => {
      const ref = useRef(null);
      return useStellariumCalendar(ref);
    });
    const events = await result.current.runCalendar({
      start: new Date(),
      end: new Date(),
    });
    expect(events).toEqual([]);
  });

  it('should call stel.calendar when engine is available', async () => {
    const calendarFn = jest.fn(({ onEvent }: { onEvent: (event: unknown) => void }) => {
      onEvent({ type: 'rise' });
      onEvent({ type: 'set' });
    });
    const mockStel = { calendar: calendarFn };

    const { result } = renderHook(() => {
      const ref = useRef(mockStel);
      return useStellariumCalendar(ref as never);
    });

    const events = await result.current.runCalendar({
      start: new Date('2024-01-01'),
      end: new Date('2024-01-02'),
    });

    expect(calendarFn).toHaveBeenCalledTimes(1);
    expect(events).toEqual([{ type: 'rise' }, { type: 'set' }]);
  });
});
