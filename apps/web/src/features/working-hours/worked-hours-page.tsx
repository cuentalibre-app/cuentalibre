import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Download } from "lucide-react";
import { addDays, formatDuration, toIsoDate } from "@fiscalia/core";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { Input } from "@fiscalia/ui/components/input";
import { SegmentedControl } from "@fiscalia/ui/components/segmented-control";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { table } from "@fiscalia/ui/lib/table";
import { REPORTS_PATH } from "@/features/reports/reports-model";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { addressLine, businessName } from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { formatDate } from "@/lib/format";
import { WORKING_HOURS_PATH, weekdayName, workerName, workerOptions } from "./working-hours-model";
import { useTimeEntries } from "./working-hours-store";
import {
  dayRange,
  intervalLabel,
  lastMonths,
  monthLabel,
  monthRange,
  signatureDays,
  slashDate,
  totalLabel,
  weekRange,
  workerReports,
  type ReportRange,
  type WorkerReport,
} from "./worked-hours-report";

type Tab = "detallado" | "firma";
const CUSTOM = "custom";

export function WorkedHoursPage() {
  const today = toIsoDate(new Date());
  const [params, setParams] = useSearchParams();
  const entries = useTimeEntries();
  const { profile } = useSettings();

  const tab: Tab = params.get("tipo") === "firma" ? "firma" : "detallado";
  const worker = params.get("persona") ?? "all";
  const months = useMemo(() => lastMonths(today), [today]);

  // Detailed report: a month or a custom range
  const month = params.get("mes") ?? months[0]!;
  const from = params.get("desde") ?? `${today.slice(0, 8)}01`;
  const to = params.get("hasta") ?? today;
  const extended = params.get("version") === "extendida";
  // Signature sheet: a day or a week
  const daily = params.get("periodo") === "diario";
  const day = params.get("dia") ?? today;

  const range: ReportRange =
    tab === "firma"
      ? daily
        ? dayRange(day)
        : weekRange(day)
      : month === CUSTOM
        ? { from, to, label: `${slashDate(from)} – ${slashDate(to)}` }
        : monthRange(month);

  const reports = useMemo(() => workerReports(entries, worker, range), [entries, worker, range.from, range.to]);

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

  const business = { name: businessName(profile), taxId: profile.taxId, address: addressLine(profile) };
  const who = worker === "all" ? "todos" : workerName(worker).split(" ")[0]!.toLowerCase();
  const exportPdf = () =>
    void import("./worked-hours-pdf").then((m) =>
      tab === "firma"
        ? m.downloadSignaturePdf({
            business,
            range,
            reports,
            generatedOn: slashDate(today),
            fileName: `registro-jornada-${who}-${range.from}.pdf`,
          })
        : m.downloadDetailedPdf({
            business,
            range,
            reports,
            extended,
            generatedOn: slashDate(today),
            fileName: `horas-trabajadas-${who}-${range.from}.pdf`,
          }),
    );

  const title = `${worker === "all" ? "Todas las personas" : workerName(worker)} · ${range.label}`;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={REPORTS_PATH}
              aria-label="Volver a informes"
              className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-10 no-underline")}
            >
              <ArrowLeft strokeWidth={1.8} aria-hidden="true" />
            </Link>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="m-0 truncate text-2xl font-semibold tracking-tight lg:text-3xl">
                Informe de horas trabajadas
              </h1>
              <p className="m-0 text-sm text-muted-foreground">
                Las horas del{" "}
                <Link to={WORKING_HOURS_PATH} className="text-primary no-underline hover:text-primary-hover">
                  registro de jornada
                </Link>
                , para tu seguimiento o para presentarlas si te las piden.
              </p>
            </div>
          </div>
          <Button onClick={exportPdf}>
            <Download strokeWidth={1.8} aria-hidden="true" />
            Exportar PDF
          </Button>
        </header>

        <div role="tablist" aria-label="Tipo de informe" className="flex gap-1 overflow-x-auto border-b border-border">
          {(
            [
              { value: "detallado", label: "Informe detallado" },
              { value: "firma", label: "Informe para firma" },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`tab-${t.value}`}
              aria-selected={tab === t.value}
              aria-controls={`panel-${t.value}`}
              onClick={() => update({ tipo: t.value === "firma" ? "firma" : null })}
              className={cn(
                "-mb-px flex h-10 shrink-0 cursor-pointer items-center border-0 border-b-2 border-transparent bg-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground",
                tab === t.value && "border-primary text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
            {tab === "detallado" ? (
              <>
                <Field label="Fecha" className="w-56">
                  {(p) => (
                    <GroupedSelect
                      {...p}
                      value={month}
                      onChange={(v) => update({ mes: v === months[0] ? null : v })}
                      groups={[
                        { options: months.map((m) => ({ value: m, label: monthLabel(m) })) },
                        { options: [{ value: CUSTOM, label: "Rango de fechas personalizado" }] },
                      ]}
                    />
                  )}
                </Field>
                {month === CUSTOM && (
                  <>
                    <Field label="Desde">
                      {(p) => (
                        <Input
                          {...p}
                          type="date"
                          value={from}
                          max={to}
                          onChange={(e) => e.target.value && update({ desde: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label="Hasta">
                      {(p) => (
                        <Input
                          {...p}
                          type="date"
                          value={to}
                          min={from}
                          onChange={(e) => e.target.value && update({ hasta: e.target.value })}
                        />
                      )}
                    </Field>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-muted-foreground">Tipo</span>
                  <SegmentedControl
                    label="Tipo"
                    value={daily ? "diario" : "semanal"}
                    onChange={(v) => update({ periodo: v === "diario" ? "diario" : null })}
                    options={[
                      { value: "diario", label: "Diario" },
                      { value: "semanal", label: "Semanal" },
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-muted-foreground">{daily ? "Día" : "Semana"}</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-9 px-0"
                      aria-label={daily ? "Día anterior" : "Semana anterior"}
                      onClick={() => update({ dia: addDays(day, daily ? -1 : -7) })}
                    >
                      <ChevronLeft strokeWidth={1.8} aria-hidden="true" />
                    </Button>
                    <Input
                      type="date"
                      aria-label={daily ? "Día" : "Un día de la semana"}
                      value={day}
                      max={today}
                      onChange={(e) => e.target.value && update({ dia: e.target.value })}
                      className="w-auto"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-9 px-0"
                      aria-label={daily ? "Día siguiente" : "Semana siguiente"}
                      disabled={range.to >= today}
                      onClick={() => update({ dia: addDays(day, daily ? 1 : 7) })}
                    >
                      <ChevronRight strokeWidth={1.8} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </>
            )}
            <Field label="Persona" className="w-60">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={worker}
                  onChange={(v) => update({ persona: v === "all" ? null : v })}
                  groups={[{ options: workerOptions("Todas") }]}
                />
              )}
            </Field>
            {tab === "detallado" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-muted-foreground">Versión</span>
                <SegmentedControl
                  label="Versión del informe"
                  value={extended ? "extendida" : "basica"}
                  onChange={(v) => update({ version: v === "extendida" ? "extendida" : null })}
                  options={[
                    { value: "basica", label: "Básica" },
                    { value: "extendida", label: "Extendida" },
                  ]}
                />
              </div>
            )}
          </div>

          {tab === "detallado" && !extended && <BasicReport title={title} reports={reports} />}
          {tab === "detallado" && extended && <ExtendedReport range={range} reports={reports} />}
          {tab === "firma" && <SignatureReport range={range} reports={reports} />}
        </div>
      </div>
    </TooltipProvider>
  );
}

function ReportCard({ title, children, index = 0 }: { title: string; children: ReactNode; index?: number }) {
  return (
    <section
      className="flex animate-rise-in flex-col overflow-hidden rounded-xl border border-border bg-card"
      style={{ "--i": index } as CSSProperties}
    >
      <h2 className="m-0 border-b border-border px-4 py-3 text-md font-semibold">{title}</h2>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function BasicReport({ title, reports }: { title: string; reports: WorkerReport[] }) {
  const minutes = reports.reduce((sum, r) => sum + r.totals.minutes, 0);
  return (
    <ReportCard title={title}>
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className={table.headRow}>
            <th scope="col" className={table.th}>
              Persona
            </th>
            <th scope="col" className={cn(table.th, "text-right")}>
              Total de horas
            </th>
            <th scope="col" className={cn(table.th, "text-right")}>
              Total días
            </th>
            <th scope="col" className={cn(table.th, "text-right")}>
              Registros sin cerrar
            </th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r, i) => (
            <tr key={r.worker.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
              <th scope="row" className={cn(table.td, "text-left font-medium")}>
                {r.worker.name}
              </th>
              <td className={cn(table.td, "text-right amount")}>{formatDuration(r.totals.minutes)}</td>
              <td className={cn(table.td, "text-right amount")}>{r.totals.days}</td>
              <td
                className={cn(table.td, "text-right amount", r.totals.unclosed > 0 && "font-semibold text-destructive")}
              >
                {r.totals.unclosed}
              </td>
            </tr>
          ))}
        </tbody>
        {reports.length > 1 && (
          <tfoot>
            <tr className="border-t border-border bg-muted font-semibold">
              <td className={table.td}>Total</td>
              <td className={cn(table.td, "text-right amount")}>{formatDuration(minutes)}</td>
              <td colSpan={2} className={table.td} />
            </tr>
          </tfoot>
        )}
      </table>
    </ReportCard>
  );
}

/** Day rows of one person; `everyDay` also lists the days without intervals. */
function DaysTable({ report, range, everyDay }: { report: WorkerReport; range: ReportRange; everyDay?: boolean }) {
  const days = everyDay ? signatureDays(report, range) : report.days;
  if (days.length === 0)
    return <p className="m-0 px-4 py-8 text-center text-muted-foreground">Sin registros en el periodo.</p>;
  return (
    <table className="w-full min-w-[760px] border-collapse">
      <thead>
        <tr className={table.headRow}>
          <th scope="col" className={table.th}>
            Fecha
          </th>
          <th scope="col" className={table.th}>
            Día
          </th>
          <th scope="col" className={table.th}>
            Registros
          </th>
          <th scope="col" className={cn(table.th, "text-right")}>
            Horas
          </th>
          <th scope="col" className={cn(table.th, "text-right")}>
            Sin cerrar
          </th>
          <th scope="col" className={table.th}>
            Comentarios
          </th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => (
          <tr key={d.date} className={cn(table.row, d.entries.length === 0 && "text-muted-foreground")}>
            <td className={cn(table.td, "whitespace-nowrap")}>{formatDate(d.date)}</td>
            <td className={cn(table.td, "capitalize")}>{weekdayName(d.date)}</td>
            <td className={cn(table.td, "amount text-sm")}>
              {d.entries.length === 0
                ? "—"
                : d.entries.map((e) => (
                    <Fragment key={e.id}>
                      <span className={cn(e.end === null && "text-destructive")}>{intervalLabel(e)}</span>
                      <br />
                    </Fragment>
                  ))}
            </td>
            <td className={cn(table.td, "text-right amount")}>{d.entries.length ? formatDuration(d.minutes) : "—"}</td>
            <td className={cn(table.td, "text-right amount", d.unclosed > 0 && "font-semibold text-destructive")}>
              {d.entries.length ? d.unclosed : ""}
            </td>
            <td className={cn(table.td, "text-sm text-muted-foreground")}>{d.comments.join(" · ")}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-border bg-muted font-semibold">
          <td colSpan={2} className={table.td} />
          <td className={cn(table.td, "text-right")}>TOTAL</td>
          <td className={cn(table.td, "text-right amount whitespace-nowrap")}>{totalLabel(report.totals)}</td>
          <td className={cn(table.td, "text-right amount", report.totals.unclosed > 0 && "text-destructive")}>
            {report.totals.unclosed}
          </td>
          <td className={table.td} />
        </tr>
      </tfoot>
    </table>
  );
}

function ExtendedReport({ range, reports }: { range: ReportRange; reports: WorkerReport[] }) {
  return reports.map((r, i) => (
    <ReportCard key={r.worker.id} title={`${r.worker.name} · ${range.label}`} index={i}>
      <DaysTable report={r} range={range} />
    </ReportCard>
  ));
}

function SignatureReport({ range, reports }: { range: ReportRange; reports: WorkerReport[] }) {
  return (
    <>
      <p className="m-0 flex items-start gap-2 rounded-lg bg-muted px-4 py-3 text-sm">
        <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        El PDF lleva una página por persona con cada día del periodo y espacio para la firma de la empresa y del
        trabajador. El registro se conserva durante cuatro años.
      </p>
      {reports.map((r, i) => (
        <ReportCard key={r.worker.id} title={`${r.worker.name} · ${range.label}`} index={i}>
          <DaysTable report={r} range={range} everyDay />
        </ReportCard>
      ))}
    </>
  );
}
