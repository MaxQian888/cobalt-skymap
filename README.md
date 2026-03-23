# SkyMap

A modern desktop star map and astronomy planning application built with **Next.js 16**, **React 19**, and **Tauri 2.9**. It integrates with the Stellarium Web Engine for sky visualization, observation planning, and astronomical calculations.

[中文文档](./README_zh.md) | [Changelog](./CHANGELOG.md)

## Features

- **Star Map Visualization** - Integrated Stellarium Web Engine for real-time sky rendering
- **Observation Planning** - Tools for planning astronomy sessions and tracking targets
- **Equipment Management** - Manage telescopes, cameras, and eyepieces with FOV calculation
- **Astronomical Calculations** - 9-tab Astro Calculator (WUT, Positions, RTS, Ephemeris, Almanac, Phenomena, Coordinate, Time, Solar System)
- **Unified Engine** - `lib/astronomy/engine` with Tauri-first backend and `astronomy-engine` fallback for web/offline parity
- **Frame/Timescale Contract** - Unified ICRF/CIRS/OBSERVED pipeline with UTC/UT1/TT metadata
- **Adaptive Recommendations** - Imaging / visual / hybrid target scoring with confidence indicators
- **Offline Precision Fallback** - Built-in EOP baseline with background refresh when online
- **Desktop Native** - Built with Tauri 2.9 for high performance and system integration
- **Modern UI** - Tailwind CSS v4 with Geist font and dark mode support
- **shadcn/ui** - High-quality accessible components built on Radix UI
- **Zustand** - Lightweight and robust state management
- **i18n Support** - Multi-language support (English/Chinese) via next-intl
- **Security** - Rate limiting, input validation, SSRF protection

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4, shadcn/ui |
| **State** | Zustand |
| **Desktop** | Tauri 2.9 (Rust) |
| **Astronomy** | Stellarium Web Engine, custom astronomical calculation libraries |
| **i18n** | next-intl |
| **Storage** | JSON File Storage |
| **Security** | Rate limiting, URL validation, size limits |

## Prerequisites

Before you begin, ensure you have the following installed:

### For Web Development

- **Node.js** 20.x or later
- **pnpm** 9.x or later (recommended)

### For Desktop Development

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

Launches the Tauri desktop app with hot-reloading for both Rust and Frontend.

## Building for Production

### Build Web Application (Static Export)

```bash
pnpm build
```

Outputs to the `out/` directory.

### Build Desktop Application

```bash
pnpm tauri build
```

Generates installers in `src-tauri/target/release/bundle/`.

## Project Structure

```
skymap/
├── app/                    # Next.js App Router (pages and layouts)
├── components/             # React components
│   ├── starmap/           # Star map UI components
│   │   ├── canvas/        # Stellarium Web Engine canvas wrapper
│   │   ├── view/          # Main sky view component
│   │   ├── search/        # Object search, advanced search
│   │   ├── settings/      # Settings panels and dialogs
│   │   ├── controls/      # Zoom, navigation, bookmarks
│   │   ├── time/          # Time control and clock display
│   │   ├── overlays/      # FOV simulator, satellite tracker, sky markers
│   │   ├── planning/      # Altitude charts, exposure calculator, session planning
│   │   ├── objects/       # Object info panels, detail drawers
│   │   ├── management/    # Equipment, location, cache managers
│   │   ├── knowledge/     # Daily astronomy knowledge
│   │   ├── mount/         # Telescope mount control
│   │   ├── onboarding/    # Welcome dialog and tour
│   │   └── map/           # Leaflet-based location picker
│   ├── common/            # Shared components (theme, language, log viewer)
│   ├── icons/             # Brand icons, SkyMap logo
│   └── ui/                # shadcn/ui components
├── lib/                    # Core logic
│   ├── astronomy/         # Astronomical calculations
│   │   ├── coordinates/   # Coordinate conversions
│   │   ├── time/          # Julian date, sidereal time
│   │   ├── celestial/     # Sun, Moon calculations
│   │   ├── visibility/    # Target visibility
│   │   ├── twilight/      # Twilight times
│   │   ├── imaging/       # Exposure calculations
│   │   ├── engine/        # Unified Tauri/fallback astronomy engine
│   │   ├── horizon/       # Custom horizon profiles
│   │   └── object-resolver/ # Object name parsing
│   ├── stores/            # Zustand state management (26+ stores)
│   ├── tauri/             # Tauri API wrappers
│   ├── services/          # External API services
│   ├── hooks/             # Custom React hooks (37+ hooks)
│   ├── catalogs/          # Astronomical catalog data
│   ├── logger/            # Structured logging system
│   ├── storage/           # Storage abstraction layer
│   ├── cache/             # Cache compression, config, migration
│   └── ...                # core, constants, data, feedback, aladin, etc.
├── src-tauri/             # Rust backend
│   └── src/
│       ├── astronomy/     # Coordinate transforms, events
│       ├── data/          # JSON storage, equipment, locations, targets
│       ├── cache/         # Offline tile caching, unified cache
│       ├── network/       # HTTP client, security, rate limiting
│       ├── platform/      # App settings, updater, plate solver
│       └── mount/         # ALPACA mount client, simulator
├── public/                 # Static assets including Stellarium engine
├── i18n/                   # Internationalization
│   └── messages/          # Translation files (en.json, zh.json)
└── docs/                   # Documentation (MkDocs)
```

## Testing

### Unit & Integration Tests (Jest)

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
```

### E2E Tests (Playwright)

```bash
pnpm exec playwright test
```

### Linting

```bash
pnpm lint              # ESLint (Frontend)
cargo clippy           # Clippy (Rust)
```

### Security Tests

```bash
cd src-tauri
cargo test security_tests
```

## Security Features

SkyMap includes multiple security layers:

- **Rate Limiting** - Sliding window algorithm prevents API abuse
- **Input Validation** - Size limits on JSON, CSV, and tile data
- **SSRF Protection** - URL validation blocks private IPs and dangerous protocols
- **Storage Security** - Path sandboxing prevents path traversal attacks

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

