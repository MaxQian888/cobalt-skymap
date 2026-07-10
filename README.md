# Cobalt Skymap

A modern desktop star map and astronomy planning application built with **Next.js 16**, **React 19**, and **Tauri 2.9**. It integrates the Stellarium Web Engine for real-time sky visualization and provides a comprehensive toolkit for observation planning, equipment management, and astronomical calculations.

[中文文档](./README_zh.md) | [Changelog](./CHANGELOG.md)

## Features

### Sky Visualization

- **Stellarium Web Engine** - Real-time, interactive sky rendering with accurate star positions, constellations, and deep-sky objects
- **Aladin Lite Dual-Engine** - Switch between Stellarium and Aladin Lite for multi-wavelength sky surveys and FITS image overlays
- **AR Mode** - Overlay the celestial sphere onto your camera feed for immersive stargazing
- **Sky Markers & Bookmarks** - Pin custom markers and save favorite views for quick navigation
- **Satellite Tracking** - Track satellites and artificial objects in real time

### Observation Planning

- **Session Planner** - Plan observation sessions with altitude charts, visibility windows, and optimal timing recommendations
- **Target Recommendations** - Adaptive scoring for imaging, visual, and hybrid observing with confidence indicators
- **Messier Marathon** - Dedicated workflow for Messier Marathon events with session execution helpers
- **Observation Log** - Record and review your observation sessions with structured notes
- **Mount Safety Simulator** - Simulate GEM mount sequences to check for meridian flips, hour-angle limits, and pier collisions before slewing

### Equipment & Tools

- **Equipment Management** - Configure telescopes, cameras, and eyepieces with FOV overlay calculations
- **Plate Solving** - Online plate-solving workflow to match your images against star catalogs
- **Telescope Mount Control** - ALPACA-compatible mount control with real-time status polling and slew commands
- **Exposure Calculator** - Imaging exposure time recommendations based on sky quality and equipment
- **Ocular Simulator** - Simulate the field of view through your eyepiece or camera sensor

### Astronomy Engine

- **Unified Calculation Engine** - Tauri-first Rust backend with a pure-JS `astronomy-engine` fallback, ensuring identical results across desktop and web builds
- **Astro Calculator** - Nine dedicated tabs covering What's Up Tonight, Positions, Rise/Transit/Set, Ephemeris, Almanac, Phenomena, Coordinate Conversion, Time, and Solar System
- **Coordinate Pipeline** - Unified ICRF/CIRS/OBSERVED frame contract with UTC/UT1/TT metadata propagation
- **Offline Precision** - Built-in EOP baseline data with background incremental refresh when online
- **Daily Knowledge** - Curated astronomy facts and events delivered on startup

### UI & Accessibility

- **Modern Interface** - Tailwind CSS v4 with the Geist typeface, dark mode, and a fully customizable theme workbench
- **Accessible Components** - shadcn/ui built on Radix UI primitives with full keyboard navigation
- **Night Vision Mode** - Red-light filter to preserve dark adaptation
- **Multi-language** - English and Chinese via next-intl
- **Responsive Layout** - Optimized for desktop with refined touch support for tablets
- **Auto-Updater** - Built-in update mechanism for desktop builds

### Security

- **Rate Limiting** - Sliding-window algorithm prevents API abuse
- **Input Validation** - Strict size limits on JSON, CSV, and tile data
- **SSRF Protection** - URL validation blocks private IPs and dangerous protocols
- **Path Sandboxing** - Prevents directory traversal in file storage operations
- **Secret Vault** - Secure storage for API keys and sensitive credentials via Tauri's keyring integration

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4, shadcn/ui, Geist |
| **State** | Zustand |
| **Desktop** | Tauri 2.9 (Rust) |
| **Astronomy** | Stellarium Web Engine, Aladin Lite, custom calculation libraries |
| **i18n** | next-intl |
| **Storage** | JSON File Storage (backend), localStorage (web fallback) |
| **Security** | Rate limiting, URL validation, size limits, secret vault |

## Prerequisites

Before you begin, ensure you have the following installed:

### Web Development

- **Node.js** 20.x or later
- **pnpm** 9.x or later (recommended)

### Desktop Development

- **Rust** 1.75 or later
- **System Dependencies**:
  - **Windows**: WebView2, Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: libwebkit2gtk-4.1, build-essential, curl, wget, etc.

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/ElementAstro/cobalt-skymap.git
   cd cobalt-skymap
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

## Development

### Web Development

```bash
pnpm dev
```

