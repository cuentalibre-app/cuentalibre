# Contributing to cuentalibre

**English** · [Español](CONTRIBUTING.es.md)

Thanks for helping. This guide explains how to report a problem and how to propose a change.

## Ways to help

- **Report a bug.** Open an [issue](https://github.com/cuentalibre-app/cuentalibre/issues) with what you did, what you expected and what happened. Screenshots help, but remove any real tax ID, name or amount first.
- **Fix a tax rule.** If a calculation, a deadline or a form box is wrong, say which one and link the source (BOE, AEAT instructions for the form, the law and article). Rules without a source are hard to review.
- **Suggest a feature.** Open an issue first and describe the problem it solves for an autónomo; it saves building something that won't fit.
- **Pick up an issue.** Those labelled `good first issue` are a good start; comment on one before you begin so two people don't work on it at once.
- **Improve the docs.** The site's documentation is in `apps/site/src/content/docs` (in Spanish).

## Getting set up

Follow [Running it locally](README.md#running-it-locally) in the README: Node 26, pnpm 12 and Docker for the database. `pnpm dev` starts the app, the API and the site.

## Making a change

1. Fork the repository and create a branch from `main` (`fix/303-box-28`, `feat/recurring-invoices`…).
2. Make the change, with tests for any logic you add or fix.
3. Run the checks below.
4. Open a pull request against `main` that explains what changes and why, and links the issue it closes (`Fixes #123`).

Keep pull requests focused, one fix or feature each: small ones are easier to review.

### Checks

```sh
pnpm typecheck
pnpm test        # the API's integration tests need `docker compose up -d`
pnpm build
pnpm format      # Prettier
```

CI also fails when a generated file is out of date. Before you open a pull request:

- If you changed anything a user sees in the app (a title, button, label or menu), run `pnpm --filter @cuentalibre/web screens` and commit the regenerated `apps/site/src/content/docs/guia/pantallas.md`. The help chat answers from it.
- If you changed the navigation, run `pnpm --filter @cuentalibre/web test -u` to regenerate `guia/mapa.md`.
- If you changed the database schema, commit the migration (see [Database](#database)).
- If you added or upgraded a dependency, run `pnpm audit --prod --audit-level high`.

## Conventions

### Language

- Code, comments, technical documentation and commit messages are in **English**.
- Everything the user reads is in **Spanish**: the app, the site and its documentation.

### Where things go

| What                          | Where                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Tax, money and date rules     | `packages/core`, as pure functions with tests. Never in React components or API routes.                                                         |
| Data shapes                   | `packages/contracts`, as zod schemas; types are inferred from them. Don't declare entity types anywhere else.                                   |
| Screens                       | `apps/web/src/features/<area>`.                                                                                                                 |
| Reads and writes from the app | Through the stores in `apps/web/src/data`: every change is a command, applied optimistically and undone if the API rejects it.                  |
| API routes                    | `apps/api/src/routes`, defined with `@hono/zod-openapi`. Every write goes through `applyCommands`, and every query filters by `organizationId`. |
| Sample data for the demo      | `apps/web/src/mocks`.                                                                                                                           |

### Code

- Match the code around you: naming, structure and how much it comments. Comments explain why, not what.
- Money is integer cents (`Cents` from `@cuentalibre/core`). Format it with `formatEUR()` and render amounts with the `amount` class.
- Style only with the semantic tokens (`bg-primary`, `text-muted-foreground`, `border-border`…). The raw palette in `primitives.css` and Tailwind's default colors are off limits.
- The app must feel instant: render from what's already in memory, don't add a request for a number the browser can compute, and check a dependency's size before adding it.

### User interface

- Check every screen you touch on the desktop and on a phone, in light and dark mode.
- Add screenshots of both to the pull request.

### Database

Edit the tables in `apps/api/src/db/schema/`, then generate the migration and review its SQL by hand:

```sh
pnpm --filter @cuentalibre/api db:generate --name <what_changed>
pnpm --filter @cuentalibre/api db:migrate
```

### API

A change to the public API (a route, a field, a rule or an error code) also updates, in the same pull request:

- [`apps/api/README.md`](apps/api/README.md), if it changes how the backend works;
- the API reference on the site, `apps/site/src/content/docs/api/` (in Spanish);
- the agent skill's references, `.agents/skills/cuentalibre/references/` (in English).

### Commits

Write the subject in the imperative and say what changes (`Round VAT per rate before adding the bases`); use the body to explain why. If you used an AI assistant, review its output as if you had written it: you're the one who answers for it in review.

## Security

Don't open a public issue for a vulnerability. Report it privately through GitHub (**Security › Report a vulnerability**).

## License

cuentalibre is licensed under the [AGPL-3.0](LICENSE) and, as the license says, is provided as is, without any warranty.

By opening a pull request, you accept our [Contributor License Agreement](CLA.md). You keep the copyright of your work; the CLA lets the project offer other licenses in the future, and every contribution stays available under the AGPL-3.0 or another open source license.
