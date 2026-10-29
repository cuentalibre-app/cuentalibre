---
title: "Etiquetas, formas de pago y catálogo"
label: "Otros registros"
description: "Etiquetas, formas de pago, cobros y pagos sueltos, familias, productos y stock."
section: api
order: 9
---

Estos registros no tienen efectos fiscales ni trimestre, y tampoco ruta propia: se leen en [`GET /v1/workspace`](/docs/api/sincronizacion#get-v1workspace) (o en el feed de cambios) y se escriben con [`POST /v1/commands`](/docs/api/sincronizacion#post-v1commands), con `create`, `update` y `delete`. El `id` lo generas tú (un UUID).

La API comprueba su forma y que los registros que nombran sean de tu empresa y no estén borrados; si no, responde `400 invalid_<tipo>` (`invalid_payment_method`, `invalid_product`…). No deja borrar uno que otro registro sigue usando (`409 in_use`).

```json
{
  "commands": [
    {
      "type": "create",
      "entity": "paymentMethods",
      "data": {
        "id": "01a16d2e-…",
        "type": "transfer",
        "name": "Transferencia BBVA",
        "number": "ES21…",
        "active": true
      }
    }
  ]
}
```

## Etiquetas

`tags`: `{ id, name, color }`, con `color` en `#rrggbb`. Cualquier registro las nombra por id en su campo `tags`.

## Formas de pago

`paymentMethods`. Su `id` es el `paymentMethodId` de los cobros, los pagos, los gastos y los contactos.

| Campo    | Tipo                                                                        |                                                                   |
| -------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `type`   | `cash` \| `card` \| `transfer` \| `directDebit` \| `promissory` \| `paypal` | Efectivo, tarjeta, transferencia, domiciliación, pagaré o PayPal. |
| `name`   | texto                                                                       | Obligatorio.                                                      |
| `number` | texto                                                                       | IBAN, número de tarjeta o correo de PayPal; pueden ser solo las cuatro últimas cifras. |
| `active` | booleano                                                                    |                                                                   |

No se puede borrar mientras la use un cobro o pago suelto. La que se propone en los documentos nuevos es el ajuste [`defaultPaymentMethod`](/docs/api/ajustes).

## Cobros y pagos sueltos

`manualPayments`: dinero que entra o sale sin factura ni gasto (un préstamo, un traspaso a ahorro, un ajuste). `{ id, date, amount, paymentMethodId, description }`, con `amount` en céntimos, positivo si entra.

## Familias del catálogo

`catalogFamilies`: `{ id, name, parentId }`, con `parentId` otra familia o `null`. No se admiten ciclos.

## Productos

`products`. Todos los campos son obligatorios (usa `""`, `[]` o `null` cuando no haya valor).

| Campo                                  | Tipo             |                                                                                      |
| -------------------------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `familyId`                             | id \| null       |                                                                                      |
| `name`                                 | texto            |                                                                                      |
| `description`                          | texto            | Se imprime en los documentos si los ajustes lo piden.                                |
| `privateNotes`                         | texto            |                                                                                      |
| `unit`                                 | [unidad](/docs/api/valores#unidades) \| null |                                                                          |
| `tags`                                 | lista de ids     |                                                                                      |
| `active`                               | booleano         | Los inactivos no se pueden elegir en los documentos.                                 |
| `sku`                                  | texto            | Código propio, único en el catálogo.                                                 |
| `supplierRef`                          | texto            | Referencia del proveedor.                                                            |
| `price`                                | número           | Precio unitario de venta **en euros**, sin descuento ni impuestos.                   |
| `discount`, `vatRate`, `surchargeRate` | fracción         |                                                                                      |
| `cost`                                 | número \| null   | Coste unitario en euros, sin impuestos; `null` si no se sabe.                        |
| `costVatRate`, `costSurchargeRate`     | fracción         |                                                                                      |
| `custom`                               | 4 textos         | Campos libres, con los nombres de los ajustes del catálogo.                          |
| `stock`                                | objeto \| null   | `null` si no se controla; si no, `{ allowWithoutStock, alarm }`, con `alarm` `null` o `{ minUnits, dashboard, notification, email }`. |

## Movimientos de stock

`stockMovements`:

| Campo        | Tipo                 |                                                                                                   |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------- |
| `productId`  | id                   | Puede ser un producto borrado.                                                                    |
| `quantity`   | número               | Con signo.                                                                                        |
| `at`         | fecha y hora local   | `"2026-10-17T19:29"`                                                                              |
| `kind`       | texto                | `invoice`, `deliveryNote`, `initial`, `import`, `settings`, `deleted` o `manual`.                 |
| `reason`     | texto                | Opcional: `loss`, `found`, `purchase`, `sale`, `supplierReturn`, `settings` o `undefined`.        |
| `comments`   | texto                | Opcional.                                                                                         |
| `documentId` | id                   | Opcional: el documento de venta que lo movió.                                                     |

La API guarda los movimientos tal como llegan: emitir una factura por la API no descuenta stock. Eso lo hace la aplicación web, según los ajustes del catálogo.
