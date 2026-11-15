/*
 * Writes the guide's screen inventory (apps/site/src/content/docs/guia/pantallas.md): what each
 * screen of the app shows, as a person sees it — its sections, fields (required ones marked),
 * buttons and the options in its menus. The help chat answers from it, so it knows what is on
 * every screen without reading the code.
 *
 * It serves the app with Vite, opens the demo (sample data, no backend) in a headless browser
 * and walks every page reachable from the navigation, on a computer's screen.
 *
 *   pnpm --filter @cuentalibre/web screens          writes the page
 *   pnpm --filter @cuentalibre/web screens --check  fails if the page is out of date (CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUTPUT = fileURLToPath(new URL("../../site/src/content/docs/guia/pantallas.md", import.meta.url));
const DEMO = "/demo";

interface Section {
  title: string;
  items: string[];
}

interface Screen {
  path: string;
  title: string;
  actions: string[];
  sections: Section[];
  rowActions: string[];
  links: string[];
}

/** Runs in the page: what the screen shows, read from its accessible names. */
function readScreen(): Omit<Screen, "path" | "rowActions"> {
  const main = document.querySelector("main")!;
  const visible = (el: Element) => {
    const box = (el as HTMLElement).getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };
  // A card's link reads its title, not the description under it
  const text = (el: Element) =>
    (el.getAttribute("aria-label") || (el as HTMLElement).innerText.split("\n").find((line) => line.trim()) || "")
      .replace(/\s+/g, " ")
      .trim();
  // Amounts, dates and counts belong to the sample data, not to the screen
  const isData = (value: string) =>
    /^Cuenta de |^Copiar casilla |^\dT |€|\b20\d\d\b|\d+ (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b|\(\d+\)|·\s*\d|^\d+$/i.test(
      value,
    );
  const skip = (el: Element) =>
    !visible(el) || el.closest("tbody, thead, [role='dialog'], [role='menu'], svg, .recharts-wrapper, li a") !== null;

  const title = text(main.querySelector("h1") ?? main);
  const header = main.querySelector("h1")?.closest("header") ?? main.querySelector("h1")?.parentElement?.parentElement;
  const actions: string[] = [];
  const sections: Section[] = [{ title: "", items: [] }];
  const links: string[] = [];
  const seen = new Set<string>();

  // Names in «» are buttons and links; the checks look at the name inside
  const add = (list: string[], raw: string) => {
    const quoted = raw.startsWith("«");
    const value = raw
      .replace(/^«|»$/g, "")
      .replace(/, \d+ sin leer$/, "")
      .replace(/\b\d+ PDF\b/, "los PDF");
    const help = value.startsWith("(ayuda: ");
    if (!value || (!help && value.length > 90) || isData(value) || seen.has(value)) return;
    seen.add(value);
    list.push(quoted ? `«${value}»` : value);
  };

  for (const el of main.querySelectorAll(
    "h2, h3, label, legend, button, a[href], [role='switch'], [role='radio'], [role='tab'], input[type='checkbox']",
  )) {
    if (skip(el)) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === "h2") {
      sections.push({ title: text(el).replace(/\s*·?\s*\b20\d\d\b/g, ""), items: [] });
      continue;
    }
    const value = text(el);
    if (!value || value === title || value === "Asistente" || value === "Más información") continue;
    const current = sections.at(-1)!;
    if (current.title && value === current.title) continue;
    if (header?.contains(el) && (tag === "button" || tag === "a")) {
      add(actions, value);
      continue;
    }
    if (tag === "h3") add(current.items, `${value}:`);
    else if (tag === "label" || tag === "legend") {
      // A HelpTip right after the label explains the field
      const required = /\*\s*$/.test(value);
      add(current.items, `${value.replace(/\s*\*\s*$/, "")}${required ? " (obligatorio)" : ""}`);
    } else if (tag === "a") {
      add(current.items, `«${value}»`);
    } else if (el.getAttribute("role") === "radio" || el.getAttribute("role") === "tab") add(current.items, value);
    else if (tag === "button" && value.length > 60) add(current.items, `(ayuda: ${value})`);
    else add(current.items, `«${value}»`);
  }
  // Every page it links to, rows and lists included, to walk next
  for (const a of main.querySelectorAll("a[href^='/']"))
    links.push(a.getAttribute("href")!.replace(/^\/demo(?=\/|$)/, "") || "/");
  return { title, actions, sections: sections.filter((s) => s.items.length > 0), links };
}

/** The options behind each menu button in the screen's header. */
async function headerMenus(page: Page): Promise<string[]> {
  const out: string[] = [];
  const buttons = page.locator("main header [aria-haspopup='menu'], main h1 ~ * [aria-haspopup='menu']");
  for (let i = 0; i < (await buttons.count()); i++) {
    const button = buttons.nth(i);
    if (!(await button.isVisible())) continue;
    const name = (await button.getAttribute("aria-label")) ?? (await button.innerText());
    if (name.startsWith("Cuenta de ")) continue;
    const items = await menuItems(page, () => button.click());
    if (items.length > 0) out.push(`«${name.trim()}»: ${items.map((item) => `«${item}»`).join(", ")}`);
  }
  return out;
}

async function menuItems(page: Page, open: () => Promise<void>): Promise<string[]> {
  try {
    await open();
    const menu = page.locator("[role='menu']").last();
    await menu.waitFor({ timeout: 2000 });
    const items = (await menu.locator("[role='menuitem'], [role='menuitemradio']").allInnerTexts())
      .map((item) => item.replace(/\s+/g, " ").trim())
      // Item names that carry a document's number: keep the action
      .map((item) => item.replace(/\s+\(.*\)$/, "").replace(/(\s+\S*\d\S*)+$/, ""))
      .filter(Boolean);
    await page.keyboard.press("Escape");
    return items;
  } catch {
    await page.keyboard.press("Escape");
    return [];
  }
}

