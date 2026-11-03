---
title: "Ventas"
description: "Facturas, borradores, presupuestos y albaranes: crearlos, emitirlos, editarlos y rectificarlos."
section: api
order: 4
---

Las facturas, los borradores, los presupuestos y los albaranes son **documentos de venta**, y se distinguen por `kind`: `invoice`, `draft`, `quote` o `deliveryNote`.

Los borradores, los presupuestos y los albaranes se crean y se cambian libremente. Las facturas solo nacen al **emitirlas**: el servidor les da el siguiente número de su serie y guarda los datos del cliente y los totales. Que después se puedan editar o borrar depende del trimestre: lo explica [Editar una factura emitida](#editar-una-factura-emitida).

## Rutas

| Ruta                                  | Qué hace                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /v1/sales-documents?from=&to=`   | Lista los documentos, opcionalmente entre dos fechas de emisión (incluidas). Responde `{ "data": [...] }`. |
| `GET /v1/sales-documents/{id}`        | Un documento.                                                                                              |
| `POST /v1/sales-documents`            | Crea un borrador, presupuesto o albarán.                                                                   |
| `PATCH /v1/sales-documents/{id}`      | Cambia algunos campos.                                                                                     |
| `DELETE /v1/sales-documents/{id}`     | Lo borra. Una factura emitida, solo [si se puede editar](#editar-una-factura-emitida).                     |
| `POST /v1/invoices`                   | Emite una factura nueva.                                                                                   |
| `POST /v1/sales-documents/{id}/issue` | Emite un borrador tal como está.                                                                           |

## Campos

| Campo                            | Tipo                                                        |                                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                           | `invoice` \| `draft` \| `quote` \| `deliveryNote`           | Obligatorio.                                                                                                                                         |
| `number`                         | texto \| null                                               | Lo pone el servidor. Envía `null` al crear.                                                                                                          |
| `series`                         | `normal` \| `rectifying`                                    | Obligatorio. `rectifying` para facturas rectificativas.                                                                                              |
| `seriesId`                       | id                                                          | Serie personalizada ([ajustes de facturas](/docs/api/ajustes#series-de-facturas)), del mismo tipo que `series`. Sin ella, la serie por defecto de `series`. |
| `clientId`                       | id \| `""`                                                  | El cliente. Vacío solo en borradores y presupuestos.                                                                                                 |
| `issuedOn`                       | fecha                                                       | Obligatorio. Fecha de emisión; decide el trimestre.                                                                                                  |
| `dueOn`                          | fecha \| null                                               | Obligatorio. Vencimiento; en presupuestos, la validez.                                                                                               |
| `operationOn`                    | fecha \| null                                               | Obligatorio. Fecha de la operación, si no es la de emisión.                                                                                          |
| `incomeType`                     | [cuenta de ingresos](/docs/api/valores#cuentas-de-ingresos) | Obligatorio. Normalmente `705` (servicios) o `700` (mercaderías).                                                                                    |
| `withholding`                    | [retención](/docs/api/valores#retenciones-de-irpf)          | Obligatorio. `none` si no lleva.                                                                                                                     |
| `operationType`                  | [tipo de operación](/docs/api/valores#tipos-de-operación)   | Obligatorio.                                                                                                                                         |
| `cashBasis`                      | booleano                                                    | Obligatorio. Criterio de caja.                                                                                                                       |
| `rental`                         | booleano                                                    | Obligatorio. Arrendamiento de inmueble (modelos 115/180).                                                                                            |
| `rentalLocation`, `cadastralRef` |                                                             | Situación y referencia catastral del inmueble arrendado. `rentalLocation`: `spain`, `basqueCountry`, `navarre`, `noCadastralRef` o `abroad`.         |
| `rectifiesId`                    | id                                                          | En una rectificativa, la factura que corrige.                                                                                                        |
| `lines`                          | lista de [líneas](/docs/api/ventas#líneas)                  | Obligatorio.                                                                                                                                         |
| `supplies`                       | céntimos                                                    | Suplidos: gastos pagados en nombre del cliente, fuera de la base imponible.                                                                          |
| `payments`                       | lista de [pagos](/docs/api/ventas#pagos)                    | Cobros, del más antiguo al más reciente. Solo las facturas tienen cobros.                                                                            |
| `status`                         | texto                                                       | Obligatorio. Facturas y borradores: `pending` o `paid`. Presupuestos y albaranes: `created`, `sent`, `accepted`, `rejected` o `invoiced`.            |
| `publicNotes`                    | texto                                                       | Obligatorio (puede ir vacío). Se imprime en el documento.                                                                                            |
| `privateNotes`                   | texto                                                       | Obligatorio (puede ir vacío). Solo se ve en cuentalibre.                                                                                             |
| `language`, `numberFormat`       | texto                                                       | Idioma y formato del documento; vacíos, los del cliente.                                                                                             |
| `tags`, `attachments`            | listas                                                      | Etiquetas y [archivos](/docs/api/archivos).                                                                                                          |
| `issued`                         | objeto                                                      | Solo lectura, en facturas emitidas: `client` (los datos fiscales congelados) y `totals`. |

Los totales de una factura emitida (`issued.totals`) van en céntimos: `base`, `vat`, `surcharge`, `withholding`, `supplies`, `total` y `vatBreakdown` (base y cuota por tipo de IVA). El total es base + IVA + recargo − retención + suplidos.

El estado de una factura sigue a sus cobros: es `paid` cuando los `payments` cubren el total y `pending` mientras no. Para marcarla como cobrada, añade el cobro.

## Líneas

| Campo                      | Tipo     |                                                               |
| -------------------------- | -------- | ------------------------------------------------------------- |
| `id`                       | texto    | Obligatorio. Único dentro del documento (`"1"`, `"2"`… vale). |
| `concept`                  | texto    | Obligatorio.                                                  |
| `detail`                   | texto    | Descripción más larga, bajo el concepto.                      |
| `unitPrice`                | número   | Obligatorio. **En euros**, sin IVA.                           |
| `quantity`                 | número   | Obligatorio. Negativa en las rectificativas que restan.       |
| `discount`                 | fracción | Obligatorio. `0` sin descuento; `0.1` es un 10 %.             |
| `vatRate`                  | fracción | Obligatorio. `0.21`, `0.1`, `0.04`, `0`…                      |
| `surchargeRate`            | fracción | Recargo de equivalencia, si aplica (`0.052` con el 21 %).     |
| `serviceFrom`, `serviceTo` | fecha    | Periodo del servicio.                                         |
| `productId`, `unit`        |          | Producto del catálogo y su unidad de medida.                  |

## Pagos

Los cobros de una factura y los pagos de una factura recibida: `{ id, date, amount, paymentMethodId }`, con `amount` **en céntimos** (negativo en las devoluciones) y `paymentMethodId` el id de una de tus formas de pago (las tienes en `GET /v1/workspace`, en `paymentMethods`).

## Emitir una factura

`POST /v1/invoices` recibe el documento sin `number` ni `issued` (`kind` se fuerza a `invoice`) y responde `201` con la factura emitida, ya numerada y con sus totales. Si envías el `id` de un borrador, lo emite con los datos que mandas.

```sh
curl https://api.cuentalibre.es/v1/invoices \
  -H "Authorization: Bearer fsk_…" -H "Content-Type: application/json" \
  -d '{
    "kind": "invoice", "number": null, "series": "normal",
    "clientId": "01a15886-012f-7004-bd02-521c3db4d6ba",
    "issuedOn": "2026-10-22", "dueOn": "2026-11-21", "operationOn": null,
    "incomeType": "705", "withholding": "professional", "operationType": "national",
    "cashBasis": false, "rental": false, "status": "pending",
    "publicNotes": "", "privateNotes": "",
    "lines": [
      { "id": "1", "concept": "Diseño web", "unitPrice": 1200, "quantity": 1, "discount": 0, "vatRate": 0.21 }
    ]
  }'
