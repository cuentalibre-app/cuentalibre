# Fiscalia

Open-source accounting and tax management for self-employed workers (*autónomos*) in Spain.

> Early stage: only the design system is in place so far.

## Structure

```
apps/web        Frontend (Vite + React + TypeScript + Tailwind CSS v4)
apps/api        Backend (not started)
packages/ui     Design system: tokens, base styles and components
```

## Development

Requires Node 22+ and pnpm 12.

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm typecheck
pnpm build
```

## Design tokens

Tokens live in `packages/ui/src/styles/` in three layers:

1. `primitives.css`: the raw palette (`--neutral-200`, `--blue-600`…). Never used by components directly.
2. `semantic.css`: purpose-based tokens (`--primary`, `--muted-foreground`, `--border`…), with light and dark (`.dark`) values.
3. `theme.css`: exposes them to Tailwind (`bg-primary`, `text-muted-foreground`, `rounded-xl`, `text-2xs`…).
   Tailwind's default color, font-size and radius scales are disabled.

Names follow shadcn/ui conventions. Note that `accent` is the hover surface; the brand color is `primary`.
For money amounts use the `amount` class (Geist Mono with tabular figures) and `formatEUR()` from `@fiscalia/ui/lib/format`.

## Conventions

- Code, comments, documentation and commit messages are written in English.
- User-facing copy is in Spanish.

## License

[AGPL-3.0](LICENSE)
