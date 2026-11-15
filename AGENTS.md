<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# cuentalibre

Open-source accounting and tax app for Spanish self-employed workers (autónomos). pnpm + Turborepo monorepo; README.md has the structure and how to run it, CONTRIBUTING.md the full contributor guide.

```
apps/web            The app (Vite + React + Tailwind CSS v4); /demo runs it on sample data
apps/api            The backend (Hono + Drizzle + PostgreSQL, Better Auth)
apps/site           Public site and user docs (Astro), in Spanish
packages/core       Tax, money and date rules shared by front and back
packages/contracts  zod schemas of the stored data
packages/ui         Design system: tokens, base styles and components
.agents/skills/     The cuentalibre skill for AI agents using the public API
```

## Conventions

- Code, comments, technical docs and commit messages are in English. Everything the user reads (app, site, user docs) is in Spanish.
- Tax, money and date rules live in `packages/core` as pure functions with tests; never in React components or API routes.
- Data shapes are zod schemas in `packages/contracts`, with types inferred from them; don't declare entity types elsewhere.
- Money is integer cents (`Cents` from `@cuentalibre/core`). Format it with `formatEUR()` and render amounts with the `amount` class.
- Style only with semantic tokens (`bg-primary`, `text-muted-foreground`, `border-border`…). Never use the raw palette in `primitives.css`; Tailwind's default palette is disabled on purpose.
- Screens live in `apps/web/src/features/<area>`. They read and write through the stores in `apps/web/src/data`: every change is a command sent to the API, applied optimistically and undone if rejected.
- The demo's sample data lives in `apps/web/src/mocks`.
- API routes live in `apps/api/src/routes`, defined with `@hono/zod-openapi`. Every write goes through `applyCommands`, and every query filters by `organizationId`.
- A change to the public API (route, field, rule or error code) also updates `apps/api/README.md` when relevant, the site's API reference (`apps/site/src/content/docs/api/`) and the skill's references (`.agents/skills/cuentalibre/references/`), in the same change.
- Database changes: edit `apps/api/src/db/schema/`, then `pnpm --filter @cuentalibre/api db:generate --name <what_changed>` and review the generated SQL.
- UI: no explanatory captions under fields or page titles; put explanations behind a `HelpTip`. Check every screen you touch on desktop and phone, light and dark.
- Never name commercial accounting software in code, UI, docs or commits.
- Commit subjects are imperative and say what changes; the body explains why.

## Before committing

CI (`.github/workflows/ci.yml`) fails on any of these, so run what applies:

- Always: `pnpm typecheck` and `pnpm test` (the API's integration tests need `docker compose up -d`).
- Changed anything a user sees in `apps/web` (titles, buttons, labels, menus, layout): run `pnpm --filter @cuentalibre/web screens` and commit the regenerated `apps/site/src/content/docs/guia/pantallas.md`. The help chat answers from it, and CI fails if it differs.
- Changed the navigation (`apps/web/src/components/layout/nav.ts`): run `pnpm --filter @cuentalibre/web test -u` to regenerate `guia/mapa.md`.
- Renamed or removed a button, menu or field: `apps/web/scripts/guide.test.ts` fails until the user guide (`apps/site/src/content/docs/guia/`) uses the new name.
- Changed the database schema: commit the migration from `db:generate`; CI fails if `apps/api/drizzle` doesn't match the schema.
- Added or upgraded a dependency: `pnpm audit --prod --audit-level high`.
- Touched build config, env variables or the site: `pnpm build`.

## Architecture

The app must feel instant:

- The UI never waits for the server to show what it already knows: render from the client cache, update optimistically, and compute tax figures in the browser with `@cuentalibre/core` instead of requesting them.
- Few layers: one API process and one PostgreSQL database. No queues, Redis or microservices until a measured problem needs them.
- Let the database do the work: the right indexes, aggregates in SQL, no N+1 queries.
- Keep the bundle small: split by route, lazy-load rare features (PDF, charts), and check a dependency's size before adding it.
