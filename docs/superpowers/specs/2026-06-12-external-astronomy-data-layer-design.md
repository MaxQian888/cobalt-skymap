# External Astronomy Data Layer (D2 + D3) — Design Spec

> **Date:** 2026-06-12
> **Status:** Design approved by user, pending spec review → writing-plans
> **Slice:** First of four (D2+D3) in the "完善星图渲染 / 充分使用两套引擎 / 增加接口" goal.
> **Next slices (later, each own spec→plan):** B (Aladin science: Gaia DR3 progressive catalog, displayFITS, colormap library) · A (Stellarium: comets/asteroids enumeration + Calendar events) · C (cross-engine: angular measurement, box-select).

---

## 1. Goal & Scope

Build a **unified external-astronomy data service layer**: a small set of Rust Tauri commands that fetch live data from external astronomy services, each sharing one fetch/cache/SSRF helper, exposed to the frontend through thin typed TS wrappers and the minimal stores/consumers needed to prove each is wired.

**In scope (4 data sources):**
1. **CelesTrak** — live satellite TLE (replaces stale vendored `tle_satellite.jsonl.gz`).
2. **MPC (Minor Planet Center)** — orbital elements refresh: comets full + bright-asteroid subset (replaces vendored static `CometEls.txt` / `mpcorb.dat`).
3. **JPL Horizons** — high-precision solar-system ephemerides (new capability).
4. **D3 — CDS HiPS / catalog discovery** — extend the existing HiPS registry with catalog-HiPS (Gaia DR3 etc.) discovery + a selection/favorites store (unblocks slice B1).

**Out of scope (deferred to consumer slices):**
- Rich survey-browser UI, Gaia progressive-catalog rendering (slice B1).
- Comet/asteroid visibility toggles + `listObjs` enumeration UI (slice A1).
- Wiring `stel.calendar()` to event UI (slice A2 — note: Calendar is computed in-WASM, needs no network, so it does NOT depend on this layer).
- Background/scheduled auto-refresh (explicitly rejected: chose shared-helper + per-source typed commands over a full Rust service with background refresh).

## 2. Key Facts Backing This Design (verified 2026-06-12)

**Architecture already present (do not rebuild — extend):**
- `lib/services/hips/service.ts` already fetches `aladin.cds.unistra.fr/hips/list` with a 1-day cache and `DEFAULT_SURVEYS`. D3 extends it (catalog-HiPS + selection store), not rewrites it.
- Stellarium already loads `public/stellarium-data/CometEls.txt` and `mpcorb.dat` via `core.comets.addDataSource({url})` / `core.minor_planets.addDataSource({url})`. MPC refresh keeps those current; it does NOT add a new render path.
- `src-tauri/src/network/`: `http_client::http_request` (async, reqwest, retries, progress), `security::validate_url(url, allow_http, allowlist: Option<&[&str]>)`, `rate_limiter::{GlobalRateLimiter, get_command_rate_limit}`. Unified cache: `cache::unified::{get,put}_unified_cache_entry(app, key, data, content_type, ttl_ms)`.
- **SSRF reality:** `http_request` currently passes `allowlist = None` (only localhost/private-IP blocked). A global allowlist would break existing fetches (HiPS tiles, astrometry.net). Therefore new commands validate against **their own per-source host allowlist** and leave `http_request` untouched.
- **CORS reality:** JPL Horizons and MPC are CORS-blocked in the browser → must go through Rust. CelesTrak and CDS allow CORS but route through Rust anyway for unified caching + offline.

**Verified external endpoints:**
- CelesTrak GP API: `https://celestrak.org/NORAD/elements/gp.php?GROUP=<group>&FORMAT=json` (OMM JSON). Refresh cadence ≤ every ~2h.
- MPC: comets `https://www.minorplanetcenter.net/iau/MPCORB/CometEls.txt`; asteroids `https://www.minorplanetcenter.net/iau/MPCORB/MPCORB.DAT` (and `.gz`). MPCORB full is tens of MB gz / >100MB raw — no pre-filtered bright subset URL exists.
- JPL Horizons: `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='<body>'&EPHEM_TYPE='OBSERVER'&CENTER='<center>'&START_TIME=...&STOP_TIME=...&STEP_SIZE=...&QUANTITIES='1,4,9'`. Result text is delimited by `$$SOE` / `$$EOE`. No auth.
- CDS MocServer (catalog discovery): `https://alasky.cds.unistra.fr/MocServer/query?dataproduct_type=catalog&get=record&fmt=json&fields=ID,obs_title,hips_service_url,...`. Gaia DR3 catalog HiPS: `https://hipscat.cds.unistra.fr/HiPSCatService/I/355/gaiadr3`.

## 3. Architecture

