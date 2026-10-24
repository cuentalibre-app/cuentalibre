import { legalUrl } from "@/components/legal-links";

/**
 * Creating an account accepts the terms: says so, after `lead`, with links to
 * them. Only shown where there are terms to accept.
 */
export function LegalConsent({ lead }: { lead: string }) {
  const terms = legalUrl("terminos");
  const privacy = legalUrl("privacidad");
  if (!terms || !privacy) return null;
  const link = "font-medium text-primary hover:text-primary-hover";
  return (
    <p className="m-0 text-sm text-muted-foreground">
      {lead}{" "}
      <a href={terms} target="_blank" rel="noreferrer" className={link}>
        términos del servicio
      </a>{" "}
      y la{" "}
      <a href={privacy} target="_blank" rel="noreferrer" className={link}>
        política de privacidad
      </a>
      .
    </p>
  );
}
