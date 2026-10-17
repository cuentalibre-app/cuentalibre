import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight, FileText, ListFilter, LogIn, LogOut, PenLine, Search, Trash2 } from "lucide-react";
import {
  addDays,
  clockTime,
  entryDate,
  entryMinutes,
  formatDuration,
  minutesBetween,
  toIsoDate,
  workerDay,
  type TimeEntry,
} from "@fiscalia/core";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { Input } from "@fiscalia/ui/components/input";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { table } from "@fiscalia/ui/lib/table";
import { GroupedSelect } from "@/features/sales/form-fields";
import { EmptyState, IconAction, type Action } from "@/features/sales/list-parts";
import { ConfirmDialog } from "@/features/settings/settings-parts";
import { PageHeader } from "@/features/treasury/treasury-parts";
import { formatDate } from "@/lib/format";
import { workers } from "@/mocks/working-hours";
import { EntryDialog, type EntryDialogMode } from "./entry-dialog";
import {
  WORKED_HOURS_PATH,
  defaultWorkerId,
  toLocalDateTime,
  weekdayName,
  workerName,
  workerOf,
  workerOptions,
} from "./working-hours-model";
import { useTimeEntries, workingHoursStore } from "./working-hours-store";

type Tab = "dia" | "equipo" | "registros";

const TABS: { value: Tab; label: string }[] = [
  { value: "dia", label: "Visión general del día" },
  { value: "equipo", label: "Mi equipo" },
  { value: "registros", label: "Listado de registros" },
];

const ALL = "all";

export function WorkingHoursPage() {
  const today = toIsoDate(new Date());
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<EntryDialogMode | null>(null);
  const [removing, setRemoving] = useState<TimeEntry | null>(null);

  const tab = (TABS.find((t) => t.value === params.get("vista"))?.value ?? "dia") as Tab;
  const date = params.get("fecha") ?? today;
  const worker = params.get("persona") ?? (tab === "registros" ? ALL : defaultWorkerId);

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );

  // F9 and F10 clock in and out, as in the reference app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F9" && e.key !== "F10") return;
      e.preventDefault();
      const workerId = worker === ALL ? undefined : worker;
      setDialog(e.key === "F9" ? { kind: "start", workerId } : { kind: "end", workerId });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [worker]);

  const actions = {
    close: (entry: TimeEntry) => setDialog({ kind: "end", entry }),
    edit: (entry: TimeEntry) => setDialog({ kind: "edit", entry }),
    remove: setRemoving,
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8">
        <PageHeader
          title="Registro de jornada"
          description="Las entradas y salidas de cada persona. La ley obliga a registrar la jornada de los trabajadores y a conservarla cuatro años."
        >
          <Link to={WORKED_HOURS_PATH} className={cn(buttonVariants({ variant: "secondary" }), "no-underline")}>
            <FileText strokeWidth={1.8} aria-hidden="true" />
            Informes
          </Link>
          <Button
            variant="secondary"
            onClick={() => setDialog({ kind: "end", workerId: worker === ALL ? undefined : worker })}
          >
            <LogOut strokeWidth={1.8} aria-hidden="true" />
            Registrar salida
            <kbd className="hidden font-sans text-xs text-muted-foreground lg:inline">F10</kbd>
          </Button>
          <Button onClick={() => setDialog({ kind: "start", workerId: worker === ALL ? undefined : worker })}>
            <LogIn strokeWidth={2} aria-hidden="true" />
            Registrar entrada
            <kbd className="hidden font-sans text-xs opacity-75 lg:inline">F9</kbd>
          </Button>
        </PageHeader>

        <div
          role="tablist"
          aria-label="Vistas del registro"
          className="flex gap-1 overflow-x-auto border-b border-border"
        >
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`tab-${t.value}`}
              aria-selected={tab === t.value}
              aria-controls={`panel-${t.value}`}
              onClick={() => update({ vista: t.value, persona: null })}
              className={cn(
                "-mb-px flex h-10 shrink-0 cursor-pointer items-center border-0 border-b-2 border-transparent bg-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground",
                tab === t.value && "border-primary text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4">
          {tab === "dia" && (
            <DayOverview
              workerId={worker === ALL ? defaultWorkerId : worker}
              date={date}
              today={today}
              onWorker={(id) => update({ persona: id })}
              onDate={(d) => update({ fecha: d === today ? null : d })}
              actions={actions}
            />
          )}
          {tab === "equipo" && (
            <TeamOverview
              date={date}
              today={today}
              onDate={(d) => update({ fecha: d === today ? null : d })}
              onDetail={(id) => update({ vista: "registros", persona: id, desde: date, hasta: date })}
            />
          )}
          {tab === "registros" && (
            <EntryList
              worker={worker}
              from={params.get("desde") ?? `${today.slice(0, 8)}01`}
              to={params.get("hasta") ?? today}
              query={params.get("q") ?? ""}
              onFilters={(patch) => update(patch)}
              actions={actions}
            />
          )}
        </div>

        {dialog && <EntryDialog mode={dialog} onClose={() => setDialog(null)} />}
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Eliminar registro"
          confirmLabel="Eliminar"
          danger
          onConfirm={() => removing && workingHoursStore.remove(removing.id)}
        >
          <p className="m-0">
            Se eliminará el tramo de {removing && workerName(removing.workerId)} del{" "}
            {removing && formatDate(entryDate(removing))}, de {removing && clockTime(removing.start)} a{" "}
            {removing?.end ? clockTime(removing.end) : "—"}.
          </p>
        </ConfirmDialog>
      </div>
    </TooltipProvider>
  );
}

