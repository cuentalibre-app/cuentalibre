# cloud

How cuentalibre Cloud (`app.cuentalibre.es`) is run: maintainer documentation. To run cuentalibre on your own server, follow the [self-hosting guide](https://cuentalibre.es/docs/instalar) and `deploy/selfhost/` instead; nothing here applies to it.

This folder runs the API's `api` image (see [apps/api/README.md](../../apps/api/README.md)) on one server: a Cloudflare Tunnel in front, the API and Postgres. The API's rate limits count by the client's IP in `CF-Connecting-IP` (`CLIENT_IP_HEADER`), which only Cloudflare can set, since the tunnel is the only way in. `cloud-init.yml` prepares a new server.

```
compose.yml            cloudflared, the API and Postgres
cloud-init.yml         Prepares a new server
server-env.sh          Writes the server's .env and backup.env from its GitHub environment
.env.example           The settings compose hands to the API
backup.sh              The nightly encrypted Postgres dump
backup.env.example     The backup's settings
backup-recipients.txt  The age public keys backups are encrypted to
cuentalibre-backup.*   The systemd timer and service that run backup.sh
```

## Cloudflare

### Tunnel

Each environment has a remotely managed Cloudflare Tunnel, `cuentalibre-production` and `cuentalibre-staging`. The `cloudflared` container connects out to Cloudflare with the environment's `TUNNEL_TOKEN`, so the server opens no port for HTTP: the Hetzner Cloud Firewall and ufw only let SSH in. The tunnel's one ingress rule sends every hostname to `http://api:3000`. It matches no hostname on purpose: production's requests arrive with the custom hostname (`api.cuentalibre.es`), not the fallback origin's name.

The only DNS records that lead to a server are proxied CNAMEs to `<tunnel id>.cfargotunnel.com`: production's fallback origin `cuentalibre-edge.jesuspb.dev` and staging's `api-staging.cuentalibre.es`. Nobody else can route to a tunnel, so no other account's zone can skip our WAF and rate limits. The token is what has to stay secret: whoever holds it can run a connector of their own and take part of the environment's traffic. If it leaks, rotate it (`POST /accounts/{account}/cfd_tunnel/{tunnel}/token` with a new `tunnel_secret`, or *Refresh token* in the dashboard), update `TUNNEL_TOKEN` in the GitHub environment and redeploy.

To create a tunnel for a new environment:

```sh
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/cfd_tunnel" -H "Authorization: Bearer $TOKEN" \
  --json '{"name": "cuentalibre-<environment>", "config_src": "cloudflare"}'
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/cfd_tunnel/$TUNNEL/configurations" -H "Authorization: Bearer $TOKEN" \
  --json '{"config": {"ingress": [{"service": "http://api:3000"}]}}'
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/cfd_tunnel/$TUNNEL/token" -H "Authorization: Bearer $TOKEN"
```

and put the token in the environment's `TUNNEL_TOKEN` secret.

### WAF

The zone's WAF filters requests before they reach the origin. All of it fits Cloudflare's Free plan (Security › WAF):

- **Managed rules**: the Cloudflare Free Managed Ruleset, deployed on the zone (an `execute` rule in the `http_request_firewall_managed` phase).
- **Custom rules**, action Block:
  - `api.cuentalibre.es` outside `/v1/`, except the `robots.txt` Cloudflare serves: `(http.host eq "api.cuentalibre.es" and not starts_with(http.request.uri.path, "/v1/") and http.request.uri.path ne "/robots.txt")`
  - methods the API doesn't use: `(http.host eq "api.cuentalibre.es" and not http.request.method in {"GET" "HEAD" "POST" "PUT" "PATCH" "DELETE" "OPTIONS"})`
- **Rate limiting rule**, counting by IP: more than 200 requests in 10 seconds to `starts_with(http.request.uri.path, "/v1/")` blocks that IP for 10 seconds with a 429. Free can't match the hostname here, so it counts `/v1/` on every hostname of the zone. 200 stays well above what the app sends and above the 600 a minute an API key may make; Better Auth and the per-key limit do the finer work.

The API caps active keys per user and organization at 10 (`MAX_API_KEYS`), so the per-key limit can't be multiplied by creating more keys.

## Staging and production

Every push to `main` that passes CI deploys to **staging**, never to production (`deploy-staging-api` and `deploy-staging-web` in `ci.yml`). Only the site skips staging and goes straight to production. Staging is a server of its own, in its own Hetzner project (`cuentalibre-staging`), so its keys, buckets and SSH access can't reach production. It runs the same `compose.yml`, with its own `.env` and tunnel, at `api-staging.cuentalibre.es` and `app-staging.cuentalibre.es`, with the app behind Cloudflare Access. Unlike production they aren't Cloudflare for SaaS hostnames on `jesuspb.dev`, but plain hostnames on `cuentalibre.es`: Access skips SaaS hostnames whose zone is in the same account as the SaaS zone, and a SaaS hostname with its own origin would reach the server under that origin's name (only Enterprise rewrites it). So staging shares `cuentalibre.es`'s LaLiga blocks, and its names have a single level, which the zone's free certificate covers. The API is a proxied CNAME to its tunnel; the app is a custom domain of its Worker. The API sends `X-Robots-Tag: noindex` everywhere, and the staging app does too.

- The `api` image is built on the runner, labelled with its commit, and sent over SSH (`docker save | docker load`), so the server needs no registry credentials. `compose.yml` and the backup script go with it, and the whole stack restarts.
- Its settings come from the `staging` GitHub environment, like production's from `production` (see [Settings](#settings)). `server-env.sh` refuses a live Stripe key there, or SMTP without `EMAIL_REDIRECT_TO`, which sends every email to the owner instead.
- Its data is made up: on an empty database, `apps/api/src/db/seed.ts` creates the account in `SEED_EMAIL` and `SEED_PASSWORD` with a few invoices and expenses. Never copy production data into it.
- The app is built with `VITE_API_URL=https://api-staging.cuentalibre.es` and deployed as its own Worker, `cuentalibre-app-staging` (`wrangler deploy --env staging`).

### Promoting

Production changes only through the _Promote to production_ workflow (`promote.yml`), run by hand from `main`. It always promotes both apps, so the app never runs against an API from another commit, and every promotion is a version for self-hosters (see [Versions](#versions)):

- API: the image staging runs, as it is (no rebuild). Each environment only holds the SSH key of its own server, so one job takes the image from staging and hands it as an artifact to another, which loads it on production with that commit's `compose.yml`, writes the server's settings with it as `API_IMAGE`, and restarts the stack.
- Web app: built again from `main` with `VITE_API_URL=https://api.cuentalibre.es`, since the address is baked in; it refuses to run until CI has passed on `main`'s last commit, so staging shows the same code.
- Then it publishes the commit as the next version, `v0.4.2`: `git tag -l 'v*'` lists what ran in production, and the releases page says when. Older promotions left `prod-api-*` and `prod-web-*` tags instead.

Each environment says which commit it runs: the API as `revision` in `/v1/health`, the app in its `<meta name="revision">`. Comparing them shows how far staging is ahead:

```sh
curl -s https://api-staging.cuentalibre.es/v1/health
curl -s https://api.cuentalibre.es/v1/health
git log --oneline <production's revision>..<staging's revision>
```

### Rolling back

Run the same workflow from a `v*` tag instead of `main` (_Use workflow from_ › Tags). The API goes back to that commit's image, taken from staging or built again if staging pruned it (images go after a week); the web app is built from the tag. It publishes no version, and self-hosters stay on theirs: fix forward with a new one. The `production` environment only accepts runs from `main` and from `v*` and `prod-*` tags. Migrations don't roll back: the older API runs on the newer schema, so a migration that drops or renames something must ship after the code that stops using it. Nor does the tunnel: `v1.2.1` and older ran Caddy, and rolling back to them would start a `compose.yml` whose `Caddyfile` and certificates are gone.

### Versions

Every promotion is a SemVer version for self-hosters, so they run exactly what production runs, and [the install guide](../../apps/site/src/content/docs/instalar.md) checks out the latest `v*` tag rather than `main`. The tag is the only place the version lives.

- The workflow asks for the kind of version: `patch` (the default) for fixes, `minor` for something new, `major` for a change that breaks something for self-hosters. While on `0.x`, a breaking change bumps the middle number instead.
- `CHANGELOG.md` says what each version changes, newest first. Nobody edits it by hand: a version lists the PRs merged since the previous one, so a PR's title is its changelog line and should say what changes for the people who use or run cuentalibre.
- `publish-version.sh` tags the promoted commit, has GitHub generate the release notes from the PRs merged since the last tag (title, author, link, and first-time contributors), creates the GitHub Release with them, and commits them to `main` as `## <version> (<date>)` in the changelog. That commit runs no CI (pushes with the workflow token start no workflows) and changes no app, so the next promotion's CI check looks past it.
- Promoting a commit with nothing new since the last version, apart from the changelog, publishes nothing.

### Settings

The `staging` and `production` environments each hold `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `DEPLOY_HOST`, each for its own server. `DEPLOY_HOST` is a secret so the logs mask the server's address, which Cloudflare otherwise keeps hidden.

Nobody edits `.env` or `backup.env` on a server. Each deploy writes them from the server's GitHub environment with the names `.env.example` and `backup.env.example` list, leaving out the empty ones so the code's defaults apply: secrets for credentials and personal data such as email addresses, variables for the rest. `server-env.sh` does it, and stops the deploy before touching the server when `API_DOMAIN`, `TUNNEL_TOKEN`, `WEB_ORIGIN`, `POSTGRES_PASSWORD` or `BETTER_AUTH_SECRET` is missing. So a PR that adds a setting says which secret or variable to create in each environment, and creating them is part of merging it; production takes them at its next promotion. GitHub can't show a secret again, so keep a copy of each one elsewhere.

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
   aws s3api delete-object --bucket cuentalibre-files --key <key> --version-id=<the delete marker's VersionId>
   ```

   Keep the `=`: version IDs can start with `-`, which `aws` would otherwise read as an option.

2. Recreate its row from the last dump that holds it. Decrypt the dump as above, copy it to the server and, in `/opt/cuentalibre`, extract the table:

   ```sh
   docker compose exec -T postgres pg_restore --data-only --table=file -f - < dump > file-rows.sql
   grep -E '^COPY|<fileId>|^\\\.$' file-rows.sql > file-row.sql
   docker compose exec -T postgres psql -U cuentalibre -d cuentalibre -v ON_ERROR_STOP=1 < file-row.sql
   ```

   If the person who uploaded it is gone, write `\N` in its `uploaded_by` column. A file uploaded and deleted the same day is in no dump, so its row has to be written by hand: `head-object` gives its type and size, but its name is lost.

3. For a deleted account, the rows of its organizations are gone too, and its user with them. Restore the dump into a scratch database, keep only that user and their organizations, and load what's left back:

   ```sh
   docker compose exec -T postgres createdb -U cuentalibre restore
   docker compose exec -T postgres pg_restore -U cuentalibre -d restore --no-owner < dump
   docker compose exec -T postgres psql -U cuentalibre -d restore -v ON_ERROR_STOP=1 \
     -c "delete from organization where id not in ('<organizationId>')" \
     -c "delete from \"user\" where id <> '<userId>'" -c "delete from session"
   docker compose exec -T postgres pg_dump -U cuentalibre -d restore --data-only --schema=public --disable-triggers > rows.sql
   docker compose exec -T postgres psql -U cuentalibre -d cuentalibre -v ON_ERROR_STOP=1 --single-transaction < rows.sql
   docker compose exec -T postgres dropdb -U cuentalibre restore
   ```

   Tables that don't belong to an organization or a user, such as `stripe_event`, may clash with rows still in the database; empty them in the scratch database first. If the person signed up again with the same email, delete that new account (through the app, or its user and organizations) before loading, and not in the same transaction: `--disable-triggers` also turns off the cascades. Then bring back every object under `<organizationId>/`:

   ```sh
   aws s3api list-object-versions --bucket cuentalibre-files --prefix <organizationId>/ --output json |
     jq -r '.DeleteMarkers[]? | select(.IsLatest) | "\(.Key) \(.VersionId)"' |
     while read -r key id; do aws s3api delete-object --bucket cuentalibre-files --key "$key" --version-id="$id"; done
   ```
