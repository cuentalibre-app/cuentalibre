import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * The user guide names the app's menus, buttons and fields in bold, and the help chat repeats
 * those names. Each one must still be in the app: on the screens the guide's generated pages
 * list (mapa.md, pantallas.md), or in the web app's code for those they don't reach, such as
 * dialogs and statuses. Renaming or removing a button then fails here until the guide follows.
 */

const GUIDE = fileURLToPath(new URL("../../site/src/content/docs/guia/", import.meta.url));
const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const GENERATED = ["mapa.md", "pantallas.md"];

/** Bold text that names no single thing on screen. */
const NOT_NAMES = new Set([
  // An example of a button whose name carries the quarter: "Cerrar el {name}"
  "Cerrar el 3T 2026",
  // A part of the tax form pages, described in the guide's words
  "El resultado",
]);

const sourceText = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."))
  .map((file) => readFileSync(`${SRC}${file}`, "utf8"))
  .join("\n");
const generated = GENERATED.map((file) => readFileSync(`${GUIDE}${file}`, "utf8")).join("\n");

const guidePages = readdirSync(GUIDE).filter((file) => file.endsWith(".md") && !GENERATED.includes(file));

describe("the user guide", () => {
  it.each(guidePages)("%s names only what the app has", (file) => {
    const names = [...readFileSync(`${GUIDE}${file}`, "utf8").matchAll(/\*\*([^*]+)\*\*/g)]
      // "Configuración › Facturas" is a path of names; a trailing colon or full stop is the guide's
      .flatMap(([, bold]) => bold!.replace(/[:.]\s*$/, "").split(" › "))
      .map((name) => name.trim());
    const missing = names.filter(
      (name) => !NOT_NAMES.has(name) && !generated.includes(name) && !sourceText.includes(name),
    );
    expect(missing).toEqual([]);
  });
});
