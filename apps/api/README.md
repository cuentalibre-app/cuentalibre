# @cuentalibre/api

The backend: [Hono](https://hono.dev) on Node, Postgres through [Drizzle](https://orm.drizzle.team), and [Better Auth](https://better-auth.com) for sign-in and organizations. See [docs/architecture.md](../../docs/architecture.md) for the reasoning.

## Running it

```sh
docker compose up -d     # from the repo root; Postgres on localhost:5432
pnpm db:migrate
pnpm dev                 # http://localhost:3000/v1
```

Every setting has a development default; copy `.env.example` to `.env` to change them. In production `BETTER_AUTH_SECRET` is required.

Google sign-in is on when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set: create an OAuth client of type "Web application" in Google Cloud, with `<BETTER_AUTH_URL>/v1/auth/callback/google` as its redirect URI (`http://localhost:3000/v1/auth/callback/google` in development). Only the sign-up screen creates users from a Google account, since that's where the terms are accepted; signing in with Google on an email that already has an account only links them once that email is verified. Until then, or on instances that can't send email, people link Google from Configuración › Credenciales de acceso, signed in with their password (`link-social`), with a Google account on the same email. Users without a password delete their account with a session started in the last ten minutes instead.

With email set up (`SMTP_URL`), and from `ACCOUNT_EMAIL_FROM` (or `EMAIL_FROM`), sign-up sends a link to verify the email (valid for 24 hours; Credenciales de acceso sends it again), and `/v1/auth/request-password-reset` sends one to choose a new password, which signs out every session and counts as verifying the email. These go straight to the mailer, not through the queue, without waiting for the server, so response times don't reveal which emails have an account. Users created through Google come verified.

To point the web app at the API, set `VITE_API_URL=http://localhost:3000` in `apps/web/.env.local`. It then sends users without a session to sign in, and those without an organization to create one; `/demo` keeps running on the sample data. A new session starts in the user's oldest organization.

## Production

`pnpm build` bundles the server and the migration script into `dist/` with esbuild, dependencies included; `pnpm start` runs it. `Dockerfile`, built from the repository root, makes two images that apply pending migrations and then serve on port 3000:

- the default target, for self-hosting: the API plus the web app, built with `VITE_API_URL=/` and served from `WEB_DIR` on every path outside `/v1` (`src/web.ts`). Pages fall back to `index.html`, sent with `no-cache`; the hashed files in `/assets/` are cached for good. One origin needs one URL, `PUBLIC_URL`, which stands for both `BETTER_AUTH_URL` and `WEB_ORIGIN`. `selfhost/` at the repository root runs it with Postgres and no web server in front; HTTPS is left to whatever the owner already uses (guide: `apps/site/src/content/docs/instalar.md`).
- `--target api`: the API alone, as cuentalibre online runs it, with the web app on Cloudflare.

`deploy/` at the repository root runs cuentalibre Cloud on one server: Caddy with a Cloudflare origin certificate in front, the API and Postgres. Caddy only takes the client's IP from Cloudflare's addresses and passes it on as `X-Forwarded-For`, which Better Auth rate-limits by. `deploy/cloud-init.yml` prepares a new server.

Every push to `main` that passes CI deploys it (the `deploy-api` job): the `api` image is built on the runner and sent over SSH (`docker save | docker load`), so the server needs no registry credentials; then `compose.yml` and the `Caddyfile` are copied over and the stack restarted. The web app deploys after it, built with `VITE_API_URL=https://api.cuentalibre.es`. The `production` environment holds `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` and the `DEPLOY_HOST` variable; the server keeps its own `.env` in `/opt/cuentalibre`.

`deploy/backup.sh` dumps Postgres every night (`cuentalibre-backup.timer`, installed by hand in `/etc/systemd/system`) to a bucket with object lock: each dump can't be deleted for 30 days and expires after 31. Its credentials live in `backup.env`, apart from the `.env` that compose hands to the API.

## Layout

```
src/app.ts             The HTTP app: middleware and routes, all under /v1
src/web.ts             Serves the built web app outside /v1 when self-hosted
src/auth.ts            Better Auth config (email and password, Google, organizations)
src/middleware.ts      Session loading, requireUser, requireOrganization
src/routes/            Route modules, defined with @hono/zod-openapi
src/sync/              Commands, the workspace and the change feed
src/storage/           Where uploaded files live: local disk or an S3-compatible bucket
src/outbox/            Background jobs and the worker that runs them
src/verifactu/         VERI*FACTU records, their SOAP messages and the AEAT transport
src/email/             Outgoing email: the SMTP adapter, the queue and the account emails
src/db/schema/         Drizzle tables
drizzle/               SQL migrations generated by drizzle-kit
```

## Endpoints

- `GET /v1/health`: API and database status.
- `GET /v1/sign-in-methods`: whether Google sign-in is on, and whether the instance sends email (verification, password reset).
- `/v1/auth/*`: Better Auth (sign-up, sign-in with email or Google, email verification, password reset, sessions, `organization/create`, `organization/set-active`…).
- `GET /v1/me`: the signed-in user, their memberships and their own settings.
- `PUT /v1/me/settings/{section}`: save a section of the user's own settings (`userProfile`, `userLocale`).
- `GET /v1/organization`: the active organization and the user's role in it.
- `GET /v1/organization/members`: the people in the active organization, with their role, oldest first.
- `GET /v1/workspace`: everything the app keeps for the active organization, with a cursor.
- `GET /v1/sync?since=<cursor>`: records that changed after the cursor, paged with `hasMore`.
- `POST /v1/commands`: create, update and delete commands, plus `issue`, `closeQuarter`, `reopenQuarter` and `saveSettings`, applied in one transaction.
- `/v1/contacts`, `/v1/sales-documents`, `/v1/purchase-invoices`, `/v1/expenses`: CRUD for the public API (lists filter by `from` and `to`).
- `POST /v1/invoices`: issue an invoice; `POST /v1/sales-documents/{id}/issue` issues a draft as it is.
- `/v1/api-keys`: list, create and revoke your API keys for the active organization (signed-in only).
- `POST /v1/files`: upload a file (`multipart/form-data`, fields `file` and an optional `id`). `GET /v1/files/:id` downloads it.
- `POST /v1/emails`: queue an email, such as an invoice with its PDF; `GET /v1/emails?documentId=` lists them with their status.
- `GET /v1/openapi.json`: the OpenAPI document.

## Sync

The web app downloads the workspace at boot, applies its changes optimistically and sends them as commands, then follows the change feed. Every write goes through `applyCommands` in `src/sync/write.ts`: it takes a per-organization lock, validates each command and logs it in `change_log`, whose `seq` is the cursor. Deletes leave a tombstone (`deleted_at`) so the feed can report them. A collection is synced once its entity is in `syncedEntitySchema` (`packages/contracts`); so far that's clients, suppliers, sales documents, received invoices, expenses, closed quarters and filed returns, tags, treasury accounts, payment methods, manual payments, bank movements, catalog families, products, stock movements and the organization's settings.

In a command's `changes`, `null` clears an optional field; a field that takes null itself (`dueOn`) is set to null.

## Sales

Drafts, quotes and delivery notes are plain records. Invoices only come into being through the `issue` command (`src/sync/sales.ts`), which:

- gives the invoice the next number of its series and year (`R-` for rectifying invoices), under the organization's write lock so numbers stay gapless; a number is only kept as sent for imported invoices;
- rejects a date earlier than the last invoice of the series, a date in a closed quarter, a missing client or lines, and a rectifying invoice that doesn't name an issued invoice of the normal series;
- freezes the client's fiscal data and the totals, computed with `@cuentalibre/core` from the lines as stored.

After that, an invoice only takes changes to its collections (`payments`, which `status` follows), tags, attachments and private notes; anything else, and deleting it, answers `409 invoice_issued`. It is corrected with a rectifying invoice. A business exempt from VERI\*FACTU may still revise or delete an issued invoice that has no VERI\*FACTU record while its quarter is open; its kind, number, series and the invoice it rectifies stay, and a new date must keep it in its year and in order within its series.

## Purchases and expenses

Received invoices (with their lines and payments) and expenses are plain records, but their quarter locks them: a received invoice belongs to the quarter of `bookedOn`, an expense to that of `date`. While that quarter is closed, the API only takes changes to their payments, tags, attachments and private notes, and rejects any other change, moving them to another date, deleting them and creating new ones in it (`409 quarter_closed`). Suppliers must be the organization's, and a credit note must correct one of its received invoices.

## Closing quarters and filed returns

`closeQuarter` takes the quarter's returns as filed (`returns`: forms 303 and 130 with their boxes and result), and stores them in `filed_return`. They are never changed: closing the quarter again after reopening it stores a new version, and the latest one counts. Later returns start from them: form 303 offsets what a filed return left pending, and form 130 subtracts the installments as filed. The figures come from the client, because they are what the user filed with the AEAT, which may include boxes typed by hand.

## Settings

The organization's settings are one JSON document per section in `organization_setting`, replaced whole by `saveSettings` and validated with the section's schema (`organizationSettingsSchema` in `packages/contracts`). The workspace serves every section, with the defaults for those never saved. The signed-in user's own settings (`userSettingsSchema`: their profile and their language and formats) follow them across organizations, in `user_setting`, and come with `/v1/me`; saving the profile also renames the user. The organization's members come from `membership` (`/v1/organization/members`); inviting people, their access roles (administrator, standard, read-only), advisors and expiry dates aren't there yet, so the app only lists them. The certificate and the email account aren't stored yet: they belong with signing and email. Neither are the profile picture and the notification preferences, which the app only shows in the demo.

## Plain records

Tags, treasury accounts, payment methods, manual payments, bank movements, catalog families, products and stock movements have no legal effects and no quarter. `src/sync/plain.ts` stores all of them the same way: each table has a column per field, the API checks the record's shape and that the records it names (an account, a payment method, a family, a product) are the organization's and not deleted, and deletes leave a tombstone. Stock movements may name a deleted product, since deleting one records the units it takes out.

## Files

Uploaded files are stored by the adapter in `src/storage/` and described in the `file` table; records name them by ID in their `attachments`. Choose the adapter with `STORAGE_DRIVER`:

- `disk` (default): files under `STORAGE_DIR` (`./data/files`). Back that directory up with the database.
- `s3`: any S3-compatible bucket (MinIO, Hetzner, AWS…), set with `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`. Objects are addressed path-style.

Files never change once uploaded. The web app uploads a file as soon as it is picked, under the attachment's ID, and sends the record that names it once the upload is done; the API rejects attachments that name files the organization never uploaded (`400 invalid_attachment`). Downloads are only for members of the organization; PDFs and common images open in the browser, anything else is downloaded. Uploads are limited to `FILE_MAX_BYTES` (25 MB). Files no record names any more are kept for now.

## VERI*FACTU

While the business uses VERI*FACTU (the `verifactu` settings section, from its `startDate`), issuing an invoice also creates its invoice record (`verifactu_record`) in the same transaction. Each record's fingerprint (SHA-256, as in the AEAT's specification) covers the previous one's, so the records of an organization form a chain; the organization's write lock keeps it free of forks. Invoices imported with their own number get no record: the software that issued them recorded them.

