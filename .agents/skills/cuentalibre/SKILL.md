---
name: cuentalibre
description: Read and write a business's accounting in cuentalibre through its public API — clients and suppliers, sales invoices, drafts, quotes and delivery notes, received invoices, expenses, payments, attachments, email, tags, payment methods, treasury, catalog and settings. Use when the user asks to register an expense or a ticket, book a supplier invoice, prepare or issue an invoice, rectify one, mark an invoice as paid, list what clients owe, review a quarter's income, expenses and VAT, or change anything else in cuentalibre. Issuing, deleting, editing an issued invoice, sending email, saving settings and closing quarters are real and often irreversible: preview and wait for explicit confirmation first.
---

# cuentalibre API

cuentalibre is open-source accounting for Spanish self-employed workers. Its API is the same one the web app uses, so every write follows the app's rules: gapless invoice numbering, closed quarters and VERI\*FACTU.

## Setup

- `CUENTALIBRE_API_KEY`: a key starting with `fsk_`, created in the app under **Configuración › API y agentes**. It acts as the person who created it, in the business that was active then. Never print it, echo it or ask the user to paste it into the chat; if it is missing, tell them to export it.
- `CUENTALIBRE_API_URL`: optional, defaults to `https://api.cuentalibre.es/v1`. Self-hosted instances use their own URL followed by `/v1` (`http://localhost:3000/v1` in development).

### No key yet

Without `CUENTALIBRE_API_KEY`, stop and tell the user before doing anything else. The account and the business are theirs: never sign up or create a business for them, not even on a fresh install or for a test.

