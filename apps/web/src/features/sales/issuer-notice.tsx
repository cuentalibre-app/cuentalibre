import { CircleAlert } from "lucide-react";
import { SettingsLink } from "@/features/settings/settings-parts";
import { BUSINESS_PATH } from "@/features/settings/settings-model";

export const ISSUER_NOTICE_ID = "issuer-notice";

/**
 * Shown where an invoice can be issued while the business profile lacks what
 * names the issuer: the server refuses to issue until it's filled in.
 */
export function IssuerNotice({ missing, from }: { missing: string; from: string }) {
  return (
    <p
      id={ISSUER_NOTICE_ID}
      role="status"
      tabIndex={-1}
      className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-warning-soft px-4 py-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <CircleAlert className="size-4 shrink-0 text-warning" strokeWidth={1.8} aria-hidden="true" />
      <span>Para emitir facturas, tu empresa necesita {missing}.</span>
      <SettingsLink
        to={BUSINESS_PATH}
        from={from}
        className="font-medium text-primary no-underline hover:text-primary-hover"
      >
        Completar datos de la empresa
      </SettingsLink>
    </p>
  );
}
