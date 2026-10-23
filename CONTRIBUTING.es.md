# Contribuir a cuentalibre

[English](CONTRIBUTING.md) · **Español**

Gracias por echar una mano. Esta guía explica cómo avisar de un problema y cómo proponer un cambio.

## Cómo ayudar

- **Avisa de un error.** Abre un [issue](https://github.com/jesuspb2/cuentalibre/issues) con lo que hiciste, lo que esperabas y lo que pasó. Las capturas ayudan, pero quita antes cualquier NIF, nombre o importe real.
- **Corrige una regla fiscal.** Si un cálculo, un plazo o una casilla de un modelo está mal, di cuál y enlaza la fuente (el BOE, las instrucciones del modelo de la AEAT, la ley y el artículo). Una regla sin fuente es difícil de revisar.
- **Propón una funcionalidad.** Abre antes un issue y cuenta qué problema le resuelve a un autónomo: así no construyes algo que luego no encaja.
- **Coge un issue.** Los que tienen la etiqueta `good first issue` son buenos para empezar. Comenta en él antes de ponerte, para que no lo hagan dos personas a la vez.
- **Mejora la documentación.** La del sitio está en `apps/site/src/content/docs` (en español).

## Prepara tu entorno

Sigue [Ponerlo en marcha en local](README.es.md#ponerlo-en-marcha-en-local) en el README: Node 22, pnpm 12 y Docker para la base de datos. `pnpm dev` arranca la aplicación, la API y la web pública.

## Cómo proponer un cambio

1. Haz un fork del repositorio y crea una rama desde `main` (`fix/303-casilla-28`, `feat/facturas-recurrentes`…).
2. Haz el cambio, con tests para la lógica que añadas o corrijas.
3. Pasa las comprobaciones de abajo.
4. Abre un pull request contra `main` que explique qué cambia y por qué, y enlace el issue que cierra (`Fixes #123`).

Que cada pull request haga una sola cosa, un arreglo o una funcionalidad: los pequeños son más fáciles de revisar.

### Comprobaciones

```sh
pnpm typecheck
pnpm test        # los tests de integración de la API necesitan `docker compose up -d`
pnpm build
pnpm format      # Prettier
```

La integración continua ejecuta `typecheck`, `test` y `build`, y falla si las migraciones de la base de datos no coinciden con el esquema.

## Convenciones

### Idioma

- El código, los comentarios, la documentación técnica y los mensajes de commit van en **inglés**.
- Todo lo que lee el usuario va en **español**: la aplicación, la web pública y su documentación.

### Dónde va cada cosa

| Qué                                    | Dónde                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Reglas fiscales, de dinero y de fechas | `packages/core`, como funciones puras con tests. Nunca en componentes de React ni en rutas de la API.                                          |
| Formas de los datos                    | `packages/contracts`, como esquemas zod; los tipos se infieren de ellos. No declares tipos de entidades en ningún otro sitio.                  |
| Pantallas                              | `apps/web/src/features/<área>`.                                                                                                                |
| Lecturas y escrituras de la aplicación | A través de los stores de `apps/web/src/data`: cada cambio es un comando, se aplica al momento y se deshace si la API lo rechaza.              |
| Rutas de la API                        | `apps/api/src/routes`, definidas con `@hono/zod-openapi`. Toda escritura pasa por `applyCommands` y toda consulta filtra por `organizationId`. |
| Datos de ejemplo de la demo            | `apps/web/src/mocks`.                                                                                                                          |

### Código

- Sigue el estilo del código que lo rodea: nombres, estructura y cuánto comenta. Los comentarios explican por qué, no qué.
- El dinero va en céntimos enteros (`Cents` de `@cuentalibre/core`). Dale formato con `formatEUR()` y muestra los importes con la clase `amount`.
- Usa solo los tokens semánticos para los estilos (`bg-primary`, `text-muted-foreground`, `border-border`…). La paleta en bruto de `primitives.css` y los colores por defecto de Tailwind no se usan.
- La aplicación tiene que sentirse instantánea: pinta con lo que ya está en memoria, no añadas una petición para obtener un número que el navegador puede calcular, y mira cuánto pesa una dependencia antes de añadirla.

### Interfaz

- Revisa cada pantalla que toques en el ordenador y en el móvil, en modo claro y oscuro.
- Añade capturas de las dos al pull request.

### Base de datos

Cambia las tablas en `apps/api/src/db/schema/`, genera la migración y revisa su SQL a mano:

```sh
pnpm --filter @cuentalibre/api db:generate --name <qué_cambia>
pnpm --filter @cuentalibre/api db:migrate
```

### API

Un cambio en la API pública (una ruta, un campo, una regla o un código de error) actualiza también, en el mismo pull request:

- [`apps/api/README.md`](apps/api/README.md), si cambia cómo funciona el backend;
- la referencia de la API del sitio, `apps/site/src/content/docs/api/` (en español);
- las referencias de la skill para agentes, `.agents/skills/cuentalibre/references/` (en inglés).

### Commits

Escribe el asunto en imperativo, en inglés, y di qué cambia (`Round VAT per rate before adding the bases`); usa el cuerpo para explicar por qué. Si te has ayudado de una IA, revisa lo que ha hecho como si lo hubieras escrito tú: en la revisión respondes tú por ello.

## Seguridad

No abras un issue público para una vulnerabilidad. Avisa en privado a través de GitHub (**Security › Report a vulnerability**).

## Licencia

cuentalibre tiene licencia [AGPL-3.0](LICENSE) y, como dice la licencia, se ofrece tal cual, sin ninguna garantía. Al contribuir, aceptas que tu contribución quede bajo la misma licencia.
