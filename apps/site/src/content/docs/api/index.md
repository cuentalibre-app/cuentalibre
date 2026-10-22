---
title: "Introducción a la API"
label: "Introducción"
description: "Cómo autenticarte, el formato de los datos y los errores de la API de cuentalibre."
section: api
order: 1
---

La API de cuentalibre te deja leer y escribir tu contabilidad desde scripts, hojas de cálculo, automatizaciones o agentes de IA: contactos, facturas, borradores, presupuestos, albaranes, facturas recibidas, gastos y archivos. Es la misma API que usa la aplicación web, así que lo que hagas por ella sigue las mismas reglas: la numeración correlativa, los trimestres cerrados y VERI\*FACTU.

Si vas a conectar un agente de IA, empieza por [Conectar un agente](/docs/agentes). Toda esta referencia está también en un solo archivo Markdown, [`/docs/api.md`](/docs/api.md), para dársela tal cual.

## Inicio rápido

1. En la aplicación, ve a **Configuración › API y agentes** y crea una clave. Cópiala: solo se muestra una vez. Empieza por `fsk_`.
2. Prueba que funciona:

```sh
curl https://api.cuentalibre.es/v1/organization \
  -H "Authorization: Bearer fsk_…"
```

```json
{
  "organization": { "id": "01a1587a-645d-7003-a850-b0ecd53c0113", "name": "Mi negocio", "slug": "mi-negocio" },
  "role": "owner"
}
```

3. Lista tus facturas del primer trimestre:

```sh
curl "https://api.cuentalibre.es/v1/sales-documents?from=2026-01-01&to=2026-03-31" \
  -H "Authorization: Bearer fsk_…"
```

## URL base

Todas las rutas cuelgan de `/v1`:

- **cuentalibre online:** `https://api.cuentalibre.es/v1`
- **[Instalación propia](/docs/instalar):** la URL de tu servidor seguida de `/v1` (en desarrollo, `http://localhost:3000/v1`).

## Autenticación

Envía la clave en una de estas cabeceras:

```http
Authorization: Bearer fsk_…
x-api-key: fsk_…
```

Una clave pertenece a la persona que la creó y a la empresa que tenía activa en ese momento. Deja de funcionar si la revocas, si caduca o si esa persona deja de pertenecer a la empresa. Las claves solo se crean, se listan y se revocan con la sesión iniciada en la aplicación: una clave no puede crear otras claves ni borrar la cuenta.

## Límite de peticiones

Cada clave admite **600 peticiones por minuto**. Por encima responde `429 rate_limited`; espera unos segundos y repite.

## Formato de los datos

| Qué                                         | Formato                                                                | Ejemplo                                  |
| ------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| Identificadores                             | UUID. Los registros nuevos usan UUIDv7, pero se acepta cualquier UUID. | `"01a1637e-be51-7002-9b11-4b34b7bef758"` |
| Fechas                                      | ISO 8601, sin hora                                                     | `"2026-10-22"`                           |
| Importes de pagos, gastos y totales         | **Céntimos**, enteros                                                  | `12100` (121,00 €)                       |
| Precios unitarios de las líneas             | **Euros**, con los decimales que hagan falta                           | `100.5`                                  |
| Tipos de IVA, recargo y descuentos de línea | Fracción entre 0 y 1                                                   | `0.21` (21 %)                            |
| Porcentajes de imputación                   | Entero de 0 a 100                                                      | `100`                                    |
| Cuentas contables                           | Código del PGC como texto                                              | `"705"`, `"629"`                         |

Los campos que no tienen valor no aparecen en las respuestas. Los campos desconocidos que envíes se ignoran.

## Crear, cambiar y borrar

- **Crear** (`POST`): manda el registro completo. El `id` es opcional; si lo generas tú, puedes repetir la petición sin miedo a duplicar: la segunda vez responde `409 already_exists`.
- **Cambiar** (`PATCH`): manda solo los campos que cambian. `null` vacía un campo opcional. Las listas (`lines`, `payments`, `tags`, `attachments`…) se sustituyen enteras.
- **Borrar** (`DELETE`): responde `204` sin cuerpo.

Cada escritura es atómica: o se guarda entera o no se guarda nada.

## Errores

Los errores responden con un código HTTP y este cuerpo:

```json
{ "error": { "code": "quarter_closed", "message": "Quarter 2026-T3 is closed; reopen it first." } }
```

| HTTP | `code`                                                       | Qué significa                                                                                                                                                                          |
| ---- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `invalid_request`                                            | El cuerpo no es JSON válido, o el cuerpo o los parámetros no tienen la forma esperada. `message` dice qué falla.                                                                       |
| 400  | `invalid_document`, `invalid_contact`, `invalid_attachment`… | Los datos tienen buena forma pero no son válidos: una factura sin cliente, un adjunto que no se ha subido…                                                                             |
| 401  | `unauthorized`, `invalid_api_key`                            | Falta la clave, o no es válida, ha caducado o se ha revocado.                                                                                                                          |
| 403  | `no_active_organization`, `not_a_member`                     | La clave ya no tiene acceso a la empresa.                                                                                                                                              |
| 404  | `not_found`                                                  | El registro no existe, se borró o es de otra empresa.                                                                                                                                  |
| 409  | `already_exists`                                             | Ya hay un registro con ese `id`.                                                                                                                                                       |
| 409  | `invoice_issued`, `already_issued`                           | La factura está emitida y no se puede cambiar ni borrar (ver [Editar una factura emitida](/docs/api/ventas#editar-una-factura-emitida)), o ya lo estaba y no se puede volver a emitir. |
| 409  | `date_out_of_order`                                          | La factura tiene fecha anterior a la última de su serie.                                                                                                                               |
| 409  | `series_inactive`                                            | La serie está desactivada y no admite facturas nuevas.                                                                                                                                 |
| 409  | `quarter_closed`                                             | El trimestre está cerrado. Reábrelo en la aplicación para cambiar sus registros.                                                                                                       |
| 409  | `in_use`                                                     | No se puede borrar porque otro registro lo usa (una forma de pago, un producto…).                                                                                                      |
| 413  | `file_too_large`                                             | El archivo pasa del límite (25 MB por defecto).                                                                                                                                        |
| 415  | `invalid_request`                                            | El `Content-Type` del cuerpo no es el que admite la operación (casi siempre `application/json`).                                                                                       |
| 429  | `rate_limited`                                               | Demasiadas peticiones con esta clave.                                                                                                                                                  |
| 503  | `email_unavailable`                                          | Este servidor no tiene configurado el envío de correo.                                                                                                                                 |

Un `message` en inglés acompaña siempre al código; programa contra `code`, que no cambia.

## Trimestres cerrados

Al cerrar un trimestre en la aplicación (al presentar los modelos), sus libros se congelan. Mientras siga cerrado, la API rechaza con `409 quarter_closed`:

- crear facturas, facturas recibidas o gastos con fecha de ese trimestre;
- cambiarlas, borrarlas o moverlas a otra fecha.

Lo único que admiten son cambios en los pagos, las etiquetas, los adjuntos y las notas privadas.

## Lo que todavía no hace

- Calcular los modelos 303 y 130 en el servidor: hoy los calcula la aplicación web.
- Generar el PDF de una factura.
- Un servidor MCP. Mientras tanto, los agentes pueden usar la API directamente o importar el documento OpenAPI.

¿Echas algo en falta o has encontrado un error? [Cuéntanoslo en GitHub](https://github.com/jesuspb2/cuentalibre/issues).
