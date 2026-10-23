import type { Tag } from "@cuentalibre/contracts";
import { createCollection } from "@/data/collection";
import { syncCollection } from "@/data/sync";
import { initialTags } from "@/mocks/tags";

/**
 * The tag list with its colors. Documents and contacts store tag names; a name that isn't
 * here still works, it's just shown with the neutral color.
 */
const tags = createCollection<Tag>("tags", initialTags);
syncCollection("tags", tags);

export function useTags(): Tag[] {
  return tags.use();
}

/** Colors offered when creating a tag; any other can be picked in Configuración › Etiquetas. */
export const TAG_SWATCHES = [
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#fee2e2",
  "#ede9fe",
  "#fce7f3",
  "#e5e7eb",
  "#334155",
  "#2f45c9",
];

/** The swatch for the next new tag, so consecutive tags don't all look alike. */
export const nextTagColor = () => TAG_SWATCHES[tags.all().length % TAG_SWATCHES.length]!;

const key = (name: string) => name.trim().toLocaleLowerCase("es");

export const tagsStore = {
  get: tags.all,
  find: (name: string) => tags.all().find((t) => key(t.name) === key(name)),
  add: tags.add,
  update: tags.update,
  remove: tags.remove,
};

/** Black or white text, whichever reads better on the background (WCAG relative luminance). */
export function textColorOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#000000";
  const n = parseInt(m[1]!, 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  // Contrast with black is (l + 0.05) / 0.05, with white 1.05 / (l + 0.05): they cross at l ≈ 0.179
  return l > 0.179 ? "#000000" : "#ffffff";
}
