/**
 * @jest-environment jsdom
 */
import { buildAstroCalculatorExportText } from '../result-actions';

describe('buildAstroCalculatorExportText', () => {
  it('includes target identity, observer context, diagnostics, and visible result lines', () => {
    const text = buildAstroCalculatorExportText({
      title: 'Ephemeris Export',
      fileStem: 'astro-calculator-ephemeris',
      targetName: '1P/Halley',
      observerContext: {
        locationId: 'site-1',
        locationName: 'Mountain Base',
        latitude: 35.1234,
        longitude: 117.9876,
        elevation: 1250,
        timezone: 'America/Los_Angeles',
        sharedDate: '2025-01-01',
        sharedTime: '22:00',
        source: 'saved-location',
        contextKey: 'context-1',
        constraints: {
          minAltitude: 15,
          moonInterference: 'moderate',
          horizonProfileId: null,
        },
      },
      metaSummary: {
        total: 2,
        sourceCounts: { tauri: 0, fallback: 2 },
        cacheHits: 1,
        cacheMisses: 1,
        degradedCount: 1,
        warningsCount: 2,
        latestComputedAt: '2025-01-01T00:00:00.000Z',
      },
      diagnostics: ['Small-body source=horizons', 'Resolved target=1P/Halley'],
      contentLines: [
        '2025-01-01T00:00:00.000Z | RA=08h18m | Dec=+12d',
        '2025-01-01T01:00:00.000Z | RA=08h19m | Dec=+12d',
      ],
    });

    expect(text).toContain('Ephemeris Export');
    expect(text).toContain('Target: 1P/Halley');
    expect(text).toContain('Site: Mountain Base');
    expect(text).toContain('Timezone: America/Los_Angeles');
    expect(text).toContain('Constraints: minAltitude=15 moonInterference=moderate');
    expect(text).toContain('Diagnostics: tauri=0 fallback=2 cacheHits=1 cacheMisses=1 degraded=1 warnings=2');
    expect(text).toContain('Note: Small-body source=horizons');
    expect(text).toContain('Note: Resolved target=1P/Halley');
    expect(text).toContain('2025-01-01T00:00:00.000Z | RA=08h18m | Dec=+12d');
  });
});
