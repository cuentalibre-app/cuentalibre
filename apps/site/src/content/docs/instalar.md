---
title: "Instalar en tu servidor"
label: "Instalar en tu servidor"
description: "Cómo poner en marcha cuentalibre gratis en un servidor tuyo, con Docker: la API, la base de datos y la aplicación web."
section: start
order: 2
---

cuentalibre es software libre (AGPL-3.0): puedes instalarlo en un servidor tuyo y usarlo gratis, sin límites. A cambio, la instalación, las copias de seguridad y las actualizaciones corren de tu cuenta. Si prefieres no ocuparte de nada de eso, usa [cuentalibre online](/docs#dos-formas-de-usar-cuentalibre).

Esta guía es para quien sabe manejar un servidor Linux por SSH. El código y su documentación técnica están en el [repositorio de GitHub](https://github.com/jesuspb2/cuentalibre); los enlaces de cada paso llevan al archivo exacto.

## Qué vas a instalar

| Pieza             | Qué es                                                                                                                 | En el repositorio                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| La API            | El servidor: guarda los datos, calcula, emite las facturas y envía VERI\*FACTU. Una imagen de Docker.                  | [`apps/api`](https://github.com/jesuspb2/cuentalibre/tree/main/apps/api) |
| PostgreSQL        | La base de datos.                                                                                                      | —                                                                        |
| La aplicación web | Lo que abres en el navegador: archivos estáticos que se compilan una vez.                                              | [`apps/web`](https://github.com/jesuspb2/cuentalibre/tree/main/apps/web) |
| Caddy             | El servidor web delante de todo: sirve la aplicación, pasa las peticiones a la API y saca solo los certificados HTTPS. | —                                                                        |

## Lo que necesitas

- **Un servidor Linux** con [Docker y Docker Compose](https://docs.docker.com/engine/install/).
- **Un dominio con dos subdominios** que apunten a la IP del servidor, uno para la aplicación y otro para la API: por ejemplo `app.tudominio.es` y `api.tudominio.es`. Tienen que ser **subdominios del mismo dominio**: la sesión se guarda en una cookie que el navegador solo comparte entre ellos.
- **Los puertos 80 y 443 abiertos**, para que Caddy consiga los certificados.
- **Node.js 22 y pnpm**, para compilar la aplicación web. Puedes compilarla en tu ordenador y subir el resultado, o hacerlo en el propio servidor.

## 1. Descarga el código y construye la API

```sh
git clone https://github.com/jesuspb2/cuentalibre.git
cd cuentalibre
docker build -f apps/api/Dockerfile -t cuentalibre-api .
```

La imagen ([`apps/api/Dockerfile`](https://github.com/jesuspb2/cuentalibre/blob/main/apps/api/Dockerfile)) aplica las migraciones de la base de datos cada vez que arranca y después sirve la API en el puerto 3000.

## 2. Compila la aplicación web

Dile a la aplicación dónde está tu API:

```sh
pnpm install
VITE_API_URL=https://api.tudominio.es pnpm --filter @cuentalibre/web build
```

El resultado queda en `apps/web/dist`. Más adelante lo copiarás al servidor.

## 3. Prepara la carpeta del servidor

Crea una carpeta, por ejemplo `/opt/cuentalibre`, con estos tres archivos y la aplicación compilada en `web/`:

```text
/opt/cuentalibre
├── compose.yml
├── Caddyfile
├── .env
└── web/          ← el contenido de apps/web/dist
```

**`compose.yml`**:

```yaml
services:
  caddy:
    image: caddy:2.10-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      APP_DOMAIN: ${APP_DOMAIN}
      API_DOMAIN: ${API_DOMAIN}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./web:/srv/web:ro
      - caddy-data:/data
    depends_on:
      - api

  api:
    image: cuentalibre-api
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://cuentalibre:${POSTGRES_PASSWORD}@postgres:5432/cuentalibre
      BETTER_AUTH_URL: https://${API_DOMAIN}
      WEB_ORIGIN: https://${APP_DOMAIN}
    volumes:
      - files:/app/data/files
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: cuentalibre
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: cuentalibre
    volumes:
      - postgres:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cuentalibre"]
      interval: 5s
      timeout: 5s
      retries: 20

volumes:
  caddy-data:
  files:
  postgres:
```

**`Caddyfile`**:

```text
{$APP_DOMAIN} {
	root * /srv/web
	encode zstd gzip
	try_files {path} /index.html
	file_server
}

{$API_DOMAIN} {
	encode zstd gzip
	reverse_proxy api:3000 {
		header_up X-Forwarded-For {client_ip}
	}
}
```

**`.env`** (genera las dos claves con `openssl rand -base64 32` y guárdalas en un sitio seguro):

```sh
APP_DOMAIN=app.tudominio.es
API_DOMAIN=api.tudominio.es
POSTGRES_PASSWORD=una-contraseña-larga
BETTER_AUTH_SECRET=otra-clave-larga
```

## 4. Arráncalo

```sh
cd /opt/cuentalibre
docker compose up -d
```

En un minuto, `https://api.tudominio.es/v1/health` debería responder `{"status":"ok"}`. Abre `https://app.tudominio.es`, crea tu cuenta y tu empresa, y listo.

## Opciones

Todo se configura con variables en el `.env`. Están explicadas en [`apps/api/.env.example`](https://github.com/jesuspb2/cuentalibre/blob/main/apps/api/.env.example) y en el [README de la API](https://github.com/jesuspb2/cuentalibre/blob/main/apps/api/README.md):

- **Correo** (`SMTP_URL`, `EMAIL_FROM`): para enviar las facturas desde cuentalibre, verificar el correo al registrarse y recuperar la contraseña. Sin él, las facturas se envían con tu programa de correo y no hay recuperación de contraseña.
- **Entrar con Google** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
- **Archivos en un bucket S3** (`STORAGE_DRIVER=s3` y las variables `S3_*`): por defecto se guardan en el volumen `files`.
- **VERI\*FACTU** (`VERIFACTU_ENV` y el certificado): para enviar los registros de facturación a la Agencia Tributaria.

Después de cambiar el `.env`, aplica los cambios con `docker compose up -d`.

## Copias de seguridad

Tus datos están en dos volúmenes: la base de datos (`postgres`) y los archivos subidos (`files`). Copia los dos, a diario y fuera del servidor:

```sh
cd /opt/cuentalibre
docker compose exec -T postgres pg_dump -U cuentalibre --format=custom cuentalibre > cuentalibre.dump
docker run --rm -v cuentalibre_files:/files -v "$PWD":/backup alpine tar czf /backup/files.tar.gz -C /files .
```

Para restaurar la base de datos:

```sh
docker compose exec -T postgres pg_restore -U cuentalibre -d cuentalibre --clean --if-exists < cuentalibre.dump
```

El nombre del volumen lleva delante el de la carpeta (`cuentalibre_files` si la carpeta se llama `cuentalibre`); compruébalo con `docker volume ls`. Como ejemplo de copia automática a un bucket, mira el script que usa cuentalibre online, [`deploy/backup.sh`](https://github.com/jesuspb2/cuentalibre/blob/main/deploy/backup.sh).

## Actualizar

Cuando salga una versión nueva, descarga el código, vuelve a construir la API y la aplicación, y reinicia:

```sh
cd cuentalibre
git pull
docker build -f apps/api/Dockerfile -t cuentalibre-api .
VITE_API_URL=https://api.tudominio.es pnpm --filter @cuentalibre/web build
# copia apps/web/dist a /opt/cuentalibre/web
cd /opt/cuentalibre && docker compose up -d
```

La API aplica sola los cambios de la base de datos al arrancar. Haz una copia de seguridad antes de actualizar.
