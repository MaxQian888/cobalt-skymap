# Copilot Instructions for Cobalt Skymap

## Project Overview

A desktop star map and astronomy planning application built with **Next.js 16 (App Router) + Tauri 2.9**. Integrates with Stellarium Web Engine for sky visualization, observation planning, equipment management, and astronomical calculations.

**Tech Stack:**
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui components
- **Desktop wrapper**: Tauri 2.9 (Rust-based) for native desktop capabilities
- **State management**: Zustand stores
- **Internationalization**: next-intl (English/Chinese)

### Dual Runtime Model

1. **Web mode** (`pnpm dev`): Next.js dev server at http://localhost:1420
2. **Desktop mode** (`pnpm tauri dev`): Tauri wraps the Next.js app in a native window

**Critical:** For Tauri production builds, Next.js must use static export. Ensure `output: "export"` is set in `next.config.ts` as `tauri.conf.json` expects the `out/` directory.

## Key File Locations & Conventions

### Routing & Layouts
- `app/layout.tsx`: Root layout, configures Geist fonts via `next/font/google`, imports `globals.css`
- `app/page.tsx`: Home route demonstrating Tailwind + `next/image` usage
- Path alias: `@/*` maps to repo root (e.g., `@/lib/utils`)

### Styling System
- **Tailwind v4** via PostCSS plugin (`@tailwindcss/postcss`)
- `app/globals.css`:
  - Imports `tailwindcss` and `tw-animate-css`
  - Defines CSS variables for theme colors (oklch color space)
  - Uses `@theme inline` to map CSS vars to Tailwind utilities
  - Custom dark mode variant: `@custom-variant dark (&:is(.dark *))`
- Color system: All colors defined as CSS variables (light + `.dark` overrides)

### Component Patterns
- **shadcn/ui components** in `components/ui/`
- Example: `components/ui/button.tsx` uses:
  - `@radix-ui/react-slot` for `asChild` polymorphism
  - `class-variance-authority` for variant management
  - `cn()` utility from `@/lib/utils` (clsx + tailwind-merge)
- Config: `components.json` defines shadcn settings (New York style, RSC mode)

### Architecture

```
React Component → Zustand Store → lib/tauri/*-api.ts → Tauri invoke() → Rust command
```

- `lib/astronomy/` - Pure astronomical calculations (coordinates, time, celestial, visibility, twilight, imaging, engine, horizon, object-resolver, mount-safety)
- `lib/stores/` - Zustand state management (26+ stores: settings, equipment, target-list, markers, stellarium, onboarding, aladin, daily-knowledge, feedback, session-plan, etc.)
- `lib/tauri/` - TypeScript wrappers for Tauri IPC (storage, astronomy, events, mount, cache, updater, etc.)
- `lib/services/` - External API services (online search, object info, HiPS, satellite, geocoding, daily-knowledge, map-providers, search)
- `lib/hooks/` - Custom React hooks (37+ hooks, aladin/, stellarium/ subdirs)
- `lib/catalogs/` - Astronomical catalog data, search, and recommendation engine
- `lib/logger/` - Structured logging system with multiple transports
- `lib/storage/` - Storage abstraction layer (Tauri/Web adapters, Zustand bridge)
- `components/starmap/` - Star map UI components (canvas, view, search, settings, controls, time, overlays, planning, objects, management, knowledge, mount, onboarding, map)
- `components/icons/` - Brand icons, Cobalt Skymap logo
- `src-tauri/src/` - Rust backend modules (astronomy, data, cache, network, platform, mount)
- `i18n/messages/` - Translation files (en.json, zh.json)

### Tauri Integration
- `src-tauri/src/lib.rs`: Main Tauri setup (enables debug logging in dev)
- `src-tauri/tauri.conf.json`:
  - `devUrl`: Points to Next.js dev server
  - `frontendDist`: Expects `../out` (static export)
  - `beforeDevCommand`: Runs `pnpm dev`
  - `beforeBuildCommand`: Runs `pnpm build`

## Developer Workflows

### Package Management
**Always use pnpm** (lockfile present). Commands:
- `pnpm install` - Install dependencies
- `pnpm dev` - Next.js dev server (web-only)
- `pnpm tauri dev` - Desktop app with hot reload
- `pnpm build` - Next.js production build
- `pnpm tauri build` - Create desktop installer

### Code Quality
- **Type checking**: `pnpm exec tsc --noEmit` (strict mode enabled)
- **Linting**: `pnpm lint` (ESLint flat config with `eslint-config-next`)
  - Auto-fix: `pnpm lint --fix`
  - Single file: `pnpm exec eslint <file>`

### Testing
- **Unit/Integration (Jest)**:
  - `pnpm test` - Run all tests
  - `pnpm test:watch` - Watch mode
  - `pnpm test:coverage` - With coverage
  - `pnpm test path/to/file` - Run specific test file
- **E2E (Playwright)**:
  - `pnpm exec playwright test` - Run all E2E tests
  - `pnpm exec playwright test --project=chromium` - Single browser
- **Coverage thresholds**: 50% branches, 35% functions, 60% lines/statements
- **Mocks**: Tauri APIs mocked in `__mocks__/` directory

### Adding shadcn/ui Components
Use the shadcn CLI: `pnpm dlx shadcn@latest add <component-name>`
- Components install to `components/ui/`
- Automatically uses configured aliases and style

## Project-Specific Patterns

### Import Paths
Always use `@/` alias for internal imports:
```typescript
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
```

### Component Composition
Prefer composition patterns with `asChild` for buttons/links:
```tsx
<Button asChild>
  <Link href="/path">Click me</Link>
</Button>
```

### Dark Mode
- Class-based dark mode (not media query)
- Apply `.dark` class to parent element
- All color utilities automatically support dark variants via custom variant

### Styling Utilities
- Use `cn()` from `@/lib/utils` to merge Tailwind classes safely
- Example: `cn("base-classes", conditionalClass && "conditional-classes", className)`

## Known Configuration Notes

- **ESLint**: Flat config format with Next.js core-web-vitals + TypeScript rules
- **TypeScript**: Strict mode, bundler module resolution, JSX set to `react-jsx`
- **Next.js config**: Currently minimal (no custom webpack/rewrites)
- **Rust toolchain**: Requires v1.77.2+ for Tauri builds
