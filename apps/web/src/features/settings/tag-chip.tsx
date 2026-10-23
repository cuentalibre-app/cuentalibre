import type { ReactNode } from "react";
import { cn } from "@cuentalibre/ui/lib/cn";
import { textColorOn, useTags } from "./tags-store";

/**
 * A tag name in the color set under Configuración › Etiquetas. Tags not in the list use the
 * neutral surface. Size and spacing come from the caller.
 */
export function TagChip({
  name,
  as: Tag = "span",
  className,
  children,
}: {
  name: string;
  as?: "span" | "li";
  className?: string;
  /** Extra content after the name, such as a remove button. */
  children?: ReactNode;
}) {
  const key = name.trim().toLocaleLowerCase("es");
  const tag = useTags().find((t) => t.name.trim().toLocaleLowerCase("es") === key);
  return (
    <Tag
      className={cn("rounded-full font-medium", !tag && "bg-accent", className)}
      // The color is the user's choice, so it can't be a design token
      style={tag ? { backgroundColor: tag.color, color: textColorOn(tag.color) } : undefined}
    >
      {name}
      {children}
    </Tag>
  );
}

/** A record's tags, small, under its name or number in a list. */
export function TagChips({ tags, className }: { tags?: string[]; className?: string }) {
  if (!tags?.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-1 font-sans", className)}>
      {tags.map((t) => (
        <TagChip key={t} name={t} className="px-2 text-2xs leading-5" />
      ))}
    </span>
  );
}
