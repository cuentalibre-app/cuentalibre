import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge must know our custom type scale so it doesn't confuse
// text-md / text-2xs (font size) with text-primary (color).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["2xs", "xs", "sm", "base", "md", "lg", "xl", "2xl", "3xl", "4xl"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
