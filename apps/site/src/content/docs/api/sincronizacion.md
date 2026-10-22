---
title: "Sincronización"
description: "Descargar todo una vez, seguir los cambios y escribir varios cambios a la vez."
section: api
order: 8
---

Para tener una copia local de todo y mantenerla al día, sin volver a descargarlo cada vez:

## `GET /v1/workspace`

Todo lo que guarda la empresa: `clients`, `suppliers`, `salesDocuments`, `purchaseInvoices`, `expenses`, `closedQuarters`, `filedReturns`, `tags`, `treasuryAccounts`, `paymentMethods`, `manualPayments`, `bankMovements`, `catalogFamilies`, `products`, `stockMovements` y `settings`, más un `cursor`.

## `GET /v1/sync?since=<cursor>&limit=500`

Lo que ha cambiado desde el cursor: `{ cursor, changes, hasMore }`. Cada cambio es `{ "op": "upsert", "entity": "…", "data": {…} }` con el estado actual del registro, o `{ "op": "delete", "entity": "…", "id": "…" }`. Guarda el `cursor` nuevo y vuelve a pedir mientras `hasMore` sea `true`. `limit` va de 1 a 1000.

## `POST /v1/commands`

La forma en que escribe la aplicación web: una lista de hasta 500 comandos que se aplican en orden y en una sola transacción. Si uno falla, no se guarda ninguno. Responde `{ changes }` con el estado final de lo que tocaron. Sirve para lo que no tiene ruta propia (etiquetas, formas de pago, cuentas de tesorería, productos…).

```json
{
  "commands": [
    { "type": "create", "entity": "tags", "data": { "id": "…", "name": "Cliente VIP", "color": "#2f45c9" } },
    { "type": "update", "entity": "clients", "id": "…", "changes": { "tags": ["…"] } },
    { "type": "delete", "entity": "expenses", "id": "…" }
  ]
}
```

Tipos de comando: `create`, `update`, `delete`, `issue` (emitir), `closeQuarter`, `reopenQuarter` y `saveSettings`. La forma exacta de cada uno está en el [documento OpenAPI](https://api.cuentalibre.es/v1/openapi.json). Para contactos, documentos, compras y gastos es más cómodo usar sus rutas.
