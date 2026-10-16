import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import { ExternalLink, Paperclip, ScanText, Trash2, Upload } from "lucide-react";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { Input } from "@fiscalia/ui/components/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { parseDecimal } from "@/lib/format";
import type { Attachment } from "@/mocks/sales";
import { isValidImputation } from "@fiscalia/core";

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
 * The supplier's PDF or a photo of the receipt. Files stay in this browser tab (object URLs) until
 * there is file storage; reading the data from them (OCR) needs the backend too.
 */
export function ReceiptDrop({
  attachments,
  onChange,
  prompt = "Arrastra aquí la factura del proveedor",
}: {
  attachments: Attachment[];
  onChange: (a: Attachment[]) => void;
  prompt?: string;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const add = (files: FileList | null) => {
    if (!files?.length) return;
    onChange([
      ...attachments,
      ...Array.from(files).map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        url: URL.createObjectURL(f),
      })),
    ]);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    add(e.dataTransfer.files);
  };
  return (
    <section
      aria-label="Justificante"
      className="flex animate-rise-in flex-col gap-3"
      style={{ "--i": 0 } as CSSProperties}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-5 py-6 text-center transition-colors duration-150",
          over && "border-primary bg-primary-soft",
        )}
      >
        <Upload className="size-5 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        <p className="m-0 font-medium">
          {prompt} o{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer border-0 bg-transparent p-0 font-medium text-primary underline-offset-2 hover:underline"
          >
            elige un archivo
          </button>
        </p>
        <p className="m-0 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ScanText className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          PDF o imagen. Se guarda solo en esta sesión; la lectura automática de datos (OCR) llegará más adelante.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {attachments.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <span className="text-xs text-muted-foreground">{formatSize(a.size)}</span>
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Abrir ${a.name}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "size-8 px-0")}
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
                    El archivo se adjuntó en otra sesión; hará falta almacenamiento para verlo.
                  </TooltipContent>
                </Tooltip>
              )}
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Quitar ${a.name}`}
                onClick={() => onChange(attachments.filter((x) => x.id !== a.id))}
                className="size-8 px-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 strokeWidth={1.8} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
