# Contacts, sales, received invoices and expenses

These four have their own REST routes. Value lists (accounts, withholdings, operation types…) are in values.md.

## Contacts

Clients and suppliers. `role` is `client` or `supplier` and can't change.

| Route                                 |                                                            |
| ------------------------------------- | ---------------------------------------------------------- |
| `GET /contacts?role=client\|supplier` | → `{ contacts: [...] }`. `role` optional.                  |
| `GET /contacts/{id}`                  | One contact.                                               |
| `POST /contacts`                      | Create (`role` required).                                  |
| `PATCH /contacts/{id}`                | Change fields.                                             |
| `DELETE /contacts/{id}`               | Delete. Issued invoices keep the client's data they froze. |

| Field                                        | Type                   |                                                                                                     |
| -------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| `role`                                       | `client` \| `supplier` | Required on create.                                                                                 |
| `name`                                       | text                   | Required. Name or company name.                                                                     |
| `taxId`                                      | text                   | Required, may be empty. NIF, or EU VAT number. Under VERI\*FACTU a client needs one to be invoiced. |
| `address`, `postalCode`, `city`, `province`  | text                   | `city` is the town (población).                                                                     |
| `country`                                    | text                   | Spanish name (`"Francia"`); Spain when missing.                                                     |
| `email`, `phone`, `mobile`, `fax`, `website` | text                   |                                                                                                     |
| `vies`                                       | boolean                | Registered in VIES, for intra-EU operations.                                                        |
| `discount`                                   | 0–100                  | Default line discount on their documents, as a percentage.                                          |
| `withholding`                                | withholding            | Default IRPF withholding on their documents.                                                        |
| `paymentMethodId`                            | id                     | Default payment method.                                                                             |
| `language`, `numberFormat`                   | text                   | Clients only: language and format of their documents.                                               |
| `bankAccounts`                               | list                   | `{ id, iban, bic?, notes?, isDefault }`; IBAN uppercase, no spaces.                                 |
| `eInvoice`                                   | object                 | DIR3 codes for FACe: `accountingOffice`, `managementBody`, `processingUnit`, `proposingBody`.       |
| `custom1`, `custom2`, `notes`                | text                   | Free fields (named in settings `contactSettings`).                                                  |
| `tags`                                       | list of tag ids        |                                                                                                     |
| `attachments`                                | list                   | `{ id, name, size }` of uploaded files.                                                             |

## Sales documents

Invoices, drafts, quotes and delivery notes, told apart by `kind`: `invoice`, `draft`, `quote`, `deliveryNote`.

