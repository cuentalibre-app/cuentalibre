---
title: "Cuenta, empresa y claves"
description: "Tu usuario, la empresa a la que da acceso la clave y la gestión de claves de API."
section: api
order: 2
---

## `GET /v1/organization`

La empresa a la que da acceso la clave y tu papel en ella (`owner`, `admin` o `member`).

## `GET /v1/organization/members`

Las personas de la empresa, de la más antigua a la más nueva: `userId`, `name`, `email`, `role` y `joinedAt`.

## `GET /v1/me`

Tu usuario (`id`, `name`, `email`…), las empresas a las que perteneces (`memberships`) y tus ajustes personales (`settings`).

## Claves de API

Solo con la sesión iniciada en la aplicación (una clave no puede gestionar claves):

- `GET /v1/api-keys`: tus claves en la empresa activa: `id`, `name`, `start` (los primeros caracteres), `createdAt`, `expiresAt` y `lastUsedAt`.
- `POST /v1/api-keys`: crea una; `{ "name": "Mi agente", "expiresInDays": 90 }`. `name` tiene hasta 32 caracteres; `expiresInDays`, de 1 a 365, y sin él no caduca. La clave (`key`) solo aparece en esta respuesta.
- `DELETE /v1/api-keys/{id}`: la revoca al momento.

## Otras rutas

- `GET /v1/health`: estado de la API y de la base de datos. No necesita clave.
- `GET /v1/openapi.json`: la descripción OpenAPI 3.1 de toda la API. No necesita clave.
