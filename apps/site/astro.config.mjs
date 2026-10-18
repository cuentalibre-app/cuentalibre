import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Public URL of the site, used for canonical links. Set SITE_URL when deploying.
  site: process.env.SITE_URL ?? "http://localhost:4321",
  vite: { plugins: [tailwindcss()] },
});
