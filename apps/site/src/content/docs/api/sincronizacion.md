---
title: "Sincronización"
description: "Descargar todo una vez, seguir los cambios y escribir varios cambios a la vez."
section: api
order: 8
---

Para tener una copia local de todo y mantenerla al día, sin volver a descargarlo cada vez:

## `GET /v1/workspace`

Todo lo que guarda la empresa: `clients`, `suppliers`, `salesDocuments`, `purchaseInvoices`, `expenses`, `closedQuarters`, `filedReturns`, `tags`, `paymentMethods`, `manualPayments`, `catalogFamilies`, `products`, `stockMovements` y `settings`, más un `cursor`. `filedReturns` trae todas las versiones, de la más antigua a la más reciente, y `settings` todas las secciones, con los valores por defecto en las que nunca se han guardado.

## `GET /v1/sync?since=<cursor>&limit=500`

Lo que ha cambiado desde el cursor: `{ cursor, changes, hasMore }`. Cada cambio es `{ "op": "upsert", "entity": "…", "data": {…} }` con el estado actual del registro, o `{ "op": "delete", "entity": "…", "id": "…" }`. Para los ajustes, `entity` es `settings` y `data` es `{ section, data }`; al reabrir un trimestre, el `delete` de `closedQuarters` lleva el periodo como `id`. Guarda el `cursor` nuevo y vuelve a pedir mientras `hasMore` sea `true`. `limit` va de 1 a 1000.

## `POST /v1/commands`

La forma en que escribe la aplicación web: una lista de hasta 500 comandos que se aplican en orden y en una sola transacción. Si uno falla, no se guarda ninguno. Responde `{ changes }` con el estado final de lo que tocaron. Sirve para lo que no tiene ruta propia (etiquetas, formas de pago, productos…).

```json
{
  "commands": [
    { "type": "create", "entity": "tags", "data": { "id": "…", "name": "Cliente VIP", "color": "#2f45c9" } },
    { "type": "update", "entity": "clients", "id": "…", "changes": { "tags": ["…"] } },
    { "type": "delete", "entity": "expenses", "id": "…" }
  ]
}
```

| Comando         | Forma                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create`        | `{ type, entity, data }`. `data` es el registro completo, con su `id` (aquí es obligatorio).                                                                                                                        |
| `update`        | `{ type, entity, id, changes }`. Como un `PATCH`: solo los campos que cambian.                                                                                                                                      |
| `delete`        | `{ type, entity, id }`                                                                                                                                                                                             |
| `issue`         | `{ type, data, number? }`. Emite `data` como factura: una nueva o un borrador con el mismo `id`. `number` solo para importar facturas emitidas con otro programa: conserva ese número en vez de tomar el siguiente. |
| `correctRecord` | `{ type, id, client }`. Corrige el registro de VERI\*FACTU que la AEAT rechazó o aceptó con errores. Ver [Corregir un registro rechazado](/docs/api/ventas#corregir-un-registro-rechazado). |
| `closeQuarter`  | `{ type, period, closedOn, returns? }`. Ver [Ajustes y trimestres](/docs/api/ajustes#cerrar-y-reabrir-trimestres).                                                                                                 |
| `reopenQuarter` | `{ type, period }`                                                                                                                                                                                                 |
| `saveSettings`  | `{ type, section, data }`. Sustituye una sección entera de los [ajustes](/docs/api/ajustes).                                                                                                                       |

`entity` puede ser `clients`, `suppliers`, `salesDocuments`, `purchaseInvoices`, `expenses` y los [registros sin ruta propia](/docs/api/otros-registros): `tags`, `paymentMethods`, `manualPayments`, `catalogFamilies`, `products` y `stockMovements`. En los comandos, los contactos van como `clients` o `suppliers` y no llevan `role`. Todos los `id` son UUID.

Un número importado tiene que encajar en su serie y no existir ya (`409 number_taken`), y no crea registro de VERI\*FACTU: lo hizo el programa que la emitió.

Para contactos, documentos, compras y gastos es más cómodo usar sus rutas. La forma exacta de cada comando está en el [documento OpenAPI](https://api.cuentalibre.es/v1/openapi.json).
