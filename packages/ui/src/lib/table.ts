/**
 * Shared class names for data tables: full grid lines (rows and columns)
 * and a tinted header, so long rows of figures stay easy to scan.
 * Use with a `border-collapse` table.
 */
export const table = {
  headRow: "bg-muted text-left text-xs tracking-wide text-muted-foreground uppercase",
  th: "border-y border-l border-border px-3 py-2 font-medium first:border-l-0 first:pl-4 last:pr-4",
  row: "border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-muted/50",
  td: "border-l border-border px-3 py-2 first:border-l-0 first:pl-4 last:pr-4",
};
