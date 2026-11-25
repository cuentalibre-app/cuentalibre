# cuentalibre

Accounting and tax app for Spanish self-employed workers (autónomos). pnpm + Turborepo monorepo; CONTRIBUTING.md has the full guide.

```
apps/web            App (Vite + React + Tailwind v4); /demo runs on sample data from src/mocks
apps/api            Backend (Hono + Drizzle + PostgreSQL, Better Auth)
apps/site           Public site and user docs (Astro, Spanish)
packages/core       Tax, money and date rules
packages/contracts  zod schemas of stored data
packages/ui         Design tokens, base styles, components
.agents/skills/     cuentalibre skill for agents using the public API
```

## Rules

- English for code, comments, docs and commits; Spanish for everything users read.
- New app text goes in `apps/web/src/i18n/locales/es.json` and is read with `t()`; other languages may lag behind.
- Tax, money and date rules go in `packages/core` as tested pure functions, never in components or routes.
- Entity types are inferred from the zod schemas in `packages/contracts`; don't declare them elsewhere.
- Money is integer `Cents` (`@cuentalibre/core`), formatted with `formatEUR()` (`@cuentalibre/ui/lib/format`) and rendered with the `amount` class.
- Style only with semantic tokens (`bg-primary`, `text-muted-foreground`…); never the raw palette in `primitives.css`.
- Screens live in `apps/web/src/features/<area>` and read/write through the stores in `apps/web/src/data` (optimistic commands, rolled back if the API rejects them).
- API routes live in `apps/api/src/routes` (`@hono/zod-openapi`); every write goes through `applyCommands`, every query filters by `organizationId`.
- Public API change (route, field, rule, error code): update `apps/api/README.md`, `apps/site/src/content/docs/api/` and `.agents/skills/cuentalibre/references/` in the same change.
- Schema change: edit `apps/api/src/db/schema/`, run `pnpm --filter @cuentalibre/api db:generate --name <what_changed>`, review the SQL.
- UI: no captions under fields or page titles (use `HelpTip`); check touched screens on desktop and phone, light and dark.
- Phone (390 px): no horizontal scroll, no cut or wrapped labels. Headers use `PageHeader` (the assistant stays beside the title; only the page's controls wrap); create actions become a `+` icon; one «Guardar cambios» per page (header on desktop, full width at the end on phones); search placeholders say «Buscar»; long explanations start folded; tables fit without breaking labels.
- Never name commercial accounting software anywhere.
- Commits: imperative subject saying what changes; body says why.
- Before changing Turborepo config, read the docs bundled in the installed `turbo` package (`node_modules/turbo/docs/`).

## Before committing

CI fails unless these pass; run what applies:

- Always: `pnpm typecheck` and `pnpm test` (API tests need `docker compose up -d`).
- User-visible change in `apps/web`: `pnpm --filter @cuentalibre/web screens`, commit the regenerated `apps/site/src/content/docs/guia/pantallas.md`.
- Changed `apps/web/src/components/layout/nav.ts`: `pnpm --filter @cuentalibre/web test -u` (regenerates `guia/mapa.md`).
- Renamed or removed a button, menu or field: update `apps/site/src/content/docs/guia/` to match.
- Schema change: commit the generated migration in `apps/api/drizzle`.
- New or upgraded dependency: `pnpm audit --prod --audit-level high`.
- Build config, env variables or the site: `pnpm build`.

## Architecture

The app must feel instant:

- Render from the client cache, update optimistically, and compute tax figures in the browser with `@cuentalibre/core`.
- One API process, one PostgreSQL database; no queues, Redis or microservices without a measured need.
- Push work to the database: proper indexes, SQL aggregates, no N+1.
- Small bundle: split by route, lazy-load rare features (PDF, charts), check a dependency's size before adding it.
