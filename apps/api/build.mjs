// Bundles the server, the migration script and the staging seed, with every dependency, so the
// production image needs neither node_modules nor a TypeScript loader.
// `dist/db/migrate-cli.js` finds the migrations at `../../drizzle`, as the source does.
import { build } from "esbuild";

await build({
  entryPoints: ["src/server.ts", "src/db/migrate-cli.ts", "src/db/seed-cli.ts"],
  outdir: "dist",
  outbase: "src",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  logLevel: "warning",
  // Some dependencies are CommonJS and call require().
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