Starts the Next.js dev server at [http://localhost:1420](http://localhost:1420).

### Desktop Development

```bash
pnpm tauri dev
```

Launches the Tauri desktop app with hot-reloading for both the frontend and the Rust backend.

## Building for Production

### Web Application (Static Export)

```bash
pnpm build
```

Outputs to the `out/` directory.

### Desktop Application

```bash
# Default build
pnpm tauri build

# Pre-configured desktop build (includes dependency generation)
pnpm build:desktop

# Windows-specific build
pnpm build:desktop:windows
```

Installers are generated in `src-tauri/target/release/bundle/`.

## Project Structure

```
skymap/
├── app/                    # Next.js App Router (pages and layouts)
├── components/             # React components
│   ├── starmap/           # Star map UI components
│   │   ├── canvas/        # Stellarium Web Engine canvas wrapper
│   │   ├── view/          # Main sky view component
│   │   ├── search/        # Object search, advanced search, catalog queries
│   │   ├── settings/      # Settings panels, dialogs, and theme workbench
│   │   ├── controls/      # Zoom, navigation history, bookmarks
│   │   ├── time/          # Time control and clock display
│   │   ├── overlays/      # FOV simulator, satellite tracker, sky markers
│   │   ├── planning/      # Altitude charts, exposure calculator, session planner, mount safety simulator
│   │   ├── objects/       # Object info panels, detail drawers, image galleries
│   │   ├── management/    # Equipment, location, cache, and data managers
│   │   ├── knowledge/     # Daily astronomy knowledge and startup dialog
│   │   ├── mount/         # Telescope mount control interface
│   │   ├── onboarding/    # Welcome dialog and interactive tour
│   │   ├── plate-solving/ # Image capture and online plate solving
│   │   └── map/           # Leaflet-based location picker
│   ├── common/            # Shared components (theme, language, log viewer)
│   ├── icons/             # Brand icons and Cobalt Skymap logo
│   └── ui/                # shadcn/ui components
├── lib/                    # Core logic
│   ├── astronomy/         # Astronomical calculations
│   │   ├── coordinates/   # Coordinate conversions (equatorial, horizontal, galactic)
│   │   ├── time/          # Julian date, sidereal time, time-scale contracts
│   │   ├── celestial/     # Sun, Moon, and planetary calculations
│   │   ├── visibility/    # Target visibility and circumpolar analysis
│   │   ├── twilight/      # Twilight times (civil, nautical, astronomical)
│   │   ├── imaging/       # Exposure and imaging feasibility calculations
│   │   ├── engine/        # Unified Tauri-first / fallback astronomy engine
│   │   ├── horizon/       # Custom horizon profiles
│   │   └── object-resolver/ # Object name parsing (catalog, minor body, coordinate)
│   ├── stores/            # Zustand state management (26+ stores)
│   ├── tauri/             # Tauri API wrappers (astronomy, mount, cache, updater, etc.)
│   ├── services/          # External API services (search, map tiles, daily knowledge)
│   ├── hooks/             # Custom React hooks (37+ hooks)
│   ├── catalogs/          # Astronomical catalog data
│   ├── logger/            # Structured logging system
│   ├── storage/           # Storage abstraction layer (Tauri / web adapters)
│   ├── cache/             # Cache compression, configuration, and migration
│   └── ...                # core, constants, data, feedback, aladin, plate-solving, security
├── src-tauri/             # Rust backend
│   └── src/
│       ├── astronomy/     # Coordinate transforms, ephemeris, and astronomical events
│       ├── data/          # JSON storage for equipment, locations, targets, markers
│       ├── cache/         # Offline tile caching and unified network cache
│       ├── network/       # HTTP client, security, and rate limiting
│       ├── platform/      # App settings, auto-updater, plate solver
│       └── mount/         # ALPACA mount client, simulator, and command handlers
├── public/                 # Static assets (includes Stellarium engine)
├── i18n/                   # Internationalization
│   └── messages/          # Translation files (en.json, zh.json)
└── docs/                   # MkDocs-based documentation
```

## Testing

### Unit & Integration Tests (Jest)

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
pnpm test -- path/to/file   # Run a specific test file
```

Coverage thresholds: branches 50%, functions 35%, lines 60%, statements 60%.

### E2E Tests (Playwright)

```bash
pnpm test:e2e                  # Run all E2E tests
pnpm test:e2e:smoke            # Smoke tests only (Chromium)
pnpm test:e2e:regression       # Regression tests (Chromium, desktop)
pnpm exec playwright test      # Direct invocation
```

### Linting & Type Checking

```bash
pnpm lint                        # ESLint (frontend)
pnpm exec tsc --noEmit          # TypeScript type checking
cargo clippy                     # Clippy (Rust)
```

### Security Tests

```bash
cd src-tauri
cargo test security_tests
```

## Security

Cobalt Skymap includes defense-in-depth security measures:

- **Rate Limiting** - Sliding-window algorithm prevents API abuse
- **Input Validation** - Size limits on JSON, CSV, and tile data
- **SSRF Protection** - URL validation blocks private IPs and dangerous protocols
- **Storage Security** - Path sandboxing prevents directory-traversal attacks
- **Secret Vault** - API keys and sensitive credentials are stored in the OS keyring

See [Security Documentation](./docs/security/security-features.md) for details.

## Documentation

Full documentation is available in the `docs/` directory:

- **[Getting Started](docs/getting-started/index.md)** - Quick start guide
- **[User Guide](docs/user-guide/index.md)** - Feature documentation
- **[Developer Guide](docs/developer-guide/index.md)** - Development documentation
- **[API Reference](docs/developer-guide/apis/index.md)** - API documentation
- **[Deployment](docs/deployment/index.md)** - Build and deployment guide

## License

MIT License
