import { describe, expect, it } from "vitest";
import { LANGUAGES } from "./index";

type Messages = { [key: string]: string | Messages };

const locales = import.meta.glob<Messages>("./locales/*.json", { eager: true, import: "default" });
const read = (file: string) => locales[`./locales/${file}`]!;

/** Every text as `path.to.key` → text. */
function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const entries = Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [[prefix + key, value] as const] : [...flatten(value, `${prefix}${key}.`)],
  );
  return new Map(entries);
}

/** Languages split plurals into different forms (`_one`, `_few`…), so keys compare without them. */
const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, "");
const variables = (text: string) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort();

const source = flatten(read("es.json"));
const sourceKeys = new Set([...source.keys()].map(base));
const files = Object.keys(locales)
  .map((path) => path.replace("./locales/", ""))
  .filter((file) => file !== "es.json");

describe("translations", () => {
  it("has a file for every published language", () => {
    for (const { code } of LANGUAGES) {
      expect(read(`${code}.json`)).toBeDefined();
    }
  });

  // A language may be partial (missing texts show in Spanish), but never invent keys or variables
  describe.each(files)("%s", (file) => {
    const translation = flatten(read(file));

    it("only translates keys the Spanish source has", () => {
      expect([...translation.keys()].filter((key) => !sourceKeys.has(base(key)))).toEqual([]);
    });

    it("keeps the variables of each text", () => {
      for (const [key, text] of translation) {
        expect(variables(text), key).toEqual(variables(source.get(key) ?? source.get(`${base(key)}_other`) ?? ""));
      }
    });
  });
});
