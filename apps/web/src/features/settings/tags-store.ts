import { useSyncExternalStore } from "react";
import { initialTags, type Tag } from "@/mocks/tags";

/**
 * The tag list with its colors. Documents and contacts store tag names; a name that isn't
 * here still works, it's just shown with the neutral color.
 */
let tags = initialTags;
const listeners = new Set<() => void>();

function commit(next: Tag[]) {
  tags = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTags(): Tag[] {
  return useSyncExternalStore(subscribe, () => tags);
}

const key = (name: string) => name.trim().toLocaleLowerCase("es");

export const tagsStore = {
  get: () => tags,
  find: (name: string) => tags.find((t) => key(t.name) === key(name)),
  add: (tag: Tag) => commit([...tags, tag]),
  update: (id: string, changes: Partial<Tag>) => commit(tags.map((t) => (t.id === id ? { ...t, ...changes } : t))),
  remove: (id: string) => commit(tags.filter((t) => t.id !== id)),
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
