---
title: "Gastos"
description: "Tickets, cuotas y otros gastos sin factura completa."
section: api
order: 6
---

Gastos sin factura completa: tickets, cuotas de autónomo, tasas… El importe va con impuestos incluidos y no deduce IVA. Su trimestre lo decide `date`.

## Rutas

| Ruta                         | Qué hace                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `GET /v1/expenses?from=&to=` | Lista los gastos, opcionalmente entre dos fechas. Responde `{ "data": [...] }`. |
| `GET /v1/expenses/{id}`      | Un gasto.                                                                       |
| `POST /v1/expenses`          | Lo registra.                                                                    |
| `PATCH /v1/expenses/{id}`    | Cambia algunos campos.                                                          |
| `DELETE /v1/expenses/{id}`   | Lo borra.                                                                       |

## Campos

| Campo                            | Tipo                                                    |                                                                       |
| -------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| `date`                           | fecha                                                   | Obligatorio. Decide el trimestre.                                     |
| `number`                         | texto                                                   | Obligatorio (puede ir vacío). Número del ticket o referencia.         |
| `concept`                        | texto                                                   | Obligatorio.                                                          |
| `amount`                         | céntimos                                                | Obligatorio. Impuestos incluidos.                                     |
| `expenseType`                    | [cuenta de gastos](/docs/api/valores#cuentas-de-gastos) | Obligatorio.                                                          |
| `imputation`                     | 0–100                                                   | Obligatorio.                                                          |
| `supplierId`                     | id \| null                                              | Obligatorio. El proveedor, si lo tienes dado de alta.                 |
| `otherPayee`                     | objeto                                                  | Si no: `{ name, taxId }` de a quién se pagó (`taxId` puede ir vacío). |
| `payment`                        | objeto \| null                                          | Obligatorio. `{ date, paymentMethodId }`, o `null` si está pendiente. |
| `rental`                         | booleano                                                | Obligatorio.                                                          |
| `rentalLocation`, `cadastralRef` |                                                         | Como en ventas.                                                       |
| `privateNotes`                   | texto                                                   | Obligatorio (puede ir vacío).                                         |
| `tags`, `attachments`            | listas                                                  |                                                                       |

## Ejemplo

```sh
curl https://api.cuentalibre.es/v1/expenses \
  -H "Authorization: Bearer fsk_…" -H "Content-Type: application/json" \
  -d '{
    "date": "2026-10-01", "number": "", "concept": "Cuota de autónomos octubre",
    "amount": 29400, "expenseType": "6422", "imputation": 100,
    "supplierId": null, "otherPayee": { "name": "Tesorería General de la Seguridad Social", "taxId": "" },
    "payment": null, "rental": false, "privateNotes": ""
  }'
```
