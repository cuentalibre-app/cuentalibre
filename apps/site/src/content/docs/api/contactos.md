---
title: "Contactos"
description: "Clientes y proveedores: listar, crear, cambiar y borrar."
section: api
order: 3
---

Clientes y proveedores. Cada contacto tiene un `role`, `client` o `supplier`, que no se puede cambiar después.

## Rutas

| Ruta                           | Qué hace                                                                   |
| ------------------------------ | -------------------------------------------------------------------------- |
| `GET /v1/contacts?role=client` | Lista los contactos. `role` y `taxId` son opcionales. Responde `{ "contacts": [...] }`. |
| `GET /v1/contacts/{id}`        | Un contacto.                                                               |
| `POST /v1/contacts`            | Crea un contacto.                                                          |
| `PATCH /v1/contacts/{id}`      | Cambia algunos campos.                                                     |
| `DELETE /v1/contacts/{id}`     | Lo borra. Las facturas ya emitidas conservan sus datos. Un proveedor con facturas recibidas o gastos no se puede borrar (`409 in_use`). |

## NIF

Todo contacto necesita un NIF válido para su país. En España se comprueba la letra o el dígito de control de NIF, NIE y CIF, con o sin el prefijo `ES`; en otros países, que sean solo letras y números. Si no es válido, responde `400 invalid_tax_id`. Se guarda sin espacios, puntos ni guiones (`b-12.345.674` queda `B12345674`).

La única excepción es el cliente «Clientes varios» (`variousClients: true`), que agrupa las ventas a clientes sin identificar: puede ir sin NIF.

## NIF repetidos

Se pueden crear varios contactos con el mismo NIF: una empresa con varias direcciones de facturación o un organismo público con varias unidades DIR3. Casi siempre es un descuido, así que antes de crear un contacto puedes buscarlo por NIF con `GET /v1/contacts?taxId=B12345674`. La búsqueda ignora mayúsculas, espacios, puntos, guiones y el prefijo `ES`.

## Campos

| Campo                                        | Tipo                                               |                                                                                                  |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `role`                                       | `client` \| `supplier`                             | Obligatorio.                                                                                     |
| `name`                                       | texto                                              | Obligatorio. Nombre o razón social.                                                              |
| `taxId`                                      | texto                                              | Obligatorio. NIF, o NIF-IVA para contactos de la UE. Ver [NIF](#nif).                            |
| `variousClients`                             | booleano                                           | Solo clientes: es «Clientes varios» y puede ir sin NIF.                                          |
| `address`, `postalCode`, `city`, `province`  | texto                                              | Dirección. `city` es la población.                                                               |
| `country`                                    | texto                                              | Nombre del país en español (`"Francia"`). Sin él, España.                                        |
| `email`, `phone`, `mobile`, `fax`, `website` | texto                                              |                                                                                                  |
| `vies`                                       | booleano                                           | Está dado de alta en el VIES, para operaciones intracomunitarias.                                |
| `discount`                                   | número 0–100                                       | Descuento por defecto en sus documentos, en porcentaje.                                          |
| `withholding`                                | [retención](/docs/api/valores#retenciones-de-irpf) | Retención de IRPF por defecto en sus documentos.                                                 |
| `paymentMethodId`                            | id                                                 | Forma de pago por defecto.                                                                       |
| `language`, `numberFormat`                   | texto                                              | Solo clientes: idioma y formato de sus documentos.                                               |
| `bankAccounts`                               | lista                                              | `{ id, iban, bic?, notes?, isDefault }`. El IBAN, sin espacios.                                  |
| `eInvoice`                                   | objeto                                             | Códigos DIR3 para FACe: `accountingOffice`, `managementBody`, `processingUnit`, `proposingBody`. |
| `custom1`, `custom2`, `notes`                | texto                                              |                                                                                                  |
| `tags`                                       | lista de ids                                       | Etiquetas.                                                                                       |
| `attachments`                                | lista                                              | [Archivos adjuntos](/docs/api/archivos).                                                         |

## Ejemplo

```sh
curl https://api.cuentalibre.es/v1/contacts \
  -H "Authorization: Bearer fsk_…" -H "Content-Type: application/json" \
  -d '{ "role": "client", "name": "Estudio Nube SL", "taxId": "B12345674",
        "email": "admin@estudionube.es", "city": "Valencia", "withholding": "professional" }'
```
