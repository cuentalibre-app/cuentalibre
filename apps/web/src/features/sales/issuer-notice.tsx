import { Button } from "@cuentalibre/ui/components/button";
import { Notice } from "@/components/page";

/**
 * Shown where an invoice can be issued while the business profile lacks what
 * names the issuer: the server refuses to issue until it's filled in.
 */
export function IssuerNotice({ missing, onComplete }: { missing: string; onComplete: () => void }) {
  return (
    <Notice role="status" tone="warning">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="m-0 flex-1">
          <strong className="font-semibold">Aún no puedes emitir facturas.</strong> A tu empresa le {missing}.
        </p>
        <Button size="sm" variant="secondary" className="self-start sm:self-auto" onClick={onComplete}>
          Completar datos
        </Button>
      </div>
    </Notice>
  );
}
