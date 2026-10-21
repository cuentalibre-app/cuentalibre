import { useEffect, useState, type ReactNode } from "react";
import { Link, useBlocker, useLocation, type LinkProps } from "react-router";
import { ArrowLeft, Check } from "lucide-react";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { cn } from "@cuentalibre/ui/lib/cn";
import { sameValue } from "@/lib/same-value";
import { SETTINGS_PATH } from "./settings-model";

/* Building blocks shared by the settings pages. */

/** The page a settings page was opened from: its back button returns there. */
interface Origin {
  path: string;
  /** Where the back button goes, as in "Volver a Bancos". */
  label: string;
}

/** A link into a settings page from elsewhere in the app. That page's back button comes back here. */
export function SettingsLink({ from, ...props }: LinkProps & { from: string }) {
  const { pathname, search } = useLocation();
  const origin: Origin = { path: pathname + search, label: from };
  return <Link {...props} state={{ from: origin }} />;
}

export function SettingsHeader({
  title,
  description,
  back = SETTINGS_PATH,
  children,
}: {
  title: string;
  description?: string;
  back?: string;
  /** Actions at the end of the header, such as the save button. */
  children?: ReactNode;
}) {
  const origin = (useLocation().state as { from?: Origin } | null)?.from;
  const backLabel = `Volver a ${origin?.label ?? "configuración"}`;
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to={origin?.path ?? back}
          aria-label={backLabel}
          title={backLabel}
          className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-10 no-underline")}
        >
          <ArrowLeft strokeWidth={1.8} aria-hidden="true" />
        </Link>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="m-0 truncate text-2xl font-semibold tracking-tight lg:text-3xl">{title}</h1>
          {description && <p className="m-0 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}

/**
 * A copy of saved settings to edit, applied on save. `dirty` compares by value so undoing a
 * change disables the button again.
 */
export function useDraft<T>(saved: T) {
  const [draft, setDraft] = useState<T>(saved);
  const [justSaved, setJustSaved] = useState(false);
  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setJustSaved(false);
  };
  return {
    draft,
    setDraft,
    set,
    dirty: !sameValue(draft, saved),
    justSaved,
    markSaved: () => setJustSaved(true),
  };
}

export function SaveButton({ dirty, justSaved, onSave }: { dirty: boolean; justSaved: boolean; onSave: () => void }) {
  return (
    <>
      {justSaved && !dirty && (
        <span role="status" className="flex items-center gap-1.5 text-sm text-success">
          <Check className="size-4" aria-hidden="true" />
          Cambios guardados
        </span>
      )}
      <Button onClick={onSave} disabled={!dirty}>
        Guardar cambios
      </Button>
    </>
  );
}

/** Asks before leaving the page, or closing the tab, while there are unsaved changes. */
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <ConfirmDialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => !open && blocker.state === "blocked" && blocker.reset()}
      title="¿Salir sin guardar?"
      confirmLabel="Salir sin guardar"
      danger
      onConfirm={() => blocker.proceed?.()}
    >
      <p className="m-0">Tienes cambios sin guardar en esta página. Si sales, se perderán.</p>
    </ConfirmDialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col gap-2">{children}</div>
        </DialogDescription>
        <div className="flex justify-end gap-2.5 pt-1">
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            variant={danger ? "destructive" : "primary"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