The record is queued for submission in the outbox. The worker sends an organization's pending records together (up to 1000) to the AEAT's SOAP service and stores how each went: `accepted`, `acceptedWithErrors` or `rejected`, with the AEAT's error. A record the AEAT already had counts as accepted. The next submission waits as long as the AEAT asks (`verifactu_state`). If the submission fails as a whole (a SOAP fault, the network), the records stay pending with the reason and it is retried with backoff. The invoice carries its status and the URL of its QR code in `issued.verifactu`, and the web app prints the QR on the PDF; status changes reach clients through the change feed.

Records are always chained; they are only sent when `VERIFACTU_ENV` is `test` or `production`. Sending needs a client certificate in PKCS#12 (`VERIFACTU_CERT_FILE`, `VERIFACTU_CERT_PASSWORD`), and records name the software's producer (`VERIFACTU_PRODUCER_NAME`, `VERIFACTU_PRODUCER_TAX_ID`). Not done yet: cancelling records (anulación), correcting rejected ones (subsanación), and per-organization certificates.

## Email

`POST /v1/emails` checks the attachments are the organization's files and queues the email; the worker sends it over SMTP (`SMTP_URL`, from `EMAIL_FROM`) with the business's name as the sender and replies to its email, or the user's. A failed send is retried with backoff; a final refusal from the server (5xx), or too many failures, marks it `failed`. Without `SMTP_URL` the endpoint answers `503 email_unavailable` and the web app falls back to the user's mail client.

