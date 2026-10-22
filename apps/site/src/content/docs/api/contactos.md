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
| `GET /v1/contacts?role=client` | Lista los contactos. `role` es opcional. Responde `{ "contacts": [...] }`. |
| `GET /v1/contacts/{id}`        | Un contacto.                                                               |
| `POST /v1/contacts`            | Crea un contacto.                                                          |
| `PATCH /v1/contacts/{id}`      | Cambia algunos campos.                                                     |
| `DELETE /v1/contacts/{id}`     | Lo borra. Las facturas ya emitidas conservan sus datos.                    |

## Campos

| Campo                                        | Tipo                                               |                                                                                                  |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `role`                                       | `client` \| `supplier`                             | Obligatorio.                                                                                     |
| `name`                                       | texto                                              | Obligatorio. Nombre o razón social.                                                              |
| `taxId`                                      | texto                                              | Obligatorio (puede ir vacío). NIF, o NIF-IVA para contactos de la UE.                            |
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
  -d '{ "role": "client", "name": "Estudio Nube SL", "taxId": "B12345678",
        "email": "admin@estudionube.es", "city": "Valencia", "withholding": "professional" }'
```
