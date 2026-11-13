import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import { ExternalLink, Loader2, Paperclip, ScanText, Trash2, Upload } from "lucide-react";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatFileSize, parseDecimal } from "@/lib/format";
import { isValidImputation } from "@cuentalibre/core";
import type { Attachment } from "@cuentalibre/contracts";
import { attachFile, attachmentUrl, discardAttachments, filesAreStored } from "@/data/files";
import { isReadable } from "./reading-model";

/* Form building blocks shared by received invoices and expenses. Tooltips need a TooltipProvider above. */

/** A whole percentage between 0 and 100, or null. */
export function parseImputation(text: string): number | null {
  const value = parseDecimal(text);
  return value !== null && isValidImputation(value) ? value : null;
}

export function PercentInput({
  value,
  onChange,
  placeholder,
  ...props
}: {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <span className="relative flex w-32 items-center">
      <Input
        {...props}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="pr-8 text-right amount"
      />
      <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground" aria-hidden="true">
        %
      </span>
    </span>
  );
}

/**
 * The supplier's PDF or a photo of the receipt. With an API, picked files are uploaded when the record
 * that names them is saved; otherwise they stay in this browser tab. With `onRead`, each PDF or photo
 * can be read with AI to fill in the form; `readingId` is the one being read.
 */
export function ReceiptDrop({
  attachments,
  onChange,
  prompt = "Arrastra aquí la factura del proveedor",
  label = "Justificante",
  pickLabel = "Adjuntar justificante",
  note,
  accept = "application/pdf,image/*",
  onRead,
  readingId,
}: {
  attachments: Attachment[];
  onChange: (a: Attachment[]) => void;
  prompt?: string;
  label?: string;
  /** Phones have nothing to drag from: they get a button with this text instead of the drop area. */
  pickLabel?: string;
  note?: string;
  accept?: string;
  onRead?: (attachment: Attachment) => void;
  readingId?: string;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const add = (files: FileList | null) => {
    if (!files?.length) return;
    onChange([...attachments, ...Array.from(files).map(attachFile)]);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    add(e.dataTransfer.files);
  };
  return (
    <section aria-label={label} className="flex animate-rise-in flex-col gap-3" style={{ "--i": 0 } as CSSProperties}>
      <Button variant="secondary" className="self-start lg:hidden" onClick={() => inputRef.current?.click()}>
        <Paperclip strokeWidth={1.8} aria-hidden="true" />
        {pickLabel}
      </Button>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-5 py-6 text-center transition-colors duration-150 max-lg:hidden",
          over && "border-primary bg-primary-soft",
        )}
      >
        <Upload className="size-5 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        <p className="m-0 font-medium">
          {prompt} o{" "}
          <Button variant="link" onClick={() => inputRef.current?.click()}>
            elige un archivo
          </Button>
        </p>
        <p className="m-0 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ScanText className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          {note ??
            (onRead
              ? "PDF o imagen. Se leen sus datos con IA para rellenar el formulario."
              : filesAreStored()
                ? "PDF o imagen."
                : "PDF o imagen. Se guarda solo en esta sesión.")}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {attachments.length > 0 && (
        <AttachmentList
          attachments={attachments}
          onRead={onRead}
          readingId={readingId}
          onRemove={(a) => {
            onChange(attachments.filter((x) => x.id !== a.id));
            discardAttachments([a]);
          }}
        />
      )}
    </section>
  );
}

/**
 * Attached files, each one opened in a new tab; `onRemove` adds a button to take it off,
 * and `onRead` one to read a PDF or photo with AI.
 */
export function AttachmentList({
  attachments,
  onRemove,
  onRead,
  readingId,
}: {
  attachments: Attachment[];
  onRemove?: (attachment: Attachment) => void;
  onRead?: (attachment: Attachment) => void;
  readingId?: string;
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {attachments.map((a) => {
        const url = attachmentUrl(a);
        return (
          <li key={a.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <Paperclip className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{a.name}</span>
            <span className="text-xs text-muted-foreground">{formatFileSize(a.size)}</span>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener"
                aria-label={`Abrir ${a.name}`}
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              >
                <ExternalLink strokeWidth={1.8} aria-hidden="true" />
              </a>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="text-xs text-muted-foreground">
                    No disponible
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  El archivo se adjuntó en otra sesión y no se guardó; vuelve a adjuntarlo.
                </TooltipContent>
              </Tooltip>
            )}
            {onRead && isReadable(a.name) && (
              <Button
                variant="ghost"
                size="sm"
                disabled={readingId !== undefined}
                onClick={() => onRead(a)}
                aria-label={`Leer los datos de ${a.name}`}
              >
                {readingId === a.id ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <ScanText strokeWidth={1.8} aria-hidden="true" />
                )}
                <span className="max-sm:sr-only">Leer datos</span>
              </Button>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Quitar ${a.name}`}
                onClick={() => onRemove(a)}
                className="hover:text-destructive"
              >
                <Trash2 strokeWidth={1.8} aria-hidden="true" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The files kept with a record: drop or pick them, then open or
 * remove the ones already attached. Each change is saved at once through `onChange`.
 */
export function AttachmentsDialog({
  title,
  attachments,
  examples,
  onChange,
  onOpenChange,
}: {
  /** "Documentos de la factura 2026-0046". */
  title: string;
  attachments: Attachment[];
  /** What usually goes here: "Contratos, albaranes firmados…". */
  examples: string;
  onChange: (attachments: Attachment[] | undefined) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Los archivos se guardan en cuanto los añades.</DialogDescription>
        <ReceiptDrop
          attachments={attachments}
          onChange={(next) => onChange(next.length ? next : undefined)}
          label="Documentos adjuntos"
          pickLabel="Adjuntar documentos"
          prompt="Arrastra aquí los archivos"
          accept=""
          note={filesAreStored() ? examples : `${examples} Se guardan solo en esta sesión.`}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