```
React consumer
   │
   ▼
lib/tauri/<source>-api.ts   (lazy getInvoke + typed + error mapping)
   │  invoke('<cmd>', args)
   ▼
src-tauri/src/external_data/<source>.rs   #[tauri::command]
   │  reuse
   ▼
external_data::fetch_and_cache(app, url, allowed_hosts, ttl_ms, key)
   = security::validate_url(url, false, Some(allowed_hosts))
   + unified-cache lookup (fresh → return)
   + http_client::http_request (GET) → put_unified_cache_entry
   + stale-if-error fallback (network down → return stale cache)
```

### 3.1 Shared foundation — `external_data/mod.rs`

```rust
#[derive(Debug, thiserror::Error)]
pub enum ExternalDataError {
    #[error("security: {0}")] Security(String),
    #[error("http: {0}")]      Http(String),
    #[error("parse: {0}")]     Parse(String),
    #[error("cache: {0}")]     Cache(String),
    #[error("rate limited; retry after {0}s")] RateLimited(u64),
}
impl Serialize for ExternalDataError { /* serialize_str(self.to_string()) */ }

/// Fetch with per-source SSRF allowlist, unified-cache, and stale-if-error.
async fn fetch_and_cache(
    app: &AppHandle,
    url: &str,
    allowed_hosts: &[&str],
    ttl_ms: i64,
    cache_key: &str,
) -> Result<Vec<u8>, ExternalDataError>;

/// Politeness gate: call GlobalRateLimiter before the network hop.
fn check_rate_limit(command: &str) -> Result<(), ExternalDataError>;
```

- Each source module owns: its `ALLOWED_HOSTS: &[&str]`, its URL builder, its TTL, and a **pure parser** decoupled from `fetch_and_cache` so parsers are unit-testable from fixtures with no network.
- Register the new commands in `rate_limiter::get_command_rate_limit` (conservative for refresh-heavy `fetch_satellite_tle` / `refresh_orbital_data`; moderate for `fetch_horizons_ephemeris`; permissive for `fetch_hips_registry`).

### 3.2 Source ① CelesTrak TLE — `external_data/tle.rs`

```rust
#[tauri::command]
pub async fn fetch_satellite_tle(app: AppHandle, group: String)
    -> Result<Vec<TleEntry>, ExternalDataError>;

pub struct TleEntry { name, norad_id, line1, line2, epoch, .. } // from OMM JSON
```
- URL: `gp.php?GROUP={group}&FORMAT=json`; parse OMM JSON → `TleEntry` (synthesize TLE line1/line2 if the satellite renderer needs classic TLE; otherwise keep OMM fields). TTL **2h**. `ALLOWED_HOSTS = ["celestrak.org", "www.celestrak.org"]`.
- **Consumer:** `lib/stores/satellite-store.ts` gains `refreshFromCelesTrak(group)`; satellite tracker overlay gets a "refresh" affordance. Falls back to vendored static data when offline and no cache.

### 3.3 Source ② MPC orbital elements — `external_data/mpc.rs`

```rust
#[tauri::command]
pub async fn refresh_orbital_data(app: AppHandle, dataset: MpcDataset, max_h: Option<f64>)
    -> Result<OrbitalDataInfo, ExternalDataError>;

pub enum MpcDataset { Comets, Asteroids }
pub struct OrbitalDataInfo { dataset, path: String, count: u64, size_bytes: u64, fetched_at: i64 }
```
- **Comets:** download `CometEls.txt` (small) → write to the Stellarium-readable data path → long TTL (**weekly**).
- **Asteroids (bright subset):** download full `MPCORB.DAT.gz` → **Rust filters by absolute magnitude `H <= max_h` (default ~12, a few thousand objects)** → write only the subset to the data path; the full download is NOT persisted. TTL **monthly**. Progress reported via existing `download-progress` events (large one-time download).
- After write, the frontend triggers Stellarium to re-`addDataSource` the refreshed file so new elements render.
- `ALLOWED_HOSTS = ["www.minorplanetcenter.net", "minorplanetcenter.net", "data.minorplanetcenter.net"]`.
- **Open implementation detail for the plan:** confirm the exact path Stellarium's loader reads comet/asteroid data from (vendored `public/stellarium-data/` vs an app-data `baseUrl`) and make the refresh write to a path the WASM can re-fetch.
- **Consumer:** a "update orbital data" action in the data/cache manager.

### 3.4 Source ③ JPL Horizons — `external_data/horizons.rs`

```rust
#[tauri::command]
pub async fn fetch_horizons_ephemeris(
    app: AppHandle, body: String, center: String,
    start: String, stop: String, step: String,
) -> Result<HorizonsEphemeris, ExternalDataError>;

pub struct HorizonsEphemeris { body, center, rows: Vec<HorizonsRow> }
pub struct HorizonsRow { time, ra_deg, dec_deg, az_deg, el_deg, v_mag, .. }
```
- URL builds the `horizons.api` query (`QUANTITIES='1,4,9'` = astrometric RA/Dec, az/el, vis mag). Parse JSON `result`, slice the `$$SOE … $$EOE` block, parse fixed columns → `rows`. TTL **1h**, cache key = hash of full query. `ALLOWED_HOSTS = ["ssd.jpl.nasa.gov", "ssd-api.jpl.nasa.gov"]`.
- **Consumer:** solar-system object info panel shows a "JPL high-precision position / rise-set" line (minimal, proves the path); deeper planning use deferred.

