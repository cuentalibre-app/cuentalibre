/**
 * Shared class names for data tables: a clear header and soft rules between
 * rows and columns, so the figures carry the weight. Use with a `border-collapse` table.
 */
export const table = {
  headRow: "bg-muted text-left font-mono text-2xs tracking-wide text-foreground uppercase",
  th: "border-b border-border px-3 py-2 font-semibold first:pl-5 last:pr-5",
  row: "border-b border-divider transition-colors duration-150 last:border-b-0 hover:bg-muted",
  td: "px-3 py-2.5 first:pl-5 last:pr-5",
  /**
   * For a secondary column's cells: hidden while the page is narrow (the app's <main> is the
   * container), so the table fits beside the docked assistant without scrolling sideways.
   */
  wideOnly: "@max-5xl:hidden",
};
