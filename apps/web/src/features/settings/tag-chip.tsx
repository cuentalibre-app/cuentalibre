import type { ReactNode } from "react";
import { cn } from "@fiscalia/ui/lib/cn";
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