```

```json
{
  "id": "01a16380-02d9-7004-b863-1d9d14877193",
  "kind": "invoice",
  "number": "2026-0007",
  "status": "pending",
  "issued": {
    "client": { "name": "Estudio Nube SL", "taxId": "B12345678" },
    "totals": {
      "base": 120000,
      "vat": 25200,
      "surcharge": 0,
      "withholding": 18000,
      "supplies": 0,
      "total": 127200,
      "vatBreakdown": [{ "rate": 0.21, "base": 120000, "vat": 25200 }]
    }
  }
}
```

Se rechaza (`400` o `409`) una factura:

- sin cliente o sin líneas;
- con fecha anterior a la última factura de su serie, porque la numeración tiene que ser correlativa;
- en un trimestre cerrado;
- rectificativa que no indique en `rectifiesId` una factura emitida de la serie normal, o normal que lo indique;
- en una serie desactivada (`409 series_inactive`) o que no es de su tipo;
- si al negocio le falta el NIF, el nombre fiscal o la dirección (`400 issuer_missing`): la razón social de una sociedad, o el nombre y el primer apellido de un autónomo, y la dirección, el código postal y la población.

Para importar una factura emitida con otro programa conservando su número, usa el comando [`issue` con `number`](/docs/api/sincronizacion#post-v1commands).

Si es un agente quien emite, haz que te enseñe antes el borrador.

## Editar una factura emitida

Una factura emitida se puede editar con `PATCH` y borrar con `DELETE` mientras su **trimestre esté abierto**.

Al editarla se recalculan sus totales y, si cambias el cliente, sus datos fiscales. Lo que no cambia nunca es su sitio en la numeración: `kind`, `number`, `series`, `seriesId` y `rectifiesId` (`400`). La fecha puede moverse, pero sin salir del año (que forma parte del número), sin entrar en un trimestre cerrado y sin quedar desordenada respecto a las otras facturas de la serie (`409 date_out_of_order`). Al borrar una factura, su número queda libre para la siguiente.

Con el trimestre cerrado responde `409 quarter_closed`, y la factura solo admite cambios en `status`, `payments`, `tags`, `attachments` y `privateNotes`. Para corregir otra cosa hay que emitir una rectificativa.

## Rectificar una factura

Emite otra factura con `"series": "rectifying"`, `rectifiesId` con el id de la original y las líneas que corrigen (con cantidades negativas para restar). Se numera en la serie rectificativa (`R-2026-0001`). Las devoluciones se apuntan como cobros negativos.

Una factura puede tener varias rectificativas por diferencias (una devolución parcial, un descuento posterior…), pero entre todas no pueden dejarla por debajo de cero en ningún tipo de IVA, ni en base ni en cuota (`409 rectified_past_zero`): como mucho se rectifica lo que queda, la original más sus rectificativas anteriores. Las rectificativas siempre indican la original, nunca otra rectificativa; para deshacer una, emite otra rectificativa de la original con sus líneas en sentido contrario.