1. If the instance is new (you just installed it, or they have no account), tell them it's ready and send them to the web app's `/registro` (`https://app.cuentalibre.es/registro` online) to create their account and their business. Wait until they say they're done.
2. Then ask: do they want to create the API key themselves, or should you?
   - **Themselves**: in **Configuración › API y agentes**, one key per agent; they export it as `CUENTALIBRE_API_KEY` (and `CUENTALIBRE_API_URL` when self-hosted), never in the chat.
   - **You**: a key can only be created from a signed-in session. Have them export `CUENTALIBRE_EMAIL` and `CUENTALIBRE_PASSWORD` (never in the chat), sign in with `POST /auth/sign-in/email` `{ email, password }` keeping the session cookie, and create it with `POST /api-keys` `{ name }` (`name` up to 32 characters, e.g. the agent's name). Send `Origin: <the web app's URL>` on both: the API only accepts sessions from it. Save the returned `key` to a file only the user can read, never print it, tell them where it is, and ask them to unset the password variables.
3. Continue with `GET /organization`.

Make requests with `scripts/cuentalibre.sh` (path relative to this skill), which adds the key, prints the body and reports the HTTP status:

```sh
scripts/cuentalibre.sh GET /organization            # check the key and see which business it opens
scripts/cuentalibre.sh POST /expenses @expense.json # JSON body from a file (@- reads stdin)
scripts/cuentalibre.sh UPLOAD ticket.pdf            # POST /files
```

Start every session with `GET /organization` and tell the user which business you are working in.

## Reference

Read the file you need before writing a request; they cover every route and field the API has.

- [references/api.md](references/api.md): authentication, data formats, create/patch/delete semantics, every error code, account and members, files, email, workspace, change feed and `POST /commands`.
- [references/records.md](references/records.md): contacts, sales documents (issuing, editing issued invoices, rectifying), received invoices, expenses, lines, payments and closed quarters.
- [references/plain-records.md](references/plain-records.md): tags, treasury accounts, payment methods, manual payments, bank movements, catalog families, products and stock movements (written through commands).
- [references/settings.md](references/settings.md): every settings section, invoice series, and closing or reopening quarters.
- [references/values.md](references/values.md): operation types, withholdings, income and expense accounts, asset categories, units and statuses.

The OpenAPI 3.1 document at `<API URL>/openapi.json` is the source of truth for schemas if something here seems off.

## Rules that are easy to get wrong

| What                                                  | Format                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Amounts of payments, expenses, totals, bank movements | **Integer cents**: `12100` is 121,00 €                                                                                                |
| Unit prices of lines and products                     | **Euros**, without VAT: `100.5`                                                                                                       |
| VAT, surcharge and line discounts                     | Fraction: `0.21` is 21 %                                                                                                              |
| Imputation, contact default discount                  | Number 0–100                                                                                                                          |
| Dates                                                 | `YYYY-MM-DD`                                                                                                                          |
| IDs                                                   | UUID. Generate one (UUIDv7 preferred) for every record you create, so a retry answers `409 already_exists` instead of duplicating it. |

- `POST` takes the whole record, including required fields that may be empty (`privateNotes: ""`, `payments: []`). `PATCH` takes only what changes; lists (`lines`, `payments`, `tags`, `attachments`) are replaced whole, so send the full list. `null` clears an optional field.
- An invoice's `status` follows its payments: to mark it paid, add a payment covering the total. Only invoices take payments; drafts and quotes don't.
- Payment method IDs come from `GET /workspace` (`paymentMethods`), which returns everything: read it once and reuse it.
- A record's quarter is decided by `issuedOn` (invoices), `bookedOn` (received invoices) or `date` (expenses). In a closed quarter they only take changes to payments, tags, attachments and private notes.
- On an error, read `error.code` and explain it. Don't work around `quarter_closed`, `invoice_issued`, `date_out_of_order` or `number_taken`: they protect the books. On `429 rate_limited`, wait a few seconds and retry.
- Before reporting amounts back, convert cents to euros (`127200` → 1.272,00 €).

## Ask before you act

Show the user exactly what you will send and wait for an explicit yes before:

- issuing an invoice (`POST /invoices`, `POST /sales-documents/{id}/issue`, the `issue` command): it takes the next number of its series and, under VERI\*FACTU, is reported to the tax agency and can never change again;
- deleting anything;
- changing an issued invoice;
- sending an email (`POST /emails`);
- saving settings (`saveSettings` replaces a whole section);
- closing or reopening a quarter (only when the user asks, with the figures they filed).

Creating drafts, quotes, contacts, expenses and received invoices is fine without asking when the user requested it, but summarise what you created, with amounts in euros, so they can check it in the app.

## Routes at a glance

| Route                                                                    | Use                                                                           |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `GET /organization`, `GET /organization/members`, `GET /me`              | Business, people, the user.                                                   |
| `GET\|POST /contacts`, `GET\|PATCH\|DELETE /contacts/{id}`               | Clients and suppliers (`?role=client\|supplier`).                             |
| `GET\|POST /sales-documents`, `GET\|PATCH\|DELETE /sales-documents/{id}` | Invoices, drafts, quotes, delivery notes (`?from=&to=` on `issuedOn`).        |
| `POST /invoices`, `POST /sales-documents/{id}/issue`                     | Issue an invoice.                                                             |
| `GET\|POST /purchase-invoices`, `…/{id}`                                 | Received invoices (`?from=&to=` on `bookedOn`).                               |
| `GET\|POST /expenses`, `…/{id}`                                          | Expenses (`?from=&to=` on `date`).                                            |
| `POST /files`, `GET /files/{id}`                                         | Upload and download attachments.                                              |
| `POST /emails`, `GET /emails?documentId=`                                | Send email, list sent email.                                                  |
| `GET /workspace`, `GET /sync?since=`                                     | Everything at once; changes since a cursor.                                   |
| `POST /commands`                                                         | Batches, and tags, payment methods, treasury, catalog, settings and quarters. |

## Workflows

### Expense from a ticket or receipt

Use an expense for tickets, the autónomo fee, fees and anything without a full invoice; it deducts no VAT. If the document is a full invoice with the supplier's NIF and VAT broken down, book it as a received invoice instead.

1. Read the document: date, issuer, concept, total with taxes.
2. Upload it: `UPLOAD <file>` → `{ id, name, size }`.
3. Pick `expenseType` (values.md has the list with typical uses; `629` when nothing fits).
4. Look for the supplier in `GET /contacts?role=supplier`; if it isn't there, use `supplierId: null` and `otherPayee: { name, taxId }`.
5. `POST /expenses` with the attachment; `payment: { date, paymentMethodId }` if already paid, else `null`.

### Received invoice

1. Find or create the supplier (`role: "supplier"`, with its `taxId`).
2. Upload the PDF.
3. `POST /purchase-invoices` with the supplier's `number`, `issuedOn`, `bookedOn` (usually the same day; it decides the quarter), `expenseType`, `imputation`, `vatImputation: null`, `withholding`, `operationType`, `cashBasis`, `rental`, `lines` (unit prices in euros, VAT as a fraction), `payments`, `privateNotes: ""` and the attachment. Add `asset` for investment goods that are amortized.
4. Check that the totals you computed from the lines match the document before reporting back.

### Prepare and issue an invoice

1. Find the client in `GET /contacts?role=client` (or create it). Reuse its default `withholding`, `discount` and `paymentMethodId`; under VERI\*FACTU it needs a `taxId`.
2. Create a **draft** (`POST /sales-documents`, `kind: "draft"`, `number: null`, `series: "normal"`, `status: "pending"`), with `incomeType`, `operationType`, `lines`, `dueOn`, `publicNotes`.
3. Show the user the client, lines, base, VAT, withholding and total in euros.
4. Only after an explicit yes, `POST /sales-documents/{id}/issue`. Report the number and `issued.totals`.

To correct an issued invoice that can't be edited, issue a rectifying one (`series: "rectifying"`, `rectifiesId`, negative quantities for what it takes away), with the same confirmation.

### Record a payment

`GET` the invoice (sales or received), append `{ id, date, amount, paymentMethodId }` (amount in cents) to its `payments`, and `PATCH` the whole list.

### Pending collections

`GET /sales-documents`, keep `kind: "invoice"` with `status: "pending"`, and report each client, number, `dueOn`, total and what is left (total minus payments), overdue first.

### Quarter review

List issued invoices (`kind: "invoice"`, by `issuedOn`), received invoices (by `bookedOn`) and expenses (by `date`) for the quarter. Sum output VAT and withholdings from `issued.totals`, input VAT from the received invoices' lines times `vatImputation` (or `imputation`), and deductible expenses times `imputation`. Present it as an estimate: forms 303 and 130 are computed by the web app, and its figures are the ones to file.

## Not available through the API

Invoice PDFs (the web app generates them; to email an invoice, upload a PDF yourself), computing forms 303 and 130, signing up and the user's account. API keys need a signed-in session, not a key (see Setup › No key yet).
