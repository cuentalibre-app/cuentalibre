import { cn } from "@cuentalibre/ui/lib/cn";

/**
 * The public site that hosts this instance's legal pages. Self-hosted
 * instances leave it unset: their owner, not cuentalibre, answers for them.
 */
const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "");

export const legalUrl = (path: "aviso-legal" | "privacidad" | "cookies" | "terminos") =>
  SITE_URL ? `${SITE_URL}/${path}` : undefined;

const pages = [
  { path: "aviso-legal", label: "Aviso legal" },
  { path: "privacidad", label: "Privacidad" },
  { path: "cookies", label: "Cookies" },
  { path: "terminos", label: "Términos" },
] as const;

/** A row of links to the legal pages; renders nothing without a site URL. */
export function LegalLinks({ className }: { className?: string }) {
  if (!SITE_URL) return null;
  return (
    <nav aria-label="Información legal" className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm", className)}>
      {pages.map((page) => (
        <a key={page.path} href={legalUrl(page.path)} className="text-muted-foreground hover:text-foreground">
          {page.label}
        </a>
      ))}
    </nav>
  );
}
