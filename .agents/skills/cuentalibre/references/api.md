# API basics, account, files, email and sync

## Base URL and authentication

- cuentalibre online: `https://api.cuentalibre.es/v1`. Self-hosted: the server's URL followed by `/v1` (`http://localhost:3000/v1` in development).
- Send the key as `Authorization: Bearer fsk_…` or `x-api-key: fsk_…`.
- A key acts as the user who created it, in the organization that was active then. It stops working when revoked, when it expires, or when that user leaves the organization (`403`).
- 600 requests a minute per key; above that, `429 rate_limited`.
- No key needed: `GET /health` (API and database status), `GET /sign-in-methods`, `GET /openapi.json` (the OpenAPI 3.1 document, the source of truth for every schema).

## Data formats

| What                                                  | Format                                             | Example                                  |
| ----------------------------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| IDs                                                   | UUID; new records use UUIDv7, any UUID is accepted | `"01a1637e-be51-7002-9b11-4b34b7bef758"` |
| Dates                                                 | ISO 8601 without time                              | `"2026-10-22"`                           |
| Local date-times (stock movements)                    | Without time zone                                  | `"2026-10-17T19:29"`                     |
| Amounts of payments, expenses, totals, bank movements | Integer **cents**                                  | `12100` (121,00 €)                       |
| Unit prices of lines and products                     | **Euros**, any decimals, without VAT               | `100.5`                                  |
| VAT, surcharge and line discounts                     | Fraction 0–1                                       | `0.21`                                   |
| Imputation percentages                                | Integer 0–100                                      | `100`                                    |
| Contact default discount                              | Number 0–100 (a percentage, unlike line discounts) | `10`                                     |
| Accounts                                              | PGC code as a string                               | `"705"`                                  |
| Quarters                                              | `YYYY-TN`                                          | `"2026-T3"`                              |
| Colors                                                | `#rrggbb`                                          | `"#2f45c9"`                              |

Fields without a value are left out of responses (nullable fields come back as `null`). Unknown fields are ignored.

## Create, change, delete

- `POST` takes the whole record. `id` is optional; send your own UUID so a retry answers `409 already_exists` instead of creating a duplicate.
- `PATCH` takes only the fields that change. `null` clears an optional field; a field that accepts null (`dueOn`) is set to null. Lists (`lines`, `payments`, `tags`, `attachments`, `bankAccounts`…) are replaced whole. `id` can't change.
- `DELETE` answers `204`. Deletes are soft (tombstones) but there is no undelete through the API.
- Every write is atomic.

## Errors

Body: `{ "error": { "code": "…", "message": "…" } }`. Program against `code`; `message` is English and says which field fails (`"clientId: no such client."`).

