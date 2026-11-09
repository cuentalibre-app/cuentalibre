/**
 * Shared class names for data tables: a quiet header and soft rules between
 * rows and columns, so the figures carry the weight. Use with a `border-collapse` table.
 */
export const table = {
  headRow: "text-left text-xs text-foreground",
  th: "border-b border-l border-border first:border-l-0 px-3 py-2.5 font-semibold first:pl-5 last:pr-5",
  row: "border-b border-divider transition-colors duration-150 last:border-b-0 hover:bg-muted",
  td: "border-l border-border first:border-l-0 px-3 py-3 first:pl-5 last:pr-5",
};
