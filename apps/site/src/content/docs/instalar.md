---
title: "Instalar en tu servidor"
label: "Instalar en tu servidor"
description: "Cómo poner en marcha cuentalibre gratis en un servidor tuyo con Docker: un contenedor con la aplicación y la API, y la base de datos."
section: start
order: 2
---

cuentalibre es software libre (AGPL-3.0): puedes instalarlo en un servidor tuyo y usarlo gratis, sin límites. A cambio, la instalación, las copias de seguridad y las actualizaciones corren de tu cuenta. Si prefieres no ocuparte de nada de eso, usa [cuentalibre Cloud](/docs#dos-formas-de-usar-cuentalibre).

Esta guía es para quien sabe manejar un servidor Linux por SSH. El código y su documentación técnica están en el [repositorio de GitHub](https://github.com/cuentalibre-app/cuentalibre); los enlaces de cada paso llevan al archivo exacto.

## Qué vas a instalar

Dos contenedores, definidos en [`selfhost/compose.yml`](https://github.com/cuentalibre-app/cuentalibre/blob/main/selfhost/compose.yml):

| Contenedor    | Qué es                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cuentalibre` | La aplicación que abres en el navegador y la API que guarda los datos, calcula y emite las facturas. Todo en un puerto, el 3000 por defecto. |
| `postgres`    | La base de datos.                                                                                                                                              |

cuentalibre no se ocupa del HTTPS: lo dejas en manos de lo que ya uses para llegar a tus servicios (Cloudflare Tunnel, Tailscale, un proxy inverso…). Lo explicamos [más abajo](#ponlo-detras-de-https).

## Lo que necesitas

- **Un servidor Linux** (una Raspberry Pi 4 o 5 también vale) con [Docker y Docker Compose](https://docs.docker.com/engine/install/) y unos 2 GB de memoria libres la primera vez, para construir la imagen.
- **Una dirección para abrirlo**: un dominio o subdominio (`cuentas.tudominio.es`) o, si solo lo vas a usar en casa, la IP del servidor en tu red.

No hace falta abrir puertos en el router ni instalar Node.js.

## 1. Descarga el código

```sh
git clone https://github.com/cuentalibre-app/cuentalibre.git
cd cuentalibre
git checkout "$(git tag -l 'v*' --sort=-v:refname | head -n1)"
cd selfhost
```

El `git checkout` te deja en la última [versión publicada](https://github.com/cuentalibre-app/cuentalibre/releases), que ya ha funcionado en cuentalibre Cloud. La rama `main` puede llevar cambios que aún no han llegado allí.

## 2. Configúralo

Copia el ejemplo de configuración:

```sh
cp .env.example .env
```

Y rellena el `.env` (genera las dos claves con `openssl rand -base64 32` y guárdalas en un sitio seguro):

```sh
PUBLIC_URL=https://cuentas.tudominio.es
POSTGRES_PASSWORD=una-clave-larga
BETTER_AUTH_SECRET=otra-clave-larga
```

`PUBLIC_URL` es la dirección exacta que verás en la barra del navegador, sin barra al final: con `https://` si lo pones detrás de HTTPS, o `http://192.168.1.20:3000` si lo abres por la IP en tu red. La sesión solo funciona desde esa dirección.

## 3. Arráncalo

```sh
docker compose up -d --build
```

La primera vez tarda unos minutos, porque construye la imagen ([`apps/api/Dockerfile`](https://github.com/cuentalibre-app/cuentalibre/blob/main/apps/api/Dockerfile)) con la aplicación dentro. Cada vez que arranca aplica las migraciones de la base de datos.

Cuando acabe, `http://IP-del-servidor:3000/v1/health` debería responder `{"status":"ok"}`. Abre tu `PUBLIC_URL`, crea tu cuenta y tu empresa, y listo.

## Ponlo detrás de HTTPS

cuentalibre escucha en HTTP en el puerto 3000. Para usarlo desde fuera de casa, o con `https://`, pon delante lo que ya uses y apúntalo a `http://localhost:3000` (o a la IP del servidor). Algunos ejemplos:

- **Cloudflare Tunnel**: añade al túnel un nombre público (`cuentas.tudominio.es`) con el servicio `http://localhost:3000`. No abres ningún puerto.
- **Tailscale**: `tailscale serve --bg 3000` lo publica con HTTPS en tu red de Tailscale, en `https://servidor.tu-tailnet.ts.net`.
- **Un proxy inverso** (Nginx Proxy Manager, Traefik, Nginx…): un host para tu dominio que pase las peticiones a `http://IP-del-servidor:3000`.
- **Caddy**, si no tienes nada y el servidor tiene los puertos 80 y 443 abiertos a internet: saca solo los certificados. Con este `Caddyfile`:

  ```text
  cuentas.tudominio.es {
  	reverse_proxy localhost:3000
  }
  ```

Pon en `PUBLIC_URL` la dirección `https://` que hayas elegido y aplica el cambio con `docker compose up -d`.

Si el proxy está en el mismo servidor, puedes hacer que cuentalibre solo escuche ahí, sin dejar el puerto 3000 a la vista de tu red: añade `PORT=127.0.0.1:3000` al `.env`.

Sin HTTPS, por la IP en tu red, cuentalibre funciona igual, pero los datos viajan sin cifrar: hazlo solo en una red de confianza. El navegador tampoco deja mostrar notificaciones fuera de HTTPS.

## Opciones

Todo se configura con variables en el `.env`. Están explicadas en [`apps/api/.env.example`](https://github.com/cuentalibre-app/cuentalibre/blob/main/apps/api/.env.example) y en el [README de la API](https://github.com/cuentalibre-app/cuentalibre/blob/main/apps/api/README.md):

- **Correo** (`SMTP_URL`, `EMAIL_FROM`): para enviar las facturas desde cuentalibre, verificar el correo al registrarse y recuperar la contraseña. Sin él, las facturas se envían con tu programa de correo y no hay recuperación de contraseña.
- **Entrar con Google** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), con `<PUBLIC_URL>/v1/auth/callback/google` como URI de redirección.
- **Archivos en un bucket S3** (`STORAGE_DRIVER=s3` y las variables `S3_*`): por defecto se guardan en el volumen `files`.
- **El puerto** (`PORT`): el del servidor en el que escucha cuentalibre, 3000 si no dices nada.

Después de cambiar el `.env`, aplica los cambios con `docker compose up -d`.

## Copias de seguridad

Tus datos están en dos volúmenes: la base de datos (`postgres`) y los archivos subidos (`files`). Copia los dos, a diario y fuera del servidor:

```sh
cd cuentalibre/selfhost
docker compose exec -T postgres pg_dump -U cuentalibre --format=custom cuentalibre > cuentalibre.dump
docker run --rm -v selfhost_files:/files -v "$PWD":/backup alpine tar czf /backup/files.tar.gz -C /files .
```

Para restaurar la base de datos:

```sh
docker compose exec -T postgres pg_restore -U cuentalibre -d cuentalibre --clean --if-exists < cuentalibre.dump
```

El nombre del volumen lleva delante el de la carpeta (`selfhost_files` si no la has cambiado); compruébalo con `docker volume ls`. Como ejemplo de copia automática a un bucket, mira el script que usa cuentalibre Cloud, [`deploy/backup.sh`](https://github.com/cuentalibre-app/cuentalibre/blob/main/deploy/backup.sh).

## Actualizar

Las versiones nuevas salen en la [página de versiones](https://github.com/cuentalibre-app/cuentalibre/releases), con lo que cambia en cada una. Lee las notas de todas las que te saltes: si alguna pide hacer algo antes o después de actualizar, lo dice ahí.

Haz una copia de seguridad, pasa a la última versión y vuelve a construir la imagen:

```sh
cd cuentalibre
git fetch --tags
git checkout "$(git tag -l 'v*' --sort=-v:refname | head -n1)"
cd selfhost
docker compose up -d --build
```

cuentalibre aplica solo los cambios de la base de datos al arrancar. No vuelvas a una versión anterior sin restaurar antes la copia: los cambios de la base de datos no se deshacen.