| Route                              |                                                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /sales-documents?from=&to=`   | → `{ data: [...] }`, optionally between two `issuedOn` dates (inclusive).                                                     |
| `GET /sales-documents/{id}`        | One document.                                                                                                                 |
| `POST /sales-documents`            | Create a draft, quote or delivery note. `kind: "invoice"` is rejected: invoices are issued.                                   |
| `PATCH /sales-documents/{id}`      | Change fields.                                                                                                                |
| `DELETE /sales-documents/{id}`     | Delete. Issued invoices only when they can be revised (below).                                                                |
| `POST /invoices`                   | Issue a new invoice (`201`, numbered, with totals). With the `id` of an existing draft, issues that draft with the data sent. |
| `POST /sales-documents/{id}/issue` | Issue a draft as it is stored. Only drafts: quotes and delivery notes are invoiced by issuing a new invoice.                  |

| Field                            | Type                                              |                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                           | `invoice` \| `draft` \| `quote` \| `deliveryNote` | Required. Can't change; a draft becomes an invoice by issuing it.                                                                                                                                                                                                    |
| `number`                         | text \| null                                      | Required key. Send `null`; the server numbers invoices when issuing them. Drafts, quotes and delivery notes keep what you send.                                                                                                                                      |
| `series`                         | `normal` \| `rectifying`                          | Required.                                                                                                                                                                                                                                                            |
| `seriesId`                       | id                                                | A custom series from settings `invoiceSettings.series`, of the same type as `series`. Without it, the default/built-in series of `series` (`AAAA-####`, `R-AAAA-####`).                                                                                              |
| `clientId`                       | id \| `""`                                        | The client (must be a live client of the organization). Empty only on drafts and quotes.                                                                                                                                                                             |
| `issuedOn`                       | date                                              | Required. Decides the quarter and the year in the number.                                                                                                                                                                                                            |
| `dueOn`                          | date \| null                                      | Required. Due date; validity on quotes.                                                                                                                                                                                                                              |
| `operationOn`                    | date \| null                                      | Required. Date of the supply when it differs.                                                                                                                                                                                                                        |
| `incomeType`                     | income account                                    | Required. Usually `705` (services) or `700` (goods).                                                                                                                                                                                                                 |
| `withholding`                    | withholding                                       | Required; `none` without one.                                                                                                                                                                                                                                        |
| `operationType`                  | sales operation type                              | Required.                                                                                                                                                                                                                                                            |
| `cashBasis`                      | boolean                                           | Required. VAT cash accounting.                                                                                                                                                                                                                                       |
| `rental`                         | boolean                                           | Required. Property rental (forms 115/180).                                                                                                                                                                                                                           |
| `rentalLocation`, `cadastralRef` |                                                   | Location (values.md) and cadastral reference of the rented property.                                                                                                                                                                                                 |
| `rectifiesId`                    | id                                                | Rectifying invoices: the invoice it corrects. Only on `series: "rectifying"`.                                                                                                                                                                                        |
| `lines`                          | list of lines                                     | Required. Up to 1000.                                                                                                                                                                                                                                                |
| `supplies`                       | cents                                             | Suplidos: paid on the client's behalf, outside the taxable base.                                                                                                                                                                                                     |
| `payments`                       | list of payments                                  | Collections, oldest first. **Only invoices** take payments.                                                                                                                                                                                                          |
| `status`                         | text                                              | Required. Invoices and drafts: `pending` or `paid`. Quotes and delivery notes: `created`, `sent`, `accepted`, `rejected`, `invoiced`.                                                                                                                                |
| `publicNotes`                    | text                                              | Required, may be empty. Printed on the document.                                                                                                                                                                                                                     |
| `privateNotes`                   | text                                              | Required, may be empty. Only seen in cuentalibre.                                                                                                                                                                                                                    |
| `language`, `numberFormat`       | text                                              | Empty uses the client's.                                                                                                                                                                                                                                             |
| `tags`, `attachments`            | lists                                             |                                                                                                                                                                                                                                                                      |
| `issued`                         | object                                            | Read-only, issued invoices: `client` (frozen `name`, `taxId`, `address`, `postalCode`, `city`, `province`, `country`), `totals`, and under VERI\*FACTU `verifactu: { status, qrUrl, error? }` with status `pending`, `accepted`, `acceptedWithErrors` or `rejected`. |

`issued.totals`, in cents: `base`, `vat`, `surcharge`, `withholding`, `supplies`, `total`, `vatBreakdown: [{ rate, base, vat }]`. Total = base + VAT + surcharge − withholding + supplies.

### Lines (sales and received invoices)

| Field                      | Type     |                                                                                   |
| -------------------------- | -------- | --------------------------------------------------------------------------------- |
| `id`                       | text     | Required, unique in the document (`"1"`, `"2"`…).                                 |
| `concept`                  | text     | Required.                                                                         |
| `detail`                   | text     | Longer description under the concept.                                             |
| `unitPrice`                | number   | Required. **Euros**, without VAT.                                                 |
| `quantity`                 | number   | Required. Negative in rectifying invoices that subtract.                          |
| `discount`                 | fraction | Required. `0`, or `0.1` for 10 %.                                                 |
| `vatRate`                  | fraction | Required. `0.21`, `0.1`, `0.04`, `0`…                                             |
| `surchargeRate`            | fraction | Recargo de equivalencia (`0.052` with 21 %, `0.014` with 10 %, `0.005` with 4 %). |
| `serviceFrom`, `serviceTo` | date     | Service period.                                                                   |
| `productId`, `unit`        |          | Catalog product and its unit (values.md).                                         |

### Payments (sales and received invoices)

`{ id, date, amount, paymentMethodId }`: `amount` in **cents** (negative for refunds), `paymentMethodId` one of the organization's payment methods (`GET /workspace` → `paymentMethods`). Up to 1000.

An invoice's `status` follows its payments: `paid` once they cover the total, `pending` otherwise, whatever `status` is sent. To mark an invoice as paid, add the payment.

### Issuing

`POST /invoices` takes the document without `issued`; `kind` is forced to `invoice` and `number` should be `null`. It is rejected when:

