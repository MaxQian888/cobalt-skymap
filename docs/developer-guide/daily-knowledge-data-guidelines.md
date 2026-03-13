# Daily Knowledge Data Guidelines

This document defines the data quality rules for `lib/data/daily-knowledge-curated.ts`.

## Goals

- Keep `Daily Knowledge` bilingual (`en` + `zh`) and production-safe.
- Ensure each entry has traceable factual references.
- Keep online fallback reliable when external services are unavailable.
- Keep external source ingestion allowlisted, attributable, and regression-resistant.

## Entry Requirements

Each curated entry must include:

- `id`: stable, unique, kebab-case identifier.
- `categories`: at least one valid `DailyKnowledgeCategory`.
- `tags`: meaningful retrieval tags for search/filter.
- `relatedObjects`: at least one object name for jump/navigation context.
- `localeContent.en` and `localeContent.zh`: non-empty `title`, `summary`, `body`.
- `factSources`: at least one source with:
  - `title` (human-readable)
  - `url` (must start with `https://`)
  - `publisher` (institution/site name)

Optional fields:

- `eventMonthDay` in `MM-DD` format for “today in astronomy” entries.
- `externalUrl`, `imageUrl`, `thumbnailUrl`, `imageType`.

## Online Source Onboarding

Daily Knowledge now supports curated data plus allowlisted online adapters.

New online source adapters must follow these rules:

- Only ingest from official/public, manually allowlisted astronomy sources.
- Prefer structured JSON APIs first, RSS/XML second, and use HTML extraction only for tightly controlled, stable pages.
- Each adapter must declare:
  - `source` ID
  - transport type (`api`, `rss`, or `html`)
  - cache policy ID
  - freshness window
  - locale support
- Each normalized item must include:
  - stable `id`
  - non-empty `title`, `summary`, and `body`
  - `attribution.sourceName`
  - `externalUrl` or `attribution.sourceUrl`
  - at least one fact source whenever the upstream provides a canonical article or asset URL
- Adapters must fail closed:
  - if required attribution or canonical URLs are missing, drop the item
  - if the upstream is unavailable, report source failure and keep curated fallback working

Current allowlisted online adapters:

- `nasa-apod`
- `wikimedia`
- `nasa-image-library`
- `nasa-photojournal`
- `esa-science`

## Attribution and Licensing

If an entry contains image URLs:

- `attribution.sourceUrl` must be present.
- `attribution.licenseName` must be present.
- Use only redistributable assets (public domain or explicit CC-compatible licenses).

For online adapters:

- Preserve the upstream source/article URL whenever available.
- Preserve explicit license/copyright fields if the upstream exposes them.
- Do not synthesize attribution text that the upstream did not provide.

## Curation Strategy

- Maintain roughly **30 curated entries**.
- Include at least **10 date-event entries** (`eventMonthDay`) for event-first selection.
- Keep the rest as high-value evergreen astronomy knowledge.

## Validation

Dataset integrity is enforced by:

- `lib/data/__tests__/daily-knowledge-curated.test.ts`
- `lib/services/daily-knowledge/__tests__/source-curated.test.ts`

Online source ingestion is enforced by:

- `lib/services/daily-knowledge/__tests__/source-registry.test.ts`
- `lib/services/daily-knowledge/__tests__/source-nasa-image-library.test.ts`
- `lib/services/daily-knowledge/__tests__/source-nasa-photojournal.test.ts`
- `lib/services/daily-knowledge/__tests__/source-esa-science.test.ts`
- `lib/services/daily-knowledge/__tests__/service.test.ts`
- `lib/cache/__tests__/integration-policy.test.ts`

When updating curated entries, run:

```bash
pnpm test lib/data/__tests__/daily-knowledge-curated.test.ts lib/services/daily-knowledge/__tests__/source-curated.test.ts
```

When updating online adapters, also run:

```bash
pnpm test -- --runInBand lib/services/daily-knowledge/__tests__/source-nasa-image-library.test.ts lib/services/daily-knowledge/__tests__/source-nasa-photojournal.test.ts lib/services/daily-knowledge/__tests__/source-esa-science.test.ts lib/services/daily-knowledge/__tests__/source-registry.test.ts lib/services/daily-knowledge/__tests__/service.test.ts lib/stores/__tests__/daily-knowledge-store.test.ts components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx lib/cache/__tests__/integration-policy.test.ts
```
