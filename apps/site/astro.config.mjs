import { satteri } from "@astrojs/markdown-satteri";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

/** Opens links to the demo in their own tab, as the rest of the site does (`demoLinkAttrs`). */
const demoLinksInNewTab = {
  name: "demo-links-in-new-tab",
  element: {
    filter: ["a"],
    visit(node, ctx) {
      if (!/\/demo\/?$/.test(String(node.properties?.href ?? ""))) return;
      ctx.setProperty(node, "target", "_blank");
      ctx.setProperty(node, "rel", ["noopener"]);
    },
  },
};

export default defineConfig({
  // Public URL of the site, used for canonical links. Set SITE_URL when deploying.
  site: process.env.SITE_URL ?? "http://localhost:4321",
  markdown: {
    processor: satteri({ hastPlugins: [demoLinksInNewTab] }),
    // Code blocks take their colors from CSS variables (see global.css)
    shikiConfig: { theme: "css-variables" },
  },
  vite: { plugins: [tailwindcss()] },
  // A CSP in each page that only lets the site's own scripts run, by their hashes. Styles stay
  // inline: code blocks color their tokens with `style` attributes. `public/_headers` adds the rest.
  security: { csp: { styleDirective: { resources: ["'self'", "'unsafe-inline'"] } } },
});
