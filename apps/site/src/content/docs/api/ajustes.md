---
title: "Ajustes y trimestres"
description: "Los ajustes de la empresa, las series de facturas y cómo cerrar y reabrir trimestres."
section: api
order: 10
---

## Ajustes de la empresa

Se leen en [`GET /v1/workspace`](/docs/api/sincronizacion#get-v1workspace), en `settings` (las secciones que nunca se han guardado vienen con sus valores por defecto), y se guardan con el comando `saveSettings`, que **sustituye la sección entera**: léela, cambia lo que necesites y envíala completa.

```json
{ "commands": [{ "type": "saveSettings", "section": "taxSetup", "data": { "…": "…" } }] }
```

Si la sección no tiene la forma correcta, responde `400 invalid_settings`.

| Sección                | Contenido                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `businessProfile`      | Datos del negocio: `kind` (`selfEmployed` o `company`), `taxId`, `firstName`, `lastName`, `secondLastName` (autónomos), `legalName` (sociedades), `tradeName` (el nombre que sale en las facturas), `address`, `postalCode`, `city`, `province`, `country`, `email`, `phone` y `website`.                                          |
| `taxSetup`             | `region` (`peninsula`, `canarias`, `ceutaMelilla`, `navarra`, `alava`, `vizcaya`, `guipuzcoa`), `incomeTaxMethod` (`simplified`, `normal`, `modules`), `vatRegime` (`general`, `cashBasis`, `simplified`, `surcharge`), `activities` (`[{ id, type, code, name }]`, la principal primero), `defaultVatRate`, `defaultWithholding`, `socialSecurityFee` (cuota mensual de autónomos, en céntimos) y `variousClientsId` (el cliente «Clientes varios», o `null`). |
| `defaultPaymentMethod` | El id de la forma de pago que se propone en los documentos nuevos, o `""`.                                                                                                                                                                                                                                                      |
| `invoiceSettings`      | Aspecto de las facturas (`template`, `font`, `textColor`, `lineColor`, `backgroundColor`, `language`, `numberFormat`), qué se muestra (`showProductUnits`, `hideZeroTaxes`, `showServicePeriod`, `showOperationDate`), `footer`, `logo` (PNG en data URL), `allowImport`, `uploadToDropbox`, `uploadToDrive`, `noteTemplates` (`[{ id, title, text }]`), `series` y `defaultSeries`. |
| `documentSettings`     | `{ draft, quote, deliveryNote }`, cada uno con su aspecto, `showProductUnits`, `showServicePeriod`, `showPrices`, `showTaxes`, `hideZeroTaxes`, `footer`, `keepLinesOnInvoice`, `uploadToDropbox` y `uploadToDrive`.                                                                                                            |
| `catalogSettings`      | `customFieldNames` (4 textos), `conceptText` (`name` o `codeAndName`), `copyDescription`, `alarmEmail`, `rules` (cuándo mueven stock las facturas, los albaranes, los presupuestos y los borradores), `restoreOnDeleteInvoice`, `restoreOnDeleteDeliveryNote` y `defaults` (opciones de stock de los productos nuevos).        |
| `contactSettings`      | `customFieldNames` (los nombres de `custom1` y `custom2`) y `autocomplete`.                                                                                                                                                                                                                                                     |
| `emailTemplates` | `templates` (plantillas de correo: `id`, `name`, `kind` del documento, `subject` y `body`, con datos como `{{numero}}`, `{{fecha}}`, `{{vencimiento}}`, `{{total}}`, `{{cliente}}` y `{{negocio}}`) y `defaults` (la plantilla por defecto de cada `kind`). La aplicación web las usa para escribir el correo; `POST /v1/emails` recibe el asunto y el mensaje ya escritos. |
| `ledgerAccounts`       | Cuentas contables para exportar: `companyCode`, `digits` (de 6 a 12), `prefixes` y `defaults` por cuenta, y códigos propios por contacto (`contactCodes`) y por forma de pago (`methodCodes`).                                                                                                                                  |
| `verifactu`            | `system` (`verifactu` o `exempt`), `startDate`, `authorizationNumber`, `exemptionResolution` y `validatedByAeat`.                                                                                                                                                                                                               |

Plantillas (`template`): `classic`, `classicTraditional`, `modern`, `modernTraditional`, `elegant`, `elegantTraditional` y `avantGarde`. Fuentes (`font`): `Arial`, `Comic Sans`, `Courier New`, `Georgia`, `Impact`, `Lucida Console`, `Tahoma`, `Times New Roman`, `Trebuchet MS` y `Verdana`.

Tus ajustes personales no están aquí: van con tu usuario, en [`PUT /v1/me/settings/{section}`](/docs/api/cuenta#put-v1mesettingssection).

### Series de facturas

Toda empresa tiene dos series fijas: `normal` (`AAAA-####`) y `rectifying` (`R-AAAA-####`). `invoiceSettings.series` guarda las que crees y las fijas que hayas cambiado: `[{ id, type, name, mask, active }]`. En la máscara, `AAAA` (o `AA`) es el año y una tira de `#` el contador, con tantas cifras como `#`: `AAAA-B-####` da `2026-B-0001`.

- Las series fijas conservan su `id` y su `type`, y no se pueden quitar.
- Dos series no pueden numerar con el mismo formato.
- Una serie con `active: false` no admite facturas nuevas.
- Una serie que ya numera facturas o borradores se puede renombrar o desactivar, pero no quitar ni cambiarle el tipo o la máscara (`409 series_in_use`).
- `defaultSeries` (`{ normal, rectifying }`) elige la serie de las facturas nuevas de cada tipo; tiene que ser una serie activa de ese tipo.

Los documentos eligen una serie propia con `seriesId`.

## Cerrar y reabrir trimestres

Al cerrar un trimestre se congelan sus libros (ver [Trimestres cerrados](/docs/api#trimestres-cerrados)). Normalmente se cierra desde la aplicación al presentar los modelos 303 y 130, que calcula la aplicación web.

```json
{
  "commands": [
    {
      "type": "closeQuarter",
      "period": "2026-T3",
      "closedOn": "2026-10-20",
      "returns": [
        {
          "id": "01a16d40-…",
          "form": "303",
          "period": "2026-T3",
          "boxes": { "27": 25200, "45": 2100, "71": 23100 },
          "result": 23100,
          "filedOn": "2026-10-20"
        }
      ]
    }
  ]
}
```

- `period` es el trimestre, `AAAA-T1` a `AAAA-T4`. Cerrar uno ya cerrado cambia su fecha.
- `returns` son los modelos tal como se presentaron (opcional, hasta 10): `form` (`303` o `130`, uno de cada como mucho), `period` (el mismo trimestre), `boxes` (número de casilla y su valor, en céntimos, o porcentaje en las casillas de tipo), `result` (en céntimos, positivo a pagar, negativo a compensar o devolver) y `filedOn`. Los siguientes modelos parten de ellos. No se cambian nunca: si reabres y vuelves a cerrar, se guarda una versión nueva y cuenta la última.
- `{ "type": "reopenQuarter", "period": "2026-T3" }` lo reabre. Si no estaba cerrado, responde `404`.

Los trimestres cerrados (`closedQuarters`, `{ period, closedOn }`) y los modelos presentados (`filedReturns`) están en `GET /v1/workspace`.
