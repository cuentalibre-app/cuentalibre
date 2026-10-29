# Tags, treasury and catalog

These records have no legal effects and no quarter. They have no REST routes: read them from `GET /workspace` (or the change feed) and write them with `POST /commands` (`create`, `update`, `delete`; api.md › Commands). Every `id` is a UUID you generate. The API checks their shape and that the records they name are the organization's and not deleted (`400 invalid_<entity>`), and refuses to delete one another record still names (`409 in_use`).

## Tags (`tags`)

`{ id, name, color }`, `color` as `#rrggbb`. Any record's `tags` lists tag ids.

## Treasury accounts (`treasuryAccounts`)

| Field    | Type                                   |                                                            |
| -------- | -------------------------------------- | ---------------------------------------------------------- |
| `id`     | id                                     |                                                            |
| `kind`   | `bank` \| `cash` \| `paypal` \| `card` |                                                            |
| `name`   | text                                   | Required.                                                  |
| `number` | text                                   | IBAN, card number (often its last digits) or PayPal email. |
| `active` | boolean                                |                                                            |

Can't be deleted while a payment method names it.

## Payment methods (`paymentMethods`)

| Field       | Type                                                                        |                                                                                |
| ----------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `id`        | id                                                                          | Used as `paymentMethodId` in payments, expenses, manual payments and contacts. |
| `type`      | `cash` \| `card` \| `transfer` \| `directDebit` \| `promissory` \| `paypal` |                                                                                |
| `name`      | text                                                                        | Required.                                                                      |
| `number`    | text                                                                        | Account or card number; may hold only the last four digits.                    |
| `accountId` | id \| null                                                                  | Treasury account it books into.                                                |
| `active`    | boolean                                                                     |                                                                                |

Can't be deleted while a contact, an expense, a payment of a sales or received invoice, a manual payment or settings `defaultPaymentMethod` names it (the message says which); deactivate it instead. The method proposed on new documents is settings `defaultPaymentMethod`.

## Manual payments (`manualPayments`)

Money in or out not tied to an invoice or expense: a loan, a transfer to savings, an adjustment.

`{ id, date, amount, paymentMethodId, description }`, `amount` in cents, positive for money in.

## Catalog families (`catalogFamilies`)

`{ id, name, parentId }`, `parentId` another family or `null`. Cycles are rejected.

## Products (`products`)

| Field                                  | Type           |                                                                                                                                         |
| -------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                   | id             | Used as `productId` on lines and stock movements.                                                                                       |
| `familyId`                             | id \| null     |                                                                                                                                         |
| `name`                                 | text           | Required.                                                                                                                               |
| `description`                          | text           | Printed on documents when settings ask for it.                                                                                          |
| `privateNotes`                         | text           |                                                                                                                                         |
| `unit`                                 | unit \| null   | values.md › Units.                                                                                                                      |
| `tags`                                 | list of ids    |                                                                                                                                         |
| `active`                               | boolean        | Inactive products can't be picked in documents.                                                                                         |
| `sku`                                  | text           | Own code, unique in the catalog.                                                                                                        |
| `supplierRef`                          | text           |                                                                                                                                         |
| `price`                                | number         | Unit sale price in **euros**, before discount and taxes.                                                                                |
| `discount`, `vatRate`, `surchargeRate` | fraction       |                                                                                                                                         |
| `cost`                                 | number \| null | Unit acquisition cost in euros before taxes; `null` when unknown.                                                                       |
| `costVatRate`, `costSurchargeRate`     | fraction       |                                                                                                                                         |
| `custom`                               | 4 texts        | Free fields named in settings `catalogSettings.customFieldNames`.                                                                       |
| `stock`                                | object \| null | `null` when stock isn't counted; else `{ allowWithoutStock, alarm }`, `alarm` `null` or `{ minUnits, dashboard, notification, email }`. |

All fields are required (use `""`, `[]` or `null`).

## Stock movements (`stockMovements`)

| Field        | Type                                                                                        |                                             |
| ------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `id`         | id                                                                                          |                                             |
| `productId`  | id                                                                                          | May name a deleted product.                 |
| `quantity`   | number                                                                                      | Signed.                                     |
| `at`         | local date-time                                                                             | `"2026-10-17T19:29"`                        |
| `kind`       | `invoice` \| `deliveryNote` \| `initial` \| `import` \| `settings` \| `deleted` \| `manual` |                                             |
| `reason`     | `loss` \| `found` \| `purchase` \| `sale` \| `supplierReturn` \| `settings` \| `undefined`  | Optional.                                   |
| `comments`   | text                                                                                        | Optional.                                   |
| `documentId` | id                                                                                          | Optional, the sales document that moved it. |

The API stores stock movements as sent; it doesn't create them from invoices. The web app does that following settings `catalogSettings.rules`.
