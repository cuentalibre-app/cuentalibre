# The API image. Build it from the repository root:
#   docker build -f apps/api/Dockerfile -t cuentalibre-api .
# It applies pending migrations, then serves on port 3000.

FROM node:22-alpine AS build
RUN npm install --global pnpm@12.8.2
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --filter @cuentalibre/api...
COPY packages/core packages/core
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @cuentalibre/api build

FROM node:22-alpine
ENV NODE_ENV=production STORAGE_DIR=/app/data/files
WORKDIR /app
COPY --from=build /repo/apps/api/dist dist
COPY --from=build /repo/apps/api/drizzle drizzle
RUN mkdir -p data/files && chown node:node data/files
USER node
EXPOSE 3000
CMD ["sh", "-c", "node --enable-source-maps dist/db/migrate-cli.js && exec node --enable-source-maps dist/server.js"]
