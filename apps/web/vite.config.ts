import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** The API's origin when it lives on another one; `/` or nothing means this origin, or the demo alone. */
function apiOrigin(apiUrl: string | undefined) {
  return apiUrl && URL.canParse(apiUrl) ? new URL(apiUrl).origin : undefined;
}

/**
 * Writes `_headers` next to the built app: Cloudflare sends these with every response,
 * and the API sends the same ones when it serves the app (`WEB_DIR`). Styles stay
 * `unsafe-inline` because React renders `style` attributes; scripts never do.
 * `noindex` keeps search engines off a copy that isn't the real app, such as staging.
 */
function securityHeaders(apiUrl: string | undefined, noindex: boolean): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    // Object URLs show picked files and logos; the tiles draw a contact's map
    "img-src 'self' data: blob: https://tile.openstreetmap.org",
    // Vite inlines the smallest font files
    "font-src 'self' data:",
    ["connect-src 'self'", apiOrigin(apiUrl), "https://nominatim.openstreetmap.org"].filter(Boolean).join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  const headers = {
    "Content-Security-Policy": csp,
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    ...(noindex && { "X-Robots-Tag": "noindex, nofollow" }),
  };
  return {
    name: "security-headers",
    apply: "build",
    generateBundle() {
      const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
      this.emitFile({ type: "asset", fileName: "_headers", source: ["/*", ...lines, ""].join("\n") });
    },
  };
}

/**
 * Zod compiles parsers with `new Function` when it can; the CSP forbids that, so it would only
 * fail its probe and report a violation. Its config lives on `globalThis`, so setting it as zod
 * loads, before any schema is built, keeps it from trying.
 */
const zodWithoutEval: Plugin = {
  name: "zod-without-eval",
  transform(code, id) {
    if (/[\\/]zod[\\/]v4[\\/]core[\\/]core\.js$/.test(id))
      return `(globalThis.__zod_globalConfig ??= {}).jitless = true;\n${code}`;
  },
};

/** Tags the page with the commit it was built from, so anyone can tell which one an environment runs. */
function revisionMeta(revision: string | undefined): Plugin {
  return {
    name: "revision-meta",
    apply: "build",
    transformIndexHtml: () => (revision ? [{ tag: "meta", attrs: { name: "revision", content: revision } }] : []),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [
      react(),
      tailwindcss(),
      zodWithoutEval,
      securityHeaders(env.VITE_API_URL, env.VITE_NOINDEX === "true"),
      revisionMeta(env.VITE_REVISION),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
