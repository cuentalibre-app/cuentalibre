---
title: "Compras"
description: "Las facturas que recibes de tus proveedores."
section: api
order: 5
---

Las facturas que te envían tus proveedores. Su trimestre lo decide `bookedOn`, la fecha de contabilización.

## Rutas

| Ruta                                  | Qué hace                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /v1/purchase-invoices?from=&to=` | Lista las facturas recibidas, opcionalmente entre dos fechas de `bookedOn`. Responde `{ "data": [...] }`. |
| `GET /v1/purchase-invoices/{id}`      | Una factura recibida.                                                                                     |
| `POST /v1/purchase-invoices`          | La registra.                                                                                              |
| `PATCH /v1/purchase-invoices/{id}`    | Cambia algunos campos.                                                                                    |
| `DELETE /v1/purchase-invoices/{id}`   | La borra.                                                                                                 |

## Campos

| Campo                            | Tipo                                                      |                                                                                                                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supplierId`                     | id                                                        | Obligatorio. Un contacto con `role: "supplier"`.                                                                                                                                                                                                    |
| `number`                         | texto                                                     | Obligatorio. El número que puso el proveedor.                                                                                                                                                                                                       |
| `issuedOn`                       | fecha                                                     | Obligatorio. Fecha de la factura.                                                                                                                                                                                                                   |
| `bookedOn`                       | fecha                                                     | Obligatorio. Fecha de contabilización; decide el trimestre.                                                                                                                                                                                         |
| `dueOn`, `operationOn`           | fecha \| null                                             | Obligatorios.                                                                                                                                                                                                                                       |
| `expenseType`                    | [cuenta de gastos](/docs/api/valores#cuentas-de-gastos)   | Obligatorio.                                                                                                                                                                                                                                        |
| `imputation`                     | 0–100                                                     | Obligatorio. Porcentaje que cuenta como gasto deducible.                                                                                                                                                                                            |
| `vatImputation`                  | 0–100 \| null                                             | Obligatorio. Porcentaje del IVA deducible; `null`, el mismo que `imputation`.                                                                                                                                                                       |
| `withholding`                    | [retención](/docs/api/valores#retenciones-de-irpf)        | Obligatorio.                                                                                                                                                                                                                                        |
| `operationType`                  | [tipo de operación](/docs/api/valores#tipos-de-operación) | Obligatorio. Admite `import` en lugar de `export`.                                                                                                                                                                                                  |
| `customsDocument`                | texto                                                     | DUA o H7 de una importación.                                                                                                                                                                                                                        |
| `cashBasis`, `rental`            | booleanos                                                 | Obligatorios. El proveedor aplica criterio de caja; es un alquiler.                                                                                                                                                                                 |
| `rentalLocation`, `cadastralRef` |                                                           | Como en ventas.                                                                                                                                                                                                                                     |
| `rectifiesId`                    | id                                                        | En un abono, la factura recibida que corrige.                                                                                                                                                                                                       |
| `lines`                          | lista de [líneas](/docs/api/ventas#líneas)                | Obligatorio.                                                                                                                                                                                                                                        |
| `payments`                       | lista de [pagos](/docs/api/ventas#pagos)                  | Obligatorio (puede ir vacía).                                                                                                                                                                                                                       |
| `privateNotes`                   | texto                                                     | Obligatorio (puede ir vacío).                                                                                                                                                                                                                       |
| `asset`                          | objeto                                                    | Si es un bien de inversión que se amortiza: `category`, `condition` (`new`, `used`, `accelerated`, `lowValue`, `free`), `method` (`rate` o `years`), `value` (porcentaje anual o número de años) e `identifier` (matrícula o referencia catastral). |
| `tags`, `attachments`            | listas                                                    |                                                                                                                                                                                                                                                     |

## Ejemplo

```sh
curl https://api.cuentalibre.es/v1/purchase-invoices \
  -H "Authorization: Bearer fsk_…" -H "Content-Type: application/json" \
  -d '{
    "supplierId": "01a1592b-6336-7001-9663-adb186b74d91", "number": "F-2026-118",
    "issuedOn": "2026-10-20", "bookedOn": "2026-10-20", "dueOn": null, "operationOn": null,
    "expenseType": "6291", "imputation": 100, "vatImputation": null,
    "withholding": "none", "operationType": "national", "cashBasis": false, "rental": false,
    "lines": [{ "id": "1", "concept": "Fibra y móvil", "unitPrice": 45, "quantity": 1, "discount": 0, "vatRate": 0.21 }],
    "payments": [], "privateNotes": ""
  }'
```