interface RowActions {
  close: (entry: TimeEntry) => void;
  edit: (entry: TimeEntry) => void;
  remove: (entry: TimeEntry) => void;
}

function EntryActions({ entry, actions }: { entry: TimeEntry; actions: RowActions }) {
  const list: Action[] = [
    ...(entry.end === null ? [{ label: "Registrar salida", icon: LogOut, run: () => actions.close(entry) }] : []),
    { label: "Editar", icon: PenLine, run: () => actions.edit(entry) },
    { label: "Eliminar registro", icon: Trash2, run: () => actions.remove(entry) },
  ];
  return (
    <div className="flex items-center justify-end gap-0.5">
      {list.map((a) => (
        <IconAction key={a.label} action={a} />
      ))}
    </div>
  );
}

/** Exit time, or a flag while the interval is still open. */
function ExitCell({ entry }: { entry: TimeEntry }) {
  if (entry.end !== null) return <>{clockTime(entry.end)}</>;
  return <Badge tone={entryDate(entry) === toIsoDate(new Date()) ? "primary" : "danger"}>Sin salida</Badge>;
}

/** Worked time; an open interval shows how long it has been running today. */
function TimeCell({ entry }: { entry: TimeEntry }) {
  if (entry.end !== null) return <>{formatDuration(entryMinutes(entry))}</>;
  const now = toLocalDateTime(new Date());
  if (entryDate(entry) !== now.slice(0, 10)) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-primary">En curso · {formatDuration(Math.max(0, minutesBetween(entry.start, now)))}</span>
  );
}

