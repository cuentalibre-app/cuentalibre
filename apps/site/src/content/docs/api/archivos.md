---
title: "Archivos y correo"
description: "Subir justificantes, adjuntarlos a los registros y enviar correos."
section: api
order: 7
---

## Archivos

Los justificantes (PDF de facturas recibidas, tickets…) se suben primero y luego se enlazan en el campo `attachments` de un registro.

### `POST /v1/files`

Sube un archivo como `multipart/form-data`, con el campo `file` y, opcionalmente, `id` (un UUID). Responde `201` con `{ id, name, size, contentType }`. Máximo 25 MB por defecto. Los archivos no cambian una vez subidos.

```sh
curl https://api.cuentalibre.es/v1/files \
  -H "Authorization: Bearer fsk_…" \
  -F "file=@factura-proveedor.pdf"
```

Después, enlázalo en el registro:

```sh
curl -X PATCH https://api.cuentalibre.es/v1/purchase-invoices/01a16380-… \
  -H "Authorization: Bearer fsk_…" -H "Content-Type: application/json" \
  -d '{ "attachments": [{ "id": "<id del archivo>", "name": "factura-proveedor.pdf", "size": 48213 }] }'
```

Un adjunto con el id de un archivo que no se ha subido se rechaza con `400 invalid_attachment`.

### `GET /v1/files/{id}`

Descarga el archivo. Los PDF y las imágenes se sirven con su tipo; el resto, como descarga.

## Correo

### `POST /v1/emails`

Envía un documento de venta, por ejemplo una factura a su cliente. Sale con el nombre de tu negocio y las respuestas llegan a tu correo. Se encola y se envía en segundo plano: responde `202` con el mensaje y su `status` (`queued`, `sent` o `failed`).

Solo envía quien tiene su email verificado; si no, responde `403 email_unverified`, también con una clave de API. Cada empresa puede llegar a 50 destinatarios al día y 500 cada 30 días, contando `to` y `cc`; por encima responde `429 email_quota_exceeded`.

| Campo         | Tipo             |                                                          |
| ------------- | ---------------- | -------------------------------------------------------- |
| `to`          | lista de correos | Obligatorio. De 1 a 10.                                  |
| `cc`          | lista de correos | Hasta 10.                                                |
| `subject`     | texto            | Obligatorio. Hasta 200 caracteres.                       |
| `body`        | texto            | Obligatorio. Texto plano, hasta 20 000 caracteres.       |
| `attachments` | lista de ids     | Archivos subidos con `POST /v1/files`; hasta 10.         |
| `documentId`  | id               | Obligatorio. El documento de venta que envía.            |

El PDF de la factura lo genera la aplicación web; por la API, sube tú el PDF y adjúntalo.

### `GET /v1/emails?documentId=`

Los correos enviados, del más reciente al más antiguo; con `documentId`, solo los de ese documento.
