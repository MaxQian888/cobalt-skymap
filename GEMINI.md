# GEMINI.md

## Project Overview

A desktop star map and astronomy planning application built with Next.js 16 + Tauri 2.9. Integrates with Stellarium Web Engine for sky visualization, observation planning, equipment management, and astronomical calculations.

**Tech Stack:**
- **Frontend:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS v4, with `shadcn/ui` for UI components
- **Desktop Framework:** Tauri 2.9 (Rust backend)
- **State Management:** Zustand stores
- **Internationalization:** next-intl (English/Chinese)

## Building and Running

### Frontend (Web)

- `pnpm dev`: Starts the Next.js development server on `http://localhost:1420`
- `pnpm build`: Creates a production build (outputs to `out/`)
- `pnpm start`: Starts the production Next.js server
- `pnpm lint`: Lints the code using ESLint

### Desktop (Tauri)

- `pnpm tauri dev`: Runs the application in development mode with hot-reload
- `pnpm tauri build`: Builds the final, distributable desktop application

**Important:** For Tauri production builds, `output: "export"` must be set in `next.config.ts`.

### Testing

- `pnpm test`: Run all unit/integration tests (Jest)
- `pnpm test:watch`: Watch mode
- `pnpm test:coverage`: Run with coverage reporting
- `pnpm exec playwright test`: Run E2E tests (Playwright)
- `pnpm exec tsc --noEmit`: Type check without emitting

## Architecture

### Frontend-Backend Communication

```
React Component → Zustand Store → lib/tauri/*-api.ts → Tauri invoke() → Rust command
```

1. **Rust commands** defined in `src-tauri/src/*.rs` modules
2. **TypeScript APIs** in `lib/tauri/` wrap Tauri's `invoke()` with type safety
3. **Zustand stores** in `lib/stores/` manage client state and sync with Rust backend

### Key Directories

- `lib/astronomy/` - Pure astronomical calculations (coordinates, time, celestial, visibility, twilight, imaging, engine, horizon, object-resolver, mount-safety)
- `lib/stores/` - Zustand state (26+ stores: settings, equipment, target-list, markers, stellarium, onboarding, aladin, daily-knowledge, feedback, session-plan, etc.)
- `lib/tauri/` - TypeScript wrappers for Tauri IPC (storage, astronomy, events, mount, cache, updater, etc.)
- `lib/services/` - External API services (online search, object info, HiPS, satellite, geocoding, daily-knowledge, map-providers, search)
- `lib/hooks/` - Custom React hooks (37+ hooks, aladin/, stellarium/ subdirs)
- `lib/catalogs/` - Astronomical catalog data and types
- `lib/logger/` - Structured logging system with transports
- `lib/storage/` - Storage abstraction layer (Tauri/Web adapters, Zustand bridge)
- `components/starmap/` - Star map UI (canvas, view, search, settings, controls, time, overlays, planning, objects, management, knowledge, mount, onboarding, map)
- `components/icons/` - Brand icons, Cobalt Skymap logo, Stellarium/Zustand icons
- `src-tauri/src/` - Rust backend modules (astronomy, data, cache, network, platform, mount)
- `i18n/messages/` - Translation files (en.json, zh.json)

## Development Conventions

### Styling

- **Tailwind CSS v4:** Utility classes managed with `clsx` and `tailwind-merge`
- **UI Components:** `shadcn/ui` components in `components/ui/`, copied and extended locally
- **Class merging:** Use `cn()` from `@/lib/utils` to merge Tailwind classes

### Linting & Type Checking

- ESLint configured via `eslint.config.mjs` (Next.js core-web-vitals + TypeScript)
- TypeScript strict mode enabled
- Path alias: `@/*` maps to repo root

### Testing

- **Unit/Integration:** Jest with React Testing Library
- **E2E:** Playwright in `tests/e2e/`
- **Coverage thresholds:** 50% branches, 35% functions, 60% lines/statements
- **Mocks:** Tauri APIs mocked in `__mocks__/` directory