### 3.5 Source ④ D3 — CDS HiPS / catalog discovery — `external_data/hips_discovery.rs` + `lib/services/hips/`

```rust
#[tauri::command]
pub async fn fetch_hips_registry(app: AppHandle, kind: HipsKind)
    -> Result<Vec<u8>, ExternalDataError>;   // raw, cached, CORS-safe proxy

pub enum HipsKind { ImageSurveys, Catalogs }
```
- `Catalogs` → MocServer query (`dataproduct_type=catalog&get=record&fmt=json`). `ImageSurveys` → existing `hips/list` (now routed through Rust for cache+CORS). TTL **1 day**. `ALLOWED_HOSTS = ["alasky.cds.unistra.fr", "alaskybis.cds.unistra.fr", "aladin.cds.unistra.fr", "hipscat.cds.unistra.fr"]`.
- **TS extension** (`lib/services/hips/`): parse catalog-HiPS entries; add `getCatalogHiPS()`; route registry fetch through `fetch_hips_registry` when in Tauri (keep web fallback).
- **New store** `lib/stores/hips-survey-store.ts` (persisted): `{ selectedSurveyId, favoriteSurveyIds, discoveredCatalogs }` + actions. (No selection store exists today.)
- **Consumer:** survey selector gains a "catalog surveys" group + favorites toggle. Gaia DR3 entry becomes discoverable (slice B1 will render it via `A.catalogHiPS`).

## 4. Frontend Interface Layer

Follow the existing `lib/tauri/*-api.ts` pattern (lazy `getInvoke()` guarded by `isTauri()`, typed config/response, error mapping). New files:
- `lib/tauri/satellite-tle-api.ts`, `lib/tauri/mpc-api.ts`, `lib/tauri/horizons-api.ts`.
- D3 extends `lib/services/hips/` + adds `lib/stores/hips-survey-store.ts`.
- New i18n keys in `i18n/messages/{en,zh}.json` for the refresh actions, survey groups, and the Horizons info line.

## 5. Error Handling & Offline

- Single serializable `ExternalDataError`; every command returns `Result<_, ExternalDataError>`.
- `fetch_and_cache` implements **stale-if-error**: on network failure, return the last cached payload (flagged stale) instead of failing — keeps satellites/surveys usable offline.
- Per-command rate limits via `get_command_rate_limit`, polite to external services.
- TS wrappers surface a typed error and let consumers fall back to vendored/static data.

## 6. Testing Strategy

- **Pure parsers** (OMM JSON, Horizons `$$SOE` block, MPC line format + H-magnitude filter, MocServer JSON) are decoupled from fetch → Rust unit tests against recorded fixtures, **no live network**.
- Command-level integration tests inject fake payloads through the cache/http seam.
- TS: wrapper tests mock `invoke`; store tests for `hips-survey-store` and `satellite-store.refreshFromCelesTrak`.
- Each phase ends green on `rtk cargo test` (Rust) + `pnpm test` (changed TS) + `pnpm exec tsc --noEmit` + `pnpm lint`.

## 7. Phased Implementation Outline (expanded by writing-plans)

| Phase | Title | Deliverable | Depends on |
|------|-------|-------------|-----------|
| 0 | Shared foundation | `external_data/mod.rs` (`ExternalDataError`, `fetch_and_cache`, rate-limit hook); module registration in `lib.rs` | — |
| 1 | CelesTrak TLE | `tle.rs` + `satellite-tle-api.ts` + `satellite-store.refreshFromCelesTrak` + tracker refresh | 0 |
| 2 | MPC orbital data | `mpc.rs` (comets full + asteroid H-filter subset) + `mpc-api.ts` + data-manager action + Stellarium reload | 0 |
| 3 | JPL Horizons | `horizons.rs` + `horizons-api.ts` + object-info ephemeris line | 0 |
| 4 | D3 HiPS discovery | `hips_discovery.rs` + `hips/service.ts` extension + `hips-survey-store` + survey-selector catalog group | 0 |

Each phase is an independently shippable, testable unit. Phase 0 first; 1–4 are independent of each other.

## 8. Decisions Locked With User (2026-06-12)

- First slice = **D2+D3** (data/interface foundation), all four sources included.
- Architecture = **shared helper + per-source typed commands** (not a generic proxy, not a full-Rust background-refresh service).
- MPCORB = **comets full + bright-asteroid subset** (H-magnitude filter in Rust; full file not persisted).
- Aladin version (3.8.2 → 3.9.0-beta) bump is **deferred** — decided per-slice; not part of D2+D3.