- there is no client or no line (`400 invalid_document`);
- the series is inactive (`409 series_inactive`) or `seriesId` isn't a series of that type (`400`);
- it is dated before the last invoice of its series (`409 date_out_of_order`): numbering is gapless and in date order;
- its quarter is closed (`409 quarter_closed`);
- the invoice already exists as an issued invoice (`409 already_issued`);
- it is rectifying and `rectifiesId` doesn't name an issued invoice of the normal series, or it is normal and has `rectifiesId` (`400`);
- under VERI\*FACTU, the business lacks NIF or name (`400 verifactu_issuer_missing`) or the client lacks a tax ID (`400 invalid_document`).

Issuing freezes the client's fiscal data and the totals. Under VERI\*FACTU (settings `verifactu.system: "verifactu"` from `startDate`), it also creates the invoice record, chained to the previous one, and sends it to the AEAT in the background; its status shows up in `issued.verifactu`.

To import an invoice issued by other software with its own number, use the `issue` command with `number` (api.md › Commands).

### Changing or deleting an issued invoice

Always allowed: `payments` (and `status`, which follows them), `tags`, `attachments`, `privateNotes`.

Anything else, or deleting it, only while all three hold: the business is exempt from VERI\*FACTU (settings `verifactu.system: "exempt"`), the invoice has no VERI\*FACTU record, and its quarter is open. Then totals and client data are recomputed. `kind`, `number`, `series`, `seriesId` and `rectifiesId` never change (`400`); `issuedOn` can't leave its year (`400`) or break the order of the series (`409 date_out_of_order`). Only the last invoice of its series can be deleted, which frees its number for the next one; deleting any other answers `409 not_last_in_series` (rectify it instead), and one that a rectifying invoice corrects answers `409 in_use`. Otherwise: `409 invoice_issued` or `409 quarter_closed`.

### Rectifying

Issue another invoice with `series: "rectifying"`, `rectifiesId` set to the original, and lines that correct it (negative quantities to subtract). It is numbered in the rectifying series (`R-2026-0001`). Refunds are negative payments.

### Example

```json
{
  "kind": "invoice",
  "number": null,
  "series": "normal",
  "clientId": "01a15886-012f-7004-bd02-521c3db4d6ba",
  "issuedOn": "2026-10-22",
  "dueOn": "2026-11-21",
  "operationOn": null,
  "incomeType": "705",
  "withholding": "professional",
  "operationType": "national",
  "cashBasis": false,
  "rental": false,
  "status": "pending",
  "publicNotes": "",
  "privateNotes": "",
  "lines": [{ "id": "1", "concept": "Diseño web", "unitPrice": 1200, "quantity": 1, "discount": 0, "vatRate": 0.21 }]
}
```

→ `number: "2026-0007"`, `issued.totals: { base: 120000, vat: 25200, surcharge: 0, withholding: 18000, supplies: 0, total: 127200, … }`.

## Received invoices

Invoices from suppliers. `bookedOn` decides the quarter.

| Route                              |                                                               |
| ---------------------------------- | ------------------------------------------------------------- |
| `GET /purchase-invoices?from=&to=` | → `{ data: [...] }`, optionally between two `bookedOn` dates. |
| `GET /purchase-invoices/{id}`      | One.                                                          |
| `POST /purchase-invoices`          | Register one.                                                 |
| `PATCH /purchase-invoices/{id}`    | Change fields.                                                |
| `DELETE /purchase-invoices/{id}`   | Delete.                                                       |

