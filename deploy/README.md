# deploy

How cuentalibre Cloud (`app.cuentalibre.es`) is run: maintainer documentation. To run cuentalibre on your own server, follow the [self-hosting guide](https://cuentalibre.es/docs/instalar) and `selfhost/` instead; nothing here applies to it.

This folder runs the API's `api` image (see [apps/api/README.md](../apps/api/README.md)) on one server: Caddy with a Cloudflare origin certificate in front, the API and Postgres. Caddy only takes the client's IP from Cloudflare's addresses and passes it on as `X-Forwarded-For`, which Better Auth rate-limits by. `cloud-init.yml` prepares a new server.

```
compose.yml            Caddy, the API and Postgres
Caddyfile              TLS with the origin certificate, Authenticated Origin Pulls, the client's IP
origin-pull-ca.pem     The CAs whose client certificates Caddy accepts, one per zone
cloud-init.yml         Prepares a new server
server-env.sh          Writes the server's .env and backup.env from its GitHub environment
.env.example           The settings compose hands to the API
backup.sh              The nightly encrypted Postgres dump
backup.env.example     The backup's settings
backup-recipients.txt  The age public keys backups are encrypted to
cuentalibre-backup.*   The systemd timer and service that run backup.sh
```

## Cloudflare

### Authenticated Origin Pulls

Cloudflare's addresses are shared by every Cloudflare customer, so the firewall alone would let anyone point a zone of their own at the server and skip our WAF and rate limits. Caddy therefore requires a client certificate signed by one of the CAs in `origin-pull-ca.pem`, which only our zones present: Authenticated Origin Pulls with a zone-level certificate on `jesuspb.dev`, the zone that holds `app` and `api.cuentalibre.es` as custom hostnames, and another on `cuentalibre.es`, which serves staging. Each zone has its own CA. Cloudflare's global AOP certificate wouldn't do, since every account can present it. Each CA's private key was thrown away once it signed its client certificate, which lives only in Cloudflare (until 2036). To set it up for another zone, or to rotate one:

```sh
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 3650 \
  -keyout ca.key -out origin-pull-ca.pem -subj "/CN=cuentalibre origin pull CA" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign"
openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout client.key -out client.csr -subj "/CN=cuentalibre origin pull"
openssl x509 -req -in client.csr -CA origin-pull-ca.pem -CAkey ca.key -days 3650 -out client.pem \
  -extfile <(printf 'basicConstraints=CA:FALSE\nextendedKeyUsage=clientAuth\n')
```

Upload `client.pem` and `client.key` in the zone's SSL/TLS › Origin Server › Authenticated Origin Pulls (or `POST /zones/{zone}/origin_tls_client_auth`), turn it on, and add the new CA to `origin-pull-ca.pem` (replacing the old one when rotating) before deploying it; delete `ca.key` and `client.key` afterwards. The servers' IPs stay out of public DNS: the only records with them are proxied, production's fallback origin `cuentalibre-edge.jesuspb.dev` and staging's `api-staging.cuentalibre.es`.

### WAF

The zone's WAF filters requests before they reach the origin. All of it fits Cloudflare's Free plan (Security › WAF):

- **Managed rules**: the Cloudflare Free Managed Ruleset, deployed on the zone (an `execute` rule in the `http_request_firewall_managed` phase).
- **Custom rules**, action Block:
  - `api.cuentalibre.es` outside `/v1/`, except the `robots.txt` Cloudflare serves: `(http.host eq "api.cuentalibre.es" and not starts_with(http.request.uri.path, "/v1/") and http.request.uri.path ne "/robots.txt")`
  - methods the API doesn't use: `(http.host eq "api.cuentalibre.es" and not http.request.method in {"GET" "HEAD" "POST" "PUT" "PATCH" "DELETE" "OPTIONS"})`
- **Rate limiting rule**, counting by IP: more than 200 requests in 10 seconds to `starts_with(http.request.uri.path, "/v1/")` blocks that IP for 10 seconds with a 429. Free can't match the hostname here, so it counts `/v1/` on every hostname of the zone. 200 stays well above what the app sends and above the 600 a minute an API key may make; Better Auth and the per-key limit do the finer work.

The API caps active keys per user and organization at 10 (`MAX_API_KEYS`), so the per-key limit can't be multiplied by creating more keys.

## Staging and production

Every push to `main` that passes CI deploys to **staging**, never to production (`deploy-staging-api` and `deploy-staging-web` in `ci.yml`). Only the site skips staging and goes straight to production. Staging is a server of its own, in its own Hetzner project (`cuentalibre-staging`), so its keys, buckets and SSH access can't reach production. It runs the same `compose.yml` and `Caddyfile`, with its own `.env`, at `api-staging.cuentalibre.es` and `app-staging.cuentalibre.es`, with the app behind Cloudflare Access. Unlike production they aren't Cloudflare for SaaS hostnames on `jesuspb.dev`, but plain hostnames on `cuentalibre.es`: Access skips SaaS hostnames whose zone is in the same account as the SaaS zone, and a SaaS hostname with its own origin would reach the server under that origin's name (only Enterprise rewrites it). So staging shares `cuentalibre.es`'s LaLiga blocks, and its names have a single level, which the zone's free certificate covers. The API is a proxied record with its own origin certificate; the app is a custom domain of its Worker. The API sends `X-Robots-Tag: noindex` everywhere, and the staging app does too.

- The `api` image is built on the runner, labelled with its commit, and sent over SSH (`docker save | docker load`), so the server needs no registry credentials. `compose.yml`, the `Caddyfile` and the backup script go with it, and the whole stack restarts.
- Its settings come from the `staging` GitHub environment, like production's from `production` (see [Settings](#settings)). `server-env.sh` refuses a live Stripe key there, or SMTP without `EMAIL_REDIRECT_TO`, which sends every email to the owner instead.
- Its data is made up: on an empty database, `apps/api/src/db/seed.ts` creates the account in `SEED_EMAIL` and `SEED_PASSWORD` with a few invoices and expenses. Never copy production data into it.
- The app is built with `VITE_API_URL=https://api-staging.cuentalibre.es` and deployed as its own Worker, `cuentalibre-app-staging` (`wrangler deploy --env staging`).

### Promoting

Production changes only through the _Promote to production_ workflow (`promote.yml`), run by hand from `main` with a checkbox per app:

- API: the image staging runs, as it is (no rebuild). Each environment only holds the SSH key of its own server, so one job takes the image from staging and hands it as an artifact to another, which loads it on production with that commit's `compose.yml` and `Caddyfile`, writes the server's settings with it as `API_IMAGE`, and restarts the stack.
- Web app: built again from `main` with `VITE_API_URL=https://api.cuentalibre.es`, since the address is baked in; it refuses to run until CI has passed on `main`'s last commit, so staging shows the same code.
- Each one pushes a plain tag on the commit it promoted, `prod-api-2026.10.27` or `prod-web-2026.10.27`, with `.2`, `.3`… for later ones the same day: `git tag -l 'prod-*'` lists what ran in production and when.

Each environment says which commit it runs: the API as `revision` in `/v1/health`, the app in its `<meta name="revision">`. Comparing them shows how far staging is ahead:

```sh
curl -s https://api-staging.cuentalibre.es/v1/health
curl -s https://api.cuentalibre.es/v1/health
git log --oneline <production's revision>..<staging's revision>
```

### Rolling back

Run the same workflow from a `prod-*` tag instead of `main` (_Use workflow from_ › Tags). The API goes back to that commit's image, taken from staging or built again if staging pruned it (images go after a week); the web app is built from the tag. It leaves a new `prod-*` tag on that commit. The `production` environment only accepts runs from `main` and from `prod-*` tags. Migrations don't roll back: the older API runs on the newer schema, so a migration that drops or renames something must ship after the code that stops using it.

### Settings

The `staging` and `production` environments each hold `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `DEPLOY_HOST`, each for its own server. `DEPLOY_HOST` is a secret so the logs mask the server's address, which Cloudflare otherwise keeps hidden.

Nobody edits `.env` or `backup.env` on a server. Each deploy writes them from the server's GitHub environment with the names `.env.example` and `backup.env.example` list, leaving out the empty ones so the code's defaults apply: secrets for credentials and personal data such as email addresses, variables for the rest. `server-env.sh` does it, and stops the deploy before touching the server when `API_DOMAIN`, `WEB_ORIGIN`, `POSTGRES_PASSWORD` or `BETTER_AUTH_SECRET` is missing. So a PR that adds a setting says which secret or variable to create in each environment, and creating them is part of merging it; production takes them at its next promotion. GitHub can't show a secret again, so keep a copy of each one elsewhere.

## Backups

`backup.sh` dumps Postgres every night (`cuentalibre-backup.timer`, installed by hand in `/etc/systemd/system`) to a bucket with object lock: each dump can't be deleted for 30 days and expires after 31. Staging runs the same backups to its own bucket, without object lock and kept for 7 days, so changes to them and restores can be tried there first. Its credentials live in `backup.env`, apart from the `.env` that compose hands to the API.

Each dump is encrypted with [age](https://age-encryption.org) to the public keys in `backup-recipients.txt` before it leaves the server. The private key never goes to the server: it lives in the password manager with an offline copy. The bucket key in `backup.env` can only write to the bucket; restoring uses a separate read key, and the bucket stays private with access logging on. To restore, fetch the dump with the read key and decrypt it (`age -d -i backup.key`), as the header of `backup.sh` shows.

### Uploaded files

The files buckets (`cuentalibre-files`, and `cuentalibre-files-staging` in staging) have versioning on, so deleting an object only hides it behind a delete marker. The lifecycle rule in `files-lifecycle.json` removes those hidden versions after 31 days, and the delete markers once nothing is left under them. That matches the dumps, so a file deleted by a bug of ours or by hand can be brought back whole within the same window. It doesn't protect against a leaked key, which can delete versions too. To set it up on a new bucket, with a key of its Hetzner project:

```sh
export AWS_ENDPOINT_URL=https://fsn1.your-objectstorage.com AWS_REGION=fsn1
aws s3api put-bucket-versioning --bucket <bucket> --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket <bucket> --lifecycle-configuration file://files-lifecycle.json
```

Deleting a file in the app also deletes its `file` row (name, type, size), so bringing the bytes back isn't enough. To restore one by hand:

1. Find its object. The key is `<organizationId>/<fileId>/<uuid>`, and the delete marker is the version on top:

   ```sh
   aws s3api list-object-versions --bucket cuentalibre-files --prefix <organizationId>/<fileId>/
   aws s3api delete-object --bucket cuentalibre-files --key <key> --version-id <the delete marker's VersionId>
   ```

2. Recreate its row from the last dump that holds it. Decrypt the dump as above, copy it to the server and, in `/opt/cuentalibre`, extract the table:

   ```sh
   docker compose exec -T postgres pg_restore --data-only --table=file -f - < dump > file-rows.sql
   grep -E '^COPY|<fileId>|^\\\.$' file-rows.sql > file-row.sql
   docker compose exec -T postgres psql -U cuentalibre -d cuentalibre -v ON_ERROR_STOP=1 < file-row.sql
   ```

   If the person who uploaded it is gone, write `\N` in its `uploaded_by` column. A file uploaded and deleted the same day is in no dump, so its row has to be written by hand: `head-object` gives its type and size, but its name is lost.

3. For a deleted account, the rows of its organizations are gone too. Restore the dump into a scratch database (`createdb`, then `pg_restore -d`), copy the organization's rows back from there, and bring back each of its objects as in step 1.
