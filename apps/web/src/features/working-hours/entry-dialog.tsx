import { useState } from "react";
import { LogIn, LogOut, PenLine } from "lucide-react";
import { clockTime, entryDate, entryError, openEntry, type TimeEntry } from "@fiscalia/core";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { Input, Textarea } from "@fiscalia/ui/components/input";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { formatDate } from "@/lib/format";
import { ENTRY_ERRORS, defaultWorkerId, toLocalDateTime, workerName, workerOptions } from "./working-hours-model";
import { useTimeEntries, workingHoursStore } from "./working-hours-store";

/** Clock in, clock out (the worker's open interval or a given one) or correct an interval. */
export type EntryDialogMode =
  | { kind: "start"; workerId?: string }
  | { kind: "end"; workerId?: string; entry?: TimeEntry }
  | { kind: "edit"; entry: TimeEntry };

const COPY = {
  start: { title: "Registrar entrada", icon: LogIn, submit: "Registrar entrada" },
  end: { title: "Registrar salida", icon: LogOut, submit: "Registrar salida" },
  edit: { title: "Editar registro", icon: PenLine, submit: "Guardar cambios" },
} as const;

export function EntryDialog({ mode, onClose }: { mode: EntryDialogMode; onClose: () => void }) {
  const entries = useTimeEntries();
  const now = toLocalDateTime(new Date());
  const given = mode.kind === "start" ? undefined : mode.entry;
  const [workerId, setWorkerId] = useState(
    given?.workerId ?? ((mode.kind !== "edit" && mode.workerId) || defaultWorkerId),
  );
  // Clocking out without a given interval closes the worker's open one
  const target = given ?? (mode.kind === "end" ? openEntry(entries, workerId) : null);
  const [start, setStart] = useState(mode.kind === "start" ? now : (target?.start ?? ""));
  const [end, setEnd] = useState(mode.kind === "edit" ? (target?.end ?? "") : now);
  const [comment, setComment] = useState(target?.comment ?? "");
  const [submitted, setSubmitted] = useState(false);

  const missingOpen = mode.kind === "end" && !target;
  const candidate = {
    id: target?.id,
    workerId,
    start: target && mode.kind === "end" ? target.start : start,
    end: mode.kind === "start" || (mode.kind === "edit" && !end) ? null : end,
  };
  const error = missingOpen ? null : entryError(entries, candidate, now);
  const copy = COPY[mode.kind];

  const save = () => {
    setSubmitted(true);
    if (missingOpen || error || !candidate.start || (mode.kind === "end" && !end)) return;
    const record = { workerId, start: candidate.start, end: candidate.end, comment: comment.trim() };
    if (target) workingHoursStore.update(target.id, record);
    else workingHoursStore.add(record);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <copy.icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <DialogTitle>{copy.title}</DialogTitle>
        </div>
        <DialogDescription>
          {mode.kind === "start"
            ? "Abre un tramo de trabajo. Al volver de una pausa, registra una nueva entrada."
            : mode.kind === "end"
              ? "Cierra el tramo que está abierto, para una pausa o al terminar la jornada."
              : "Corrige la hora de un tramo si alguien olvidó fichar o se equivocó."}
        </DialogDescription>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Persona" required>
            {(p) => (
              <GroupedSelect
                {...p}
                value={workerId}
                onChange={setWorkerId}
                disabled={!!given}
                groups={[{ options: workerOptions() }]}
              />
            )}
          </Field>

          {mode.kind === "end" ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">Entrada</span>
              {target ? (
                <span className="font-medium">
                  {formatDate(entryDate(target))}, {clockTime(target.start)}
                </span>
              ) : (
                <span className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                  {workerName(workerId)} no tiene ninguna entrada abierta. Registra antes la entrada.
                </span>
              )}
            </div>
          ) : (
            <Field label="Entrada" required error={submitted && !start ? "Indica la hora de entrada." : undefined}>
              {(p) => (
                <Input
                  {...p}
                  type="datetime-local"
                  max={now}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              )}
            </Field>
          )}

          {mode.kind !== "start" && !missingOpen && (
            <Field
              label="Salida"
              required={mode.kind === "end"}
              hint={mode.kind === "edit" ? "Déjala vacía si el tramo sigue abierto." : undefined}
              error={submitted && mode.kind === "end" && !end ? "Indica la hora de salida." : undefined}
            >
              {(p) => (
                <Input
                  {...p}
                  type="datetime-local"
                  min={candidate.start}
                  max={now}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              )}
            </Field>
          )}

          {!missingOpen && (
            <Field label="Comentario" hint="Opcional, por ejemplo el motivo de un retraso.">
              {(p) => <Textarea {...p} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />}
            </Field>
          )}

          {error && (submitted || error === "openEntry") && (
            <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
              {ENTRY_ERRORS[error]}
            </p>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={missingOpen || error === "openEntry"}>
              {copy.submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
