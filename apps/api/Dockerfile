# Two images, built from the repository root:
#   docker build -f apps/api/Dockerfile -t cuentalibre .                     # self-hosting: the API and the web app
#   docker build -f apps/api/Dockerfile --target api -t cuentalibre-api .    # the API alone, as cuentalibre online runs it
# Both apply pending migrations, then serve on port 3000.

FROM node:22-alpine AS build
RUN npm install --global pnpm@12.8.2
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --filter @cuentalibre/api...
COPY packages/core packages/core
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @cuentalibre/api build

FROM build AS web
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter @cuentalibre/web...
COPY packages/ui packages/ui
COPY apps/web apps/web
# The API serves the app, so the app finds it on its own origin. CI typechecks; this only bundles.
RUN VITE_API_URL=/ pnpm --filter @cuentalibre/web exec vite build

FROM node:22-alpine AS api
ENV NODE_ENV=production STORAGE_DIR=/app/data/files
WORKDIR /app
COPY --from=build /repo/apps/api/dist dist
COPY --from=build /repo/apps/api/drizzle drizzle
RUN mkdir -p data/files && chown node:node data/files
USER node
EXPOSE 3000
CMD ["sh", "-c", "node --enable-source-maps dist/db/migrate-cli.js && exec node --enable-source-maps dist/server.js"]

FROM api AS selfhost
ENV WEB_DIR=/app/web
COPY --from=web /repo/apps/web/dist web