| HTTP | `code`                                                                                                                                                                                                                                                                                                                                             | Meaning                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `invalid_request`                                                                                                                                                                                                                                                                                                                                  | Body isn't JSON, or body/params don't have the expected shape.                                                                                              |
| 400  | `invalid_contact`, `invalid_document`, `invalid_invoice` (received), `invalid_expense`, `invalid_tag`, `invalid_payment_method`, `invalid_treasury_account`, `invalid_manual_payment`, `invalid_bank_movement`, `invalid_catalog_family`, `invalid_product`, `invalid_stock_movement`, `invalid_settings`, `invalid_filed_return`, `invalid_email` | Well-formed but invalid data: unknown client or supplier, invoice without lines, a reference to a record that doesn't exist or was deleted, a family cycle… |
| 400  | `invalid_attachment`                                                                                                                                                                                                                                                                                                                               | An attachment names a file that wasn't uploaded with `POST /files`.                                                                                         |
| 400  | `verifactu_issuer_missing`                                                                                                                                                                                                                                                                                                                         | Under VERI\*FACTU the business needs its NIF and name (settings `businessProfile`) to issue.                                                                |
| 401  | `unauthorized`, `invalid_api_key`                                                                                                                                                                                                                                                                                                                  | Missing key, or invalid, expired or revoked.                                                                                                                |
| 403  | `no_active_organization`, `not_a_member`                                                                                                                                                                                                                                                                                                           | The key no longer has access to the organization.                                                                                                           |
| 404  | `not_found`                                                                                                                                                                                                                                                                                                                                        | Doesn't exist, was deleted, or belongs to another organization.                                                                                             |
| 409  | `already_exists`                                                                                                                                                                                                                                                                                                                                   | A record (or file) with that `id` exists.                                                                                                                   |
| 409  | `invoice_issued`                                                                                                                                                                                                                                                                                                                                   | Issued invoice: can't change or delete this (see records.md).                                                                                               |
| 409  | `already_issued`                                                                                                                                                                                                                                                                                                                                   | The invoice is already issued.                                                                                                                              |
| 409  | `number_taken`                                                                                                                                                                                                                                                                                                                                     | Importing an invoice with a number that exists.                                                                                                             |
| 409  | `date_out_of_order`                                                                                                                                                                                                                                                                                                                                | Dated before the last invoice of its series.                                                                                                                |
| 409  | `not_last_in_series`                                                                                                                                                                                                                                                                                                                               | Only the last invoice of its series can be deleted; rectify it instead.                                                                                     |
| 409  | `series_inactive`                                                                                                                                                                                                                                                                                                                                  | The series takes no new invoices.                                                                                                                           |
| 409  | `series_in_use`                                                                                                                                                                                                                                                                                                                                    | Saving invoice settings that remove or re-mask a series already used.                                                                                       |
| 409  | `quarter_closed`                                                                                                                                                                                                                                                                                                                                   | The record's quarter is closed.                                                                                                                             |
| 409  | `in_use`                                                                                                                                                                                                                                                                                                                                           | Can't delete: another record names it (a payment method, an account, a rectifying invoice or credit note…).                                                 |
| 413  | `file_too_large`                                                                                                                                                                                                                                                                                                                                   | Over the upload limit (25 MB by default).                                                                                                                   |
| 415  | `invalid_request`                                                                                                                                                                                                                                                                                                                                  | Wrong `Content-Type` (almost always must be `application/json`).                                                                                            |
| 429  | `rate_limited`                                                                                                                                                                                                                                                                                                                                     | Too many requests; wait and retry.                                                                                                                          |
| 503  | `email_unavailable`                                                                                                                                                                                                                                                                                                                                | The server can't send email.                                                                                                                                |

## Account and organization

- `GET /organization` → `{ organization: { id, name, slug }, role }`, role `owner`, `admin` or `member`.
- `GET /organization/members` → people of the organization, oldest first: `userId`, `name`, `email`, `role`, `joinedAt`.
- `GET /me` → `{ user: { id, name, email, emailVerified, hasPassword, passwordChangedAt }, activeOrganizationId, memberships: [{ organization, role }], settings }`.
- `PUT /me/settings/{section}` saves one section of the user's own settings, whole:
  - `userProfile`: `{ firstName (1–100), lastName, birthDate ("YYYY-MM-DD" or ""), phone, gender ("", "male", "female") }`. Also renames the user.
  - `userLocale`: `{ language, numberFormat, timeZone }`; empty follows the business defaults.
  - `userTour`: `{ status }`, `"pending"` (the default), `"finished"` or `"skipped"`: whether the app shows its first-run tour.
- API keys (`GET`/`POST /api-keys`, `DELETE /api-keys/{id}`) and deleting the account need a signed-in session: a key can't manage keys.

## Files

- `POST /files`: `multipart/form-data` with `file` and optional `id` (UUID). → `201 { id, name, size, contentType }`. Limit 25 MB by default. Files never change.
- `GET /files/{id}`: downloads it. PDFs and common images are served inline.
- Link a file from a record's `attachments` as `{ id, name, size }` (up to 100 per record). An unknown file id → `400 invalid_attachment`.