function DayPicker({ date, today, onDate }: { date: string; today: string; onDate: (date: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        className="size-9 px-0"
        aria-label="Día anterior"
        onClick={() => onDate(addDays(date, -1))}
      >
        <ChevronLeft strokeWidth={1.8} aria-hidden="true" />
      </Button>
      <Input
        type="date"
        aria-label="Día"
        value={date}
        max={today}
        onChange={(e) => e.target.value && onDate(e.target.value)}
        className="w-auto"
      />
      <Button
        variant="ghost"
        size="sm"
        className="size-9 px-0"
        aria-label="Día siguiente"
        disabled={date >= today}
        onClick={() => onDate(addDays(date, 1))}
      >
        <ChevronRight strokeWidth={1.8} aria-hidden="true" />
      </Button>
      {date !== today && (
        <Button variant="secondary" size="md" onClick={() => onDate(today)}>
          Hoy
        </Button>
      )}
    </div>
  );
}

/* ─────────────────────────────── Visión general del día ─────────────────────────────── */

function DayOverview({
  workerId,
  date,
  today,
  onWorker,
  onDate,
  actions,
}: {
  workerId: string;
  date: string;
  today: string;
  onWorker: (id: string) => void;
  onDate: (date: string) => void;
  actions: RowActions;
}) {
  const entries = useTimeEntries();
  const day = useMemo(() => workerDay(entries, workerId, date), [entries, workerId, date]);
  const person = workerOf(workerId);
  const working = day.entries.find((e) => e.end === null);

  return (
    <div className="grid animate-rise-in gap-4 lg:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center">
        <span
          aria-hidden="true"
          className="flex size-20 items-center justify-center rounded-full bg-primary-soft text-3xl font-semibold text-primary"
        >
          {person?.name.charAt(0)}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{person?.name}</span>
          <span className="text-sm text-muted-foreground">{person?.email}</span>
        </div>
        <GroupedSelect
          id="day-worker"
          aria-label="Persona"
          value={workerId}
          onChange={onWorker}
          groups={[{ options: workerOptions() }]}
          className="text-sm"
        />
      </aside>

      <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">
              Horas trabajadas el {weekdayName(date)} {formatDate(date)}
            </span>
            <span className="amount text-3xl font-semibold">{formatDuration(day.minutes)}</span>
            {working && <span className="text-sm text-primary">Trabajando desde las {clockTime(working.start)}</span>}
          </div>
          <DayPicker date={date} today={today} onDate={onDate} />
        </div>

        <h2 className="m-0 text-md font-semibold">Detalle del día</h2>
        {day.entries.length === 0 ? (
          <p className="m-0 py-6 text-center text-muted-foreground">No hay registros este día.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0 sm:rounded-lg sm:border sm:border-border">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className={table.headRow}>
                  <th scope="col" className={table.th}>
                    Entrada
                  </th>
                  <th scope="col" className={table.th}>
                    Salida
                  </th>
                  <th scope="col" className={cn(table.th, "text-right")}>
                    Tiempo
                  </th>
                  <th scope="col" className={table.th}>
                    Comentarios
                  </th>
                  <th scope="col" className={cn(table.th, "w-28")}>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {day.entries.map((e, i) => (
                  <tr key={e.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                    <td className={cn(table.td, "amount")}>{clockTime(e.start)}</td>
                    <td className={cn(table.td, "amount")}>
                      <ExitCell entry={e} />
                    </td>
                    <td className={cn(table.td, "text-right amount")}>
                      <TimeCell entry={e} />
                    </td>
                    <td className={cn(table.td, "text-sm text-muted-foreground")}>{e.comment}</td>
                    <td className={cn(table.td, "px-1.5 first:pl-1.5 last:pr-1.5")}>
                      <EntryActions entry={e} actions={actions} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted font-semibold">
                  <td colSpan={2} className={cn(table.td, "text-right")}>
                    TOTAL
                  </td>
                  <td className={cn(table.td, "text-right amount")}>{formatDuration(day.minutes)}</td>
                  <td colSpan={2} className={table.td} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─────────────────────────────── Mi equipo ─────────────────────────────── */

function TeamOverview({
  date,
  today,
  onDate,
  onDetail,
}: {
  date: string;
  today: string;
  onDate: (date: string) => void;
  onDetail: (workerId: string) => void;
}) {
  const entries = useTimeEntries();
  const rows = useMemo(() => workers.map((w) => ({ worker: w, day: workerDay(entries, w.id, date) })), [entries, date]);

  return (
    <section aria-label="Mi equipo" className="flex animate-rise-in flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-muted-foreground">
          Resumen del {weekdayName(date)} {formatDate(date)} de cada persona que registra su jornada.
        </p>
        <DayPicker date={date} today={today} onDate={onDate} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className={table.headRow}>
              <th scope="col" className={table.th}>
                Persona
              </th>
              <th scope="col" className={table.th}>
                Entrada
              </th>
              <th scope="col" className={table.th}>
                Última salida
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Paradas
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Sin cerrar
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Tiempo total
              </th>
              <th scope="col" className={table.th}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ worker, day }, i) => (
              <tr key={worker.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                <td className={table.td}>
                  <div className="flex flex-col">
                    <span className="font-medium">{worker.name}</span>
                    <span className="text-xs text-muted-foreground">{worker.owner ? "Titular" : "Empleado"}</span>
                  </div>
                </td>
                <td className={cn(table.td, "amount")}>{day.firstIn ? clockTime(day.firstIn) : "—"}</td>
                <td className={cn(table.td, "amount")}>{day.lastOut ? clockTime(day.lastOut) : "—"}</td>
                <td className={cn(table.td, "text-right amount")}>{day.stops}</td>
                <td className={cn(table.td, "text-right amount", day.unclosed > 0 && "font-semibold text-destructive")}>
                  {day.unclosed}
                </td>
                <td className={cn(table.td, "text-right amount font-semibold")}>{formatDuration(day.minutes)}</td>
                <td className={cn(table.td, "text-right")}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={day.entries.length === 0}
                    onClick={() => onDetail(worker.id)}
                  >
                    Ver registros
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Listado de registros ─────────────────────────────── */

function EntryList({
  worker,
  from,
  to,
  query,
  onFilters,
  actions,
}: {
  worker: string;
  from: string;
  to: string;
  query: string;
  onFilters: (patch: Record<string, string | null>) => void;
  actions: RowActions;
}) {
  const entries = useTimeEntries();
  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      entries
        .filter((e) => {
          const date = entryDate(e);
          const endDate = e.end?.slice(0, 10) ?? date;
          return (
            (worker === ALL || e.workerId === worker) &&
            (date >= from || endDate >= from) &&
            date <= to &&
            (!q || e.comment.toLowerCase().includes(q))
          );
        })
        .sort((a, b) => b.start.localeCompare(a.start)),
    [entries, worker, from, to, q],
  );
  const total = rows.reduce((sum, e) => sum + entryMinutes(e), 0);
  const open = rows.filter((e) => e.end === null).length;

  return (
    <section
      aria-label="Listado de registros"
      className="flex animate-rise-in flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:border-border"
    >
      <div className="flex flex-wrap items-center gap-2.5 pb-3 lg:px-4 lg:py-3">
        <ListFilter className="hidden size-4 text-muted-foreground lg:block" strokeWidth={1.8} aria-hidden="true" />
        <GroupedSelect
          id="filter-worker"
          aria-label="Filtrar por persona"
          value={worker}
          onChange={(id) => onFilters({ persona: id })}
          groups={[{ options: workerOptions("Todas las personas") }]}
          className="w-auto min-w-48 font-medium"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Desde
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(e) => onFilters({ desde: e.target.value || null })}
            className="w-auto"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Hasta
          <Input
            type="date"
            value={to}
            min={from}
            onChange={(e) => onFilters({ hasta: e.target.value || null })}
            className="w-auto"
          />
        </label>
        <div className="flex h-10 min-w-0 flex-[1_1_200px] items-center gap-2 rounded-lg border border-input px-3 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring lg:max-w-72">
          <Search className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => onFilters({ q: e.target.value || null })}
            placeholder="Buscar en comentarios"
            aria-label="Buscar en comentarios"
            className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message="No hay registros con estos filtros."
          hint="Amplía las fechas, elige otra persona o borra la búsqueda."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className={table.headRow}>
                  <th scope="col" className={table.th}>
                    Fecha
                  </th>
                  <th scope="col" className={table.th}>
                    Persona
                  </th>
                  <th scope="col" className={table.th}>
                    Entrada
                  </th>
                  <th scope="col" className={table.th}>
                    Salida
                  </th>
                  <th scope="col" className={cn(table.th, "text-right")}>
                    Tiempo
                  </th>
                  <th scope="col" className={table.th}>
                    Comentarios
                  </th>
                  <th scope="col" className={cn(table.th, "text-center")}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => (
                  <tr
                    key={e.id}
                    className={cn(table.row, "animate-row-in")}
                    style={{ "--i": Math.min(i, 20) } as CSSProperties}
                  >
                    <td className={cn(table.td, "whitespace-nowrap text-muted-foreground")}>
                      {formatDate(entryDate(e))}
                    </td>
                    <td className={table.td}>{workerName(e.workerId)}</td>
                    <td className={cn(table.td, "amount")}>{clockTime(e.start)}</td>
                    <td className={cn(table.td, "amount")}>
                      <ExitCell entry={e} />
                    </td>
                    <td className={cn(table.td, "text-right amount")}>
                      <TimeCell entry={e} />
                    </td>
                    <td className={cn(table.td, "max-w-72 truncate text-sm text-muted-foreground")} title={e.comment}>
                      {e.comment}
                    </td>
                    <td className={cn(table.td, "px-1.5 first:pl-1.5 last:pr-1.5")}>
                      <EntryActions entry={e} actions={actions} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted font-semibold">
                  <td colSpan={4} className={cn(table.td, "text-sm text-muted-foreground")}>
                    {rows.length} {rows.length === 1 ? "registro" : "registros"}
                    {open > 0 && <span className="text-destructive"> · {open} sin salida</span>}
                  </td>
                  <td className={cn(table.td, "text-right amount")}>{formatDuration(total)}</td>
                  <td colSpan={2} className={table.td} />
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className="m-0 flex list-none flex-col p-0 lg:hidden">
            {rows.map((e) => (
              <li key={e.id} className="flex items-center gap-2 border-b border-divider py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">{workerName(e.workerId)}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {formatDate(entryDate(e))} · {clockTime(e.start)} – {e.end ? clockTime(e.end) : "sin salida"}
                  </span>
                  {e.comment && <span className="truncate text-xs text-muted-foreground">{e.comment}</span>}
                </div>
                <span className="amount text-sm font-semibold">
                  <TimeCell entry={e} />
                </span>
                <EntryActions entry={e} actions={actions} />
              </li>
            ))}
            <li className="flex justify-between py-3 text-sm text-muted-foreground">
              <span>
                {rows.length} {rows.length === 1 ? "registro" : "registros"}
              </span>
              <span>
                Total <span className="amount font-semibold text-foreground">{formatDuration(total)}</span>
              </span>
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
