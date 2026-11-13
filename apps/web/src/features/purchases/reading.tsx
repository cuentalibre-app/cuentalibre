import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Loader2, ScanText } from "lucide-react";
import type { Attachment, PurchaseExtraction } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { Notice } from "@/components/page";
import { currentBackend } from "@/data/backend";
import { readAttachment, readingError } from "@/data/extraction";
import { attachFile } from "@/data/files";
import { signInMethods } from "@/features/auth/auth-api";

/*
 * Reading a received invoice or receipt with AI in the purchase forms: the
 * reading's state, the notice that reports it, and the hand-off of a file
 * between pages (from a list's button, or to the form that suits it better).
 */

/** Whether this server reads documents with AI. False until it says so, and without a server. */
export function useCanReadDocuments(): boolean {
  const [can, setCan] = useState(false);
  useEffect(() => {
    if (!currentBackend().extractPurchase) return;
    let live = true;
    void signInMethods().then((methods) => live && setCan(methods.ai));
    return () => {
      live = false;
    };
  }, []);
  return can;
}

export type ReadingState =
  | { status: "idle" }
  | { status: "reading"; attachment: Attachment }
  | { status: "failed"; attachment: Attachment; message: string }
  | { status: "done"; attachment: Attachment; extraction: PurchaseExtraction };

/**
 * Reads attachments and hands each result to `apply`. A reading started later
 * wins over an earlier one still on its way, and none lands after the form is gone.
 */
export function useReading(apply: (extraction: PurchaseExtraction, attachment: Attachment) => void) {
  const available = useCanReadDocuments();
  const [state, setState] = useState<ReadingState>({ status: "idle" });
  const latest = useRef(0);
  const mounted = useRef(false);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const done = useCallback((attachment: Attachment, extraction: PurchaseExtraction) => {
    setState({ status: "done", attachment, extraction });
    applyRef.current(extraction, attachment);
  }, []);

  const read = useCallback(
    async (attachment: Attachment) => {
      const token = ++latest.current;
      setState({ status: "reading", attachment });
      try {
        const extraction = await readAttachment(attachment);
        if (token === latest.current && mounted.current) done(attachment, extraction);
      } catch (error) {
        if (token === latest.current && mounted.current)
          setState({ status: "failed", attachment, message: readingError(error) });
      }
    },
    [done],
  );

  return { available, state, read, done };
}

/** How the last reading went, above the form. `children` sums up a finished one. */
export function ReadingNotice({
  state,
  onRetry,
  tone,
  children,
}: {
  state: ReadingState;
  onRetry: () => void;
  tone: "success" | "warning";
  children: ReactNode;
}) {
  if (state.status === "reading")
    return (
      <Notice role="status" tone="muted" icon={Loader2} className="[&>svg]:animate-spin">
        Leyendo {state.attachment.name}…
      </Notice>
    );
  if (state.status === "failed")
    return (
      <Notice role="alert" tone="danger">
        {state.message}{" "}
        <Button variant="link" onClick={onRetry}>
          Volver a intentarlo
        </Button>
      </Notice>
    );
  if (state.status === "done")
    return (
      <Notice role="status" tone={tone}>
        {children}
      </Notice>
    );
  return null;
}

interface Handoff {
  attachment: Attachment;
  /** Already read: the form takes the result instead of reading again. */
  extraction?: PurchaseExtraction;
}

/** The last file handed to a form, by the attachment's ID in the `leer` parameter. */
let handoff: Handoff | null = null;

/** Opens a form with this file, read or to be read. */
export function handOff(next: Handoff) {
  handoff = next;
}

/** The file handed to the form with this ID, if it is still the last one. */
export const handedOff = (id: string | null) => (id && handoff?.attachment.id === id ? handoff : null);

/**
 * Takes the file handed to a new form once: attaches it and reads it, or applies
 * the reading it came with. Run from an effect, so the attachment isn't discarded
 * by the development build's extra unmount.
 */
export function useHandoff(
  id: string | null,
  attach: (attachment: Attachment) => void,
  reading: ReturnType<typeof useReading>,
) {
  const taken = useRef(false);
  useEffect(() => {
    const given = handedOff(id);
    if (taken.current || !given) return;
    taken.current = true;
    attach(given.attachment);
    if (given.extraction) reading.done(given.attachment, given.extraction);
    else void reading.read(given.attachment);
    // Only on arrival
  }, []);
}

/**
 * A list's button that picks a PDF or photo and opens the new form to read it.
 * Disabled, with the reason, where the server can't read documents.
 */
export function ReadDocumentButton({ label, formPath }: { label: string; formPath: string }) {
  const navigate = useNavigate();
  const available = useCanReadDocuments();
  const inputRef = useRef<HTMLInputElement>(null);
  if (!available)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* aria-disabled keeps the tooltip reachable, unlike disabled */}
          <Button variant="secondary" aria-disabled className="hidden cursor-not-allowed opacity-50 lg:inline-flex">
            <ScanText strokeWidth={1.8} aria-hidden="true" />
            {label}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          {currentBackend().extractPurchase
            ? "Este servidor no tiene configurado un modelo de IA para leer documentos."
            : "Disponible con una cuenta: lee los datos del PDF o de la foto por ti."}
        </TooltipContent>
      </Tooltip>
    );
  return (
    <>
      <Button variant="secondary" className="hidden lg:inline-flex" onClick={() => inputRef.current?.click()}>
        <ScanText strokeWidth={1.8} aria-hidden="true" />
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const attachment = attachFile(file);
          handOff({ attachment });
          navigate(`${formPath}?leer=${attachment.id}`);
        }}
      />
    </>
  );
}

/**
 * Sends a file already read to the other purchase form. It was stored to be read, so
 * the new form opens the stored copy: this form's own one goes when it is left.
 */
export function useSendToForm() {
  const navigate = useNavigate();
  return (formPath: string, attachment: Attachment, extraction: PurchaseExtraction) => {
    const stored = { ...attachment, url: undefined };
    handOff({ attachment: stored, extraction });
    navigate(`${formPath}?leer=${stored.id}`);
  };
}