/** What the first row of a list offers in its menu, the same for every row. */
async function rowActions(page: Page): Promise<string[]> {
  const button = page.locator("main tbody tr").first().locator("[aria-haspopup='menu']").last();
  if ((await button.count()) === 0 || !(await button.isVisible())) return [];
  return menuItems(page, () => button.click());
}

/**
 * Which page a link leads to, or null for one record or a page outside the app. A period in the
 * query is a page of its own (a tax form's boxes rather than its introduction), once for a
 * quarter and once for a year.
 */
function pageKey(link: string): string | null {
  const url = new URL(link, "http://app");
  if (!link.startsWith("/") || url.hash) return null;
  if (url.pathname.split("/").some((segment) => /\d/.test(segment) || /^[0-9a-f-]{20,}$/.test(segment))) return null;
  const params = [...url.searchParams.keys()];
  if (params.length === 0) return url.pathname;
  if (params.length > 1 || params[0] !== "periodo") return null;
  return `${url.pathname}?periodo=${/T\d$/.test(url.searchParams.get("periodo")!) ? "trimestre" : "año"}`;
}

function render(screens: Screen[]): string {
  const lines = [
    "---",
    'title: "Pantallas de la aplicación"',
    'label: "Pantallas"',
    'description: "Qué hay en cada pantalla de cuentalibre: sus secciones, campos, botones y menús."',
    "section: guide",
    "order: 11",
    "---",
    "",
    "<!-- Written by apps/web/scripts/screens.ts from the demo. Don't edit it by hand: run `pnpm --filter @cuentalibre/web screens`. -->",
    "",
    "Cada pantalla de cuentalibre, tal y como se ve en el ordenador: su título, sus botones y menús, y sus secciones con los campos que tienen. Los campos marcados como obligatorios llevan un asterisco en la aplicación. En el móvil las pantallas tienen lo mismo, con la acción principal en el botón **+** de arriba a la derecha.",
    "",
  ];
  for (const screen of screens) {
    const period = /[?&]periodo=([^&]+)/.exec(screen.path)?.[1];
    const title = period ? `${screen.title} (${/T\d$/.test(period) ? "un trimestre" : "el año"})` : screen.title;
    lines.push(`## ${title}`, "", `Dirección: ${screen.path}`, "");
    if (screen.actions.length > 0) lines.push(`- Botones de arriba: ${screen.actions.join("; ")}.`);
    if (screen.rowActions.length > 0)
      lines.push(`- Menú de tres puntos de cada fila: ${screen.rowActions.map((a) => `«${a}»`).join(", ")}.`);
    for (const section of screen.sections)
      lines.push(`- ${section.title ? `${section.title}: ` : ""}${section.items.join(", ")}.`);
    lines.push("");
  }
  return lines.join("\n");
}

const server = await createServer({ root: ROOT, logLevel: "error", server: { port: 5199 } });
await server.listen();
const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
const nav = (await server.ssrLoadModule(
  "/src/components/layout/nav.ts",
)) as typeof import("../src/components/layout/nav");
const browser = await chromium.launch();

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
  });
  // The demo's data and periods follow today's date: a fixed one keeps the page the same from run to run
  await page.clock.setFixedTime(new Date("2026-11-15T10:00:00+01:00"));
  // The first-run tour would cover the screens
  await page.addInitScript(() => sessionStorage.setItem("cuentalibre:demo-tour", "skipped"));
  const queue = [
    "/",
    ...nav.allNavLeaves.map((leaf) => leaf.to),
    ...nav.createActions.flat().map((action) => action.to),
  ];
  const visited = new Set<string>();
  const screens: Screen[] = [];
  while (queue.length > 0) {
    const path = queue.shift()!;
    const key = pageKey(path);
    if (key === null || visited.has(key)) continue;
    visited.add(key);
    await page.goto(`${origin}${DEMO}${path === "/" ? "" : path}`);
    await page.locator("main h1").first().waitFor({ state: "attached", timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    const url = new URL(page.url());
    const landed = (url.pathname.replace(/^\/demo/, "") || "/") + url.search;
    if (landed !== path) continue; // A redirect: the page it lands on is walked on its own
    const read = await page.evaluate(readScreen);
    const menus = await headerMenus(page);
    const screen: Screen = {
      path,
      title: read.title,
      actions: [...read.actions.map((a) => `«${a}»`).filter((a) => !menus.some((m) => m.startsWith(a))), ...menus],
      sections: read.sections,
      rowActions: await rowActions(page),
      links: read.links,
    };
    // A period that shows the same as the page without it adds nothing
    const same = (other: Screen) =>
      JSON.stringify([other.title, other.actions, other.sections]) ===
      JSON.stringify([screen.title, screen.actions, screen.sections]);
    if (!screens.some(same)) screens.push(screen);
    queue.push(...read.links);
  }
  const markdown = render(screens);
  if (process.argv.includes("--check")) {
    if (readFileSync(OUTPUT, "utf8") !== markdown) {
      console.error(`${OUTPUT} is out of date: run \`pnpm --filter @cuentalibre/web screens\` and commit it.`);
      process.exitCode = 1;
    }
  } else writeFileSync(OUTPUT, markdown);
  console.log(`${screens.length} screens.`);
} finally {
  await browser.close();
  await server.close();
}