## Email

`POST /emails` queues an email and answers `202` with the message. It goes out under the business's name, with replies to its email.

| Field         | Type             |                                                |
| ------------- | ---------------- | ---------------------------------------------- |
| `to`          | list of emails   | Required, 1–10.                                |
| `cc`          | list of emails   | Up to 10.                                      |
| `subject`     | text             | Required, 1–200 characters.                    |
| `body`        | text             | Required, plain text, up to 20 000 characters. |
| `attachments` | list of file ids | Uploaded with `POST /files`, up to 10.         |
| `documentId`  | id               | The sales document it sends, to find it later. |

Message: `{ id, documentId, to, cc, subject, status, error, createdAt, sentAt }`, `status` `queued`, `sent` or `failed`. `GET /emails?documentId=` lists messages, newest first. The API doesn't generate invoice PDFs: upload one yourself to attach it.

## Workspace and change feed

- `GET /workspace` → everything the organization keeps, plus `cursor`: `clients`, `suppliers`, `salesDocuments`, `purchaseInvoices`, `expenses`, `closedQuarters`, `filedReturns` (every version, oldest first), `tags`, `treasuryAccounts`, `paymentMethods`, `manualPayments`, `bankMovements`, `catalogFamilies`, `products`, `stockMovements`, `settings` (every section, defaults for those never saved). It is large: read it once and reuse it.
- `GET /sync?since=<cursor>&limit=500` → `{ cursor, changes, hasMore }` (`limit` 1–1000). A change is `{ op: "upsert", entity, data }` with the record's latest state (for `settings`, `data` is `{ section, data }`), or `{ op: "delete", entity, id }` (for `closedQuarters`, `id` is the reopened period). Keep asking with the new cursor while `hasMore`.

## Commands

`POST /commands` with `{ "commands": [...] }`: up to 500 commands applied in order in one transaction; if one fails, none is saved. → `{ changes }` with the final state of what they touched. This is how the web app writes, and the only way to write entities without their own route.

| Command         | Shape                                                                                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create`        | `{ type: "create", entity, data }`. `data` is the whole record with its `id` (required here).                                                                                                                                                                                                                      |
| `update`        | `{ type: "update", entity, id, changes }`. Same semantics as `PATCH`.                                                                                                                                                                                                                                              |
| `delete`        | `{ type: "delete", entity, id }`                                                                                                                                                                                                                                                                                   |
| `issue`         | `{ type: "issue", data, number? }`. Issues `data` as an invoice (a new one, or a draft with the same `id`). `number` only for invoices issued elsewhere and imported: keeps that number instead of taking the next one, must fit the series and not exist (`409 number_taken`), and creates no VERI\*FACTU record. |
| `closeQuarter`  | `{ type: "closeQuarter", period: "2026-T3", closedOn, returns? }` (see settings.md).                                                                                                                                                                                                                               |
| `reopenQuarter` | `{ type: "reopenQuarter", period }`                                                                                                                                                                                                                                                                                |
| `saveSettings`  | `{ type: "saveSettings", section, data }`. Replaces the whole section (see settings.md).                                                                                                                                                                                                                           |

Entities for `create`, `update` and `delete`: `clients`, `suppliers`, `salesDocuments` (drafts, quotes, delivery notes), `purchaseInvoices`, `expenses`, `tags`, `treasuryAccounts`, `paymentMethods`, `manualPayments`, `bankMovements`, `catalogFamilies`, `products`, `stockMovements`. In commands, contacts are `clients` or `suppliers` and carry no `role`. Every `id` in commands must be a UUID.

```json
{
  "commands": [
    { "type": "create", "entity": "tags", "data": { "id": "…", "name": "Cliente VIP", "color": "#2f45c9" } },
    { "type": "update", "entity": "clients", "id": "…", "changes": { "tags": ["…"] } },
    { "type": "delete", "entity": "expenses", "id": "…" }
  ]
}
```