| Field                            | Type                    |                                                                                                                                                                                                                                                             |
| -------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supplierId`                     | id                      | Required. A live contact with `role: "supplier"`.                                                                                                                                                                                                           |
| `number`                         | text                    | Required. The supplier's number.                                                                                                                                                                                                                            |
| `issuedOn`                       | date                    | Required. Date on the invoice.                                                                                                                                                                                                                              |
| `bookedOn`                       | date                    | Required. Booking date; decides the quarter. Later than `issuedOn` when it arrives late, never earlier (`400`).                                                                                                                                             |
| `dueOn`, `operationOn`           | date \| null            | Required.                                                                                                                                                                                                                                                   |
| `expenseType`                    | expense account         | Required.                                                                                                                                                                                                                                                   |
| `imputation`                     | 0–100                   | Required. Share that counts as a deductible expense.                                                                                                                                                                                                        |
| `vatImputation`                  | 0–100 \| null           | Required. Share of VAT deducted; `null` = same as `imputation`.                                                                                                                                                                                             |
| `withholding`                    | withholding             | Required. What you withhold from the supplier (professionals, rentals).                                                                                                                                                                                     |
| `operationType`                  | purchase operation type | Required. `import` instead of `export`.                                                                                                                                                                                                                     |
| `customsDocument`                | text                    | DUA (or H7 under 150 €) of an import.                                                                                                                                                                                                                       |
| `cashBasis`                      | boolean                 | Required. The supplier applies cash accounting.                                                                                                                                                                                                             |
| `rental`                         | boolean                 | Required.                                                                                                                                                                                                                                                   |
| `rentalLocation`, `cadastralRef` |                         | As in sales.                                                                                                                                                                                                                                                |
| `rectifiesId`                    | id                      | Credit notes: the received invoice it corrects (not itself), which can't be deleted while the credit note exists (`409 in_use`).                                                                                                                            |
| `lines`                          | list of lines           | Required. Same shape as sales lines.                                                                                                                                                                                                                        |
| `payments`                       | list of payments        | Required, may be empty.                                                                                                                                                                                                                                     |
| `privateNotes`                   | text                    | Required, may be empty.                                                                                                                                                                                                                                     |
| `asset`                          | object                  | Investment good, amortized instead of expensed: `category`, `condition` (`new`, `used`, `accelerated`, `lowValue`, `free`), `method` (`rate` or `years`), `value` (yearly % or years, > 0), `identifier` (plate or cadastral ref). Categories in values.md. |
| `tags`, `attachments`            | lists                   |                                                                                                                                                                                                                                                             |

```json
{
  "supplierId": "01a1592b-6336-7001-9663-adb186b74d91",
  "number": "F-2026-118",
  "issuedOn": "2026-10-20",
  "bookedOn": "2026-10-20",
  "dueOn": null,
  "operationOn": null,
  "expenseType": "6291",
  "imputation": 100,
  "vatImputation": null,
  "withholding": "none",
  "operationType": "national",
  "cashBasis": false,
  "rental": false,
  "lines": [{ "id": "1", "concept": "Fibra y móvil", "unitPrice": 45, "quantity": 1, "discount": 0, "vatRate": 0.21 }],
  "payments": [],
  "privateNotes": ""
}
```

## Expenses

Tickets, the autónomo fee, fees and anything without a full invoice. The amount includes taxes and no VAT is deducted. `date` decides the quarter.

| Route                     |                                                    |
| ------------------------- | -------------------------------------------------- |
| `GET /expenses?from=&to=` | → `{ data: [...] }`, optionally between two dates. |
| `GET /expenses/{id}`      | One.                                               |
| `POST /expenses`          | Register one.                                      |
| `PATCH /expenses/{id}`    | Change fields.                                     |
| `DELETE /expenses/{id}`   | Delete.                                            |

| Field                            | Type            |                                                                                              |
| -------------------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `date`                           | date            | Required. Decides the quarter.                                                               |
| `number`                         | text            | Required, may be empty. Ticket or reference number.                                          |
| `concept`                        | text            | Required.                                                                                    |
| `amount`                         | cents           | Required. Taxes included.                                                                    |
| `expenseType`                    | expense account | Required.                                                                                    |
| `imputation`                     | 0–100           | Required.                                                                                    |
| `supplierId`                     | id \| null      | Required. A saved supplier, or `null`.                                                       |
| `otherPayee`                     | object          | Without a supplier: `{ name, taxId }` of who was paid (`taxId` may be empty).                |
| `payment`                        | object \| null  | Required. `{ date, paymentMethodId }`, or `null` while pending. Expenses are paid in one go. |
| `rental`                         | boolean         | Required.                                                                                    |
| `rentalLocation`, `cadastralRef` |                 | As in sales.                                                                                 |
| `privateNotes`                   | text            | Required, may be empty.                                                                      |
| `tags`, `attachments`            | lists           |                                                                                              |

```json
{
  "date": "2026-10-01",
  "number": "",
  "concept": "Cuota de autónomos octubre",
  "amount": 29400,
  "expenseType": "6422",
  "imputation": 100,
  "supplierId": null,
  "otherPayee": { "name": "Tesorería General de la Seguridad Social", "taxId": "" },
  "payment": null,
  "rental": false,
  "privateNotes": ""
}
```

## Closed quarters

While a quarter is closed, issued invoices (by `issuedOn`), received invoices (by `bookedOn`) and expenses (by `date`) in it only take changes to payments, tags, attachments and private notes. Creating, deleting, issuing or moving records into or out of it → `409 quarter_closed`. Drafts, quotes and delivery notes have no legal effect and aren't locked. The user reopens it in the app (or with `reopenQuarter`, see settings.md).
