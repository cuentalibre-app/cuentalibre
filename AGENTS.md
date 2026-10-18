<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Fiscalia

Open-source accounting and tax app for Spanish self-employed workers. pnpm + Turborepo monorepo; see README.md for structure and commands.

## Conventions

- Write all code, comments, documentation and commit messages in English. User-facing UI copy is in Spanish.
- Style only with semantic tokens (`bg-primary`, `text-muted-foreground`, `border-border`…). Never use the raw palette variables from `primitives.css` in components; Tailwind's default palette is disabled on purpose.
- Format money with `formatEUR()` and render amounts with the `amount` class.
- Tax and date rules live in `packages/core` as pure functions with tests; keep them out of React components.
- Data shapes are zod schemas in `packages/contracts`, with types inferred from them; don't declare entity types elsewhere.
- Until there is a backend, sample data lives in `apps/web/src/mocks`.
- Run `pnpm typecheck` and `pnpm test` before committing.

## Architecture

The app must feel instant. Read `docs/architecture.md` (a draft of working ideas, not binding) before adding a data layer, the backend, or heavy dependencies; it records the performance principles and the backend decision (Hono + Postgres, postponed for now).
