/**
 * Helpers for the `hipscache` custom URI scheme that serves HiPS survey tiles
 * through the Rust offline cache (see `src-tauri/src/cache/tile_protocol.rs`).
 *
 * Aladin Lite is given ONLY the base URL; it appends the HiPS-relative path
 * (`Norder{n}/Dir{d}/Npix{p}.{ext}`, `properties`, `Allsky.*`, `Moc.fits`)
 * itself. The Rust handler parses the full path and maps tiles onto the cache.
 */

/** Path prefix the Rust handler expects: `/h/{surveyId}/...`. */
const TILE_PATH_PREFIX = 'h';

/**
 * Reduce a survey id to a URL- and filesystem-safe token. The built-in
 * `SKY_SURVEYS` ids are already safe (`dss`, `panstarrs`, ...); this also
 * covers CDS ids like `P/DSS2/color` -> `P_DSS2_color`. Must mirror the
 * validation in `tile_protocol.rs::is_valid_survey_id`.
 */
export function sanitizeSurveyId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

/**
 * Host form of the custom scheme. Tauri serves custom protocols as
 * `http://<scheme>.localhost/...` on Windows/Android (WebView2) and as
 * `<scheme>://localhost/...` on macOS/Linux. Centralized here so there is a
 * single place to adjust when the runtime host shape is verified per platform.
 */
function tileSchemeOrigin(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isHttpHostPlatform = /Windows|Android/i.test(ua);
  return isHttpHostPlatform ? 'http://hipscache.localhost' : 'hipscache://localhost';
}

/**
 * Build the base survey URL Aladin should load when offline tile caching is
 * active. Aladin appends the HiPS path (`Norder.../Npix...`) directly to this
 * base, so — like every entry in `SKY_SURVEYS` — it MUST end with a trailing
 * slash, otherwise the survey id and `Norder...` segment fuse together.
 */
export function toHipsCacheBase(surveyId: string): string {
  return `${tileSchemeOrigin()}/${TILE_PATH_PREFIX}/${sanitizeSurveyId(surveyId)}/`;
}
