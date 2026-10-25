import { CircleAlert } from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";

/**
 * Shown where an invoice can be issued while the business profile lacks what
 * names the issuer: the server refuses to issue until it's filled in.
 */
export function IssuerNotice({ missing, onComplete }: { missing: string; onComplete: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg bg-warning-soft px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center"
    >
      <p className="m-0 flex flex-1 gap-2">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.8} aria-hidden="true" />
        <span>
          <strong className="font-semibold">Aún no puedes emitir facturas.</strong> A tu empresa le {missing}.
        </span>
      </p>
      <Button size="sm" variant="secondary" className="self-start sm:self-auto" onClick={onComplete}>
        Completar datos
      </Button>
    </div>
  );
}
