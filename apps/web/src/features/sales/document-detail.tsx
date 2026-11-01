import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { FileDown, Pencil } from "lucide-react";
import { quarterOfDate } from "@cuentalibre/core";
import type { SalesDocument } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatDate, periodCode } from "@/lib/format";
import {
  AttachmentsSection,
  ContactDetails,
  DetailFooter,
  DetailLink,
  DetailList,
  DetailSection,
  focusPanel,
  LinesTable,
  PaymentsTable,
  TotalsList,
  yesNo,
} from "./detail-parts";
import { LANGUAGES, NUMBER_FORMATS } from "./invoice-locale";
import { VerifactuState } from "./issued-notice";
import {
  INCOME_TYPE_GROUPS,
  KINDS,
  OPERATION_TYPES,
  RECTIFICATION_METHODS,
  RECTIFICATION_REASONS,
  STATUS,
  WITHHOLDING_GROUPS,
  clientOf,
  displayStatus,
  documentTotals,
  printedDocument,
} from "./sales-model";
import { useSalesDocuments } from "./sales-store";

const optionLabel = (groups: { options: { value: string; label: string }[] }[], value: string) =>
  groups.flatMap((g) => g.options).find((o) => o.value === value)?.label ?? value;

/** The number of a sales document in a list, opening its detail on click. */
export function SalesDocumentLink({
  doc,
  className,
  children,
}: {
  doc: SalesDocument;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DetailLink to={`${KINDS[doc.kind].path}/${doc.id}`} onOpen={() => setOpen(true)} className={className}>
        {children}
      </DetailLink>
      {open && <SalesDocumentDialog doc={doc} onOpenChange={setOpen} />}
    </>
  );
}

/** Basic information of an invoice, draft, quote or delivery note, as the reference app's "Detalle de la factura". */
export function SalesDocumentDialog({
  doc,
  onOpenChange,
}: {
  doc: SalesDocument;
  onOpenChange: (open: boolean) => void;
}) {
  // Follows the store, so a collection registered from the list shows up while it is open
  const documents = useSalesDocuments();
  const current = documents.find((d) => d.id === doc.id) ?? doc;
  const config = KINDS[current.kind];
  const client = clientOf(current);
  const status = STATUS[displayStatus(current, new Date())];
  const isInvoice = current.kind === "invoice";
  const rectified = current.rectifiesId ? documents.find((d) => d.id === current.rectifiesId) : undefined;
  // A substitution shows the invoice that replaces the original, as printed
  const printed = printedDocument(current, rectified);
  const language = LANGUAGES.find((l) => l.value === current.language);
  const numberFormat = NUMBER_FORMATS[current.language ?? ""]?.find((f) => f.value === current.numberFormat);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-5" onOpenAutoFocus={focusPanel}>
        <div className="flex flex-col gap-1">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {config.singular} {current.number ?? "sin número"}
            <Badge tone={status.tone}>{status.label}</Badge>
          </DialogTitle>
          <DialogDescription>
            {client.name} · {formatDate(current.issuedOn)}
          </DialogDescription>
        </div>

        {current.issued?.verifactu && (
          <DetailSection title="VERI*FACTU">
            <VerifactuState invoice={current} title="" />
          </DetailSection>
        )}

        <DetailSection
          title={`Información ${config.noun.startsWith("el ") ? `del ${config.noun.slice(3)}` : `de ${config.noun}`}`}
        >
          <DetailList
            items={[
              ["Periodo", periodCode(quarterOfDate(current.issuedOn))],
              ["Número", current.number && <span className="font-mono">{current.number}</span>],
              ["Fecha", formatDate(current.issuedOn)],
              ...(config.dueLabel
                ? [[config.dueLabel, current.dueOn && formatDate(current.dueOn)] as [string, ReactNode]]
                : []),
              ...(rectified ? [["Rectifica a", rectified.number] as [string, ReactNode]] : []),
              ...(current.rectification
                ? ([
                    ["Motivo", RECTIFICATION_REASONS.find((r) => r.value === current.rectification!.reason)?.label],
                    ["Tipo", RECTIFICATION_METHODS.find((m) => m.value === current.rectification!.method)?.label],
                  ] as [string, ReactNode][])
                : []),
              ["Tipo de ingreso", optionLabel(INCOME_TYPE_GROUPS, current.incomeType)],
              ["Retención", optionLabel(WITHHOLDING_GROUPS, current.withholding)],
              ["Tipo de operación", OPERATION_TYPES.find((o) => o.value === current.operationType)?.label],
              ["Fecha de operación", current.operationOn && formatDate(current.operationOn)],
              ["Criterio de caja", yesNo(current.cashBasis)],
              ["Idioma", language?.label ?? "El del cliente"],
              ...(numberFormat ? [["Formato numérico", numberFormat.label] as [string, ReactNode]] : []),
              ["Notas en el documento", current.publicNotes.trim()],
              ["Notas privadas", current.privateNotes.trim()],
            ]}
          />
        </DetailSection>

        <DetailSection title="Cliente">
          <ContactDetails contact={client} />
        </DetailSection>

        <DetailSection title="Conceptos">
          <LinesTable lines={printed.lines} />
          <TotalsList totals={documentTotals(printed)} />
        </DetailSection>

        {isInvoice && (
          <DetailSection title="Cobros">
            <PaymentsTable payments={current.payments ?? []} empty="No se ha registrado ningún cobro." />
          </DetailSection>
        )}

        <AttachmentsSection attachments={current.attachments} />

        <DetailFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cerrar</Button>
          </DialogClose>
          <Button
            variant="secondary"
            onClick={() => void import("./sales-pdf").then((m) => m.downloadDocumentPdf(current))}
          >
            <FileDown strokeWidth={1.8} aria-hidden="true" />
            Descargar PDF
          </Button>
          <Link to={`${config.path}/${current.id}`} className={cn(buttonVariants(), "no-underline")}>
            <Pencil strokeWidth={1.8} aria-hidden="true" />
            {isInvoice ? "Ver los datos de la factura" : `Editar ${config.singular.toLowerCase()}`}
          </Link>
        </DetailFooter>
      </DialogContent>
    </Dialog>
  );
}