## Background jobs

The `outbox` table holds work written in the same transaction as the change that needs it. The worker (`src/outbox/worker.ts`, started by `src/server.ts`) polls it, takes each due job with `FOR UPDATE SKIP LOCKED` and a five-minute lease, so several API processes can share it, and retries failures with exponential backoff up to 12 attempts. A job's `key` keeps at most one unfinished job per organization for the same purpose.

## Public API

Scripts and agents authenticate with an API key (Better Auth's api-key plugin), sent as `Authorization: Bearer fsk_…` or `x-api-key`. A key acts as the user who created it, in the organization that was active then (kept in its metadata), and only while the user still belongs to it; `requireOrganization` checks the membership on every request, as for sessions. Keys are created in the app (Configuración › API y agentes) or with `POST /v1/api-keys`, only by a signed-in person; only a hash is stored, and each key takes up to 600 requests a minute. The public routes write through the same commands as the web app (`src/routes/records.ts`), so they follow the same rules. The OpenAPI document declares the key as bearer auth.

Not done yet: an MCP server over these routes, and tax returns (forms 303 and 130) computed on the server, which needs the conversion from documents to tax books moved from the web app into `core`.

## Tenancy

Users belong to organizations through `membership` (role `owner`, `admin` or `member`). The session holds the active organization; an API key, the one it was made in. Tenant routes use `requireOrganization`, which checks the membership and sets `organizationId` on the context; every query on tenant data must filter by it.

## Database changes

1. Edit the tables in `src/db/schema/`.
2. `pnpm db:generate --name <what_changed>` writes a SQL migration to `drizzle/`. Review it by hand.
3. `pnpm db:migrate` applies it.

CI fails if the migrations are out of date with the schema.

## Tests

Integration tests run against a real Postgres: the `cuentalibre_test` database on the compose server, or `TEST_DATABASE_URL`. The database is wiped and migrated at the start of each run.
