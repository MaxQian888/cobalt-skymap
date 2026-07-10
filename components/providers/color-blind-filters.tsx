/**
 * Hidden SVG color-vision (color blindness) filters.
 *
 * Mounted once at the app root. Each filter is a daltonization
 * `feColorMatrix` simulating a type of color vision deficiency. The active
 * filter is applied to the root `<html>` element via the
 * `[data-color-blind-mode="…"]` selector in globals.css (driven by
 * SettingsSyncProvider), which recolors the entire rendered UI including the
 * star-map canvas.
 *
 * Matrices use the well-known Brettel/Machado simulation approximations.
 */
export function ColorBlindFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs>
        <filter id="cb-protanopia" colorInterpolationFilters="linearRGB">
          <feColorMatrix
            type="matrix"
            values="0.567 0.433 0     0 0
                    0.558 0.442 0     0 0
                    0     0.242 0.758 0 0
                    0     0     0     1 0"
          />
        </filter>
        <filter id="cb-deuteranopia" colorInterpolationFilters="linearRGB">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0    0 0
                    0.70  0.30  0    0 0
                    0     0.30  0.70 0 0
                    0     0     0    1 0"
          />
        </filter>
        <filter id="cb-tritanopia" colorInterpolationFilters="linearRGB">
          <feColorMatrix
            type="matrix"
            values="0.95 0.05  0     0 0
                    0    0.433 0.567 0 0
                    0    0.475 0.525 0 0
                    0    0     0     1 0"
          />
        </filter>
        <filter id="cb-achromatopsia" colorInterpolationFilters="linearRGB">
          <feColorMatrix
            type="matrix"
            values="0.299 0.587 0.114 0 0
                    0.299 0.587 0.114 0 0
                    0.299 0.587 0.114 0 0
                    0     0     0     1 0"
          />
        </filter>
      </defs>
    </svg>
  );
}
