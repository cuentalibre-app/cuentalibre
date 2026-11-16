import { useState, type CSSProperties } from "react";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Info, Plus, Star, Trash2, TriangleAlert, UserPlus } from "lucide-react";
import { cents, newId } from "@cuentalibre/core";
import type { EconomicActivity, FiscalRegion, IncomeTaxMethod, TaxSetup, VatRegime } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { ROLES } from "@/features/contacts/contacts-model";
import { contactsStore, useContacts } from "@/features/contacts/contacts-store";
import { Field, GroupedSelect, Section } from "@/features/sales/form-fields";
import { IconAction } from "@/features/sales/list-parts";
import { VAT_RATE_OPTIONS, WITHHOLDING_GROUPS } from "@/features/sales/sales-model";
import { formatEurosInput, parseEuros } from "@/lib/format";
import { ActivityPicker } from "./activity-picker";
import { ConfirmDialog, SaveButton, SettingsHeader, useDraft } from "./settings-parts";
import {
  ACTIVITY_TYPES,
  BUSINESS_PATH,
  INCOME_TAX_METHODS,
  REGIONS,
  unsupportedSetup,
  VAT_REGIMES,
} from "./settings-model";
import { settingsStore, useSettings } from "./settings-store";
import { Page } from "@/components/page";

function ActivityDialog({
  open,
  onOpenChange,
  existing,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: EconomicActivity[];
  onAdd: (activity: EconomicActivity) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Añadir actividad económica</DialogTitle>
        <DialogDescription>
          Elige el tipo y el epígrafe del IAE con los que te diste de alta en el modelo 036 o 037.
        </DialogDescription>
        {open && (
          <ActivityPicker
            existing={existing}
            onPick={(activity) => {
              onAdd(activity);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActivitiesTable({
  activities,
  onChange,
}: {
  activities: EconomicActivity[];
  onChange: (activities: EconomicActivity[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<EconomicActivity | null>(null);
  const move = (index: number, by: -1 | 1) => {
    const next = [...activities];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    onChange(next);
  };
  const typeLabel = (code: string) =>
    ACTIVITY_TYPES.flatMap((g) => g.options)
      .find((o) => o.value === code)
      ?.label.replace(/^\S+ - /, "") ?? code;

  const rowActions = (a: EconomicActivity, i: number) => (
    <span className="flex shrink-0 justify-end gap-0.5">
      <IconAction action={{ label: "Subir", icon: ArrowUp, run: i > 0 ? () => move(i, -1) : undefined }} />
      <IconAction
        action={{ label: "Bajar", icon: ArrowDown, run: i < activities.length - 1 ? () => move(i, 1) : undefined }}
      />
      <IconAction action={{ label: "Eliminar", icon: Trash2, run: () => setRemoving(a) }} />
    </span>
  );
  const principal = (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
      <Star className="size-3.5 fill-current" aria-hidden="true" />
      Principal
    </span>
  );

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm text-muted-foreground">
        <li>Ordénalas de mayor a menor volumen de operaciones: la primera es tu actividad principal.</li>
        <li>Si no sabes en qué actividades estás de alta, consúltalo en el modelo 036 o 037 que presentaste.</li>
        <li>cuentalibre imputa todos los ingresos y gastos a la actividad principal.</li>
      </ul>

      {activities.length === 0 ? (
        <p className="m-0 flex gap-2 rounded-xl bg-warning-soft px-3.5 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          Añade al menos tu actividad principal.
        </p>
      ) : (
        <>
          <ol className="m-0 flex list-none flex-col rounded-lg border border-border px-3 py-0 md:hidden">
            {activities.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2 border-t border-divider py-2.5 first:border-t-0">
                <span className="w-5 shrink-0 amount text-muted-foreground">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                  {i === 0 && principal}
                  {(a.code || a.name) && (
                    <span>
                      {a.code && <span className="text-muted-foreground tabular-nums">{a.code}</span>} {a.name}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    <span className="tabular-nums">{a.type}</span> {typeLabel(a.type)}
                  </span>
                </div>
                {rowActions(a, i)}
              </li>
            ))}
          </ol>
          <div className="relative overflow-x-auto rounded-lg border border-border max-md:hidden">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className={table.headRow}>
                  <th scope="col" className={table.th}>
                    Orden
                  </th>
                  <th scope="col" className={table.th}>
                    Tipo
                  </th>
                  <th scope="col" className={table.th}>
                    Epígrafe
                  </th>
                  <th scope="col" className={cn(table.th, "w-0 text-right")}>
                    <span className="sr-only">Operaciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a, i) => (
                  <tr key={a.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                    <td className={cn(table.td, "whitespace-nowrap")}>
                      <span className="inline-flex items-center gap-2">
                        <span className="amount">{i + 1}</span>
                        {i === 0 && principal}
                      </span>
                    </td>
                    <td className={table.td}>
                      <span className="text-muted-foreground tabular-nums">{a.type}</span> {typeLabel(a.type)}
                    </td>
                    <td className={table.td}>
                      {a.code && <span className="text-muted-foreground tabular-nums">{a.code}</span>} {a.name}
                    </td>
                    <td className={cn(table.td, "whitespace-nowrap")}>{rowActions(a, i)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Button variant="secondary" className="self-start" onClick={() => setAdding(true)}>
        <Plus aria-hidden="true" />
        Añadir actividad
      </Button>

      <ActivityDialog
        open={adding}
        onOpenChange={setAdding}
        existing={activities}
        onAdd={(a) => onChange([...activities, a])}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Eliminar actividad"
        confirmLabel="Eliminar"
        danger
        onConfirm={() => onChange(activities.filter((a) => a.id !== removing?.id))}
      >
        <p className="m-0">
          Se quitará {removing?.code ? `el epígrafe ${removing.code}` : "la actividad"} «{removing?.name}» de tu
          configuración. Los cambios se aplican al guardar.
        </p>
      </ConfirmDialog>
    </>
  );
}

/** "Clientes varios": one client for every sale to an unidentified customer. */
function VariousClients({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const clients = useContacts("client");
  const existing = clients.find((c) => c.variousClients);
  const NONE = "none";

  return (
    <>
      <p className="m-0 flex max-w-3xl gap-2 rounded-xl bg-primary-soft px-3.5 py-3 text-sm text-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        Las ventas a clientes sin identificar, o de los que no tienes el NIF, se agrupan en un cliente ficticio llamado
        «Clientes varios». Así sus importes no se declaran en el modelo 347.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Cliente «Clientes varios»" className="w-full max-w-sm">
          {(p) => (
            <GroupedSelect
              {...p}
              value={value ?? NONE}
              onChange={(v) => onChange(v === NONE ? null : v)}
              groups={[
                { options: [{ value: NONE, label: "Sin seleccionar" }] },
                { label: "Clientes", options: clients.map((c) => ({ value: c.id, label: c.name })) },
              ]}
            />
          )}
        </Field>
        {!existing && (
          <Button
            variant="secondary"
            onClick={() => {
              const id = newId();
              contactsStore.add("client", { id, name: "Clientes varios", taxId: "", variousClients: true });
              onChange(id);
            }}
          >
            <UserPlus aria-hidden="true" />
            Crear cliente «Clientes varios»
          </Button>
        )}
      </div>
      {value && (
        <Link
          to={`${ROLES.client.path}/${value}`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "self-start no-underline")}
        >
          Ver la ficha del cliente
        </Link>
      )}
    </>
  );
}

export function TaxSettingsPage() {
  const { tax: saved, profile } = useSettings();
  const { draft, set, dirty, justSaved, markSaved } = useDraft<TaxSetup>(saved);
  const [fee, setFee] = useState(formatEurosInput(saved.socialSecurityFee));
  const parsedFee = parseEuros(fee);
  const feeError = parsedFee === null || parsedFee < 0 ? "Introduce un importe válido." : undefined;
  const notes = unsupportedSetup(draft);

  const save = () => {
    if (feeError) return;
    settingsStore.updateTax(draft);
    markSaved();
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <SettingsHeader
          title="Impuestos"
          description="Tu régimen fiscal decide qué modelos presentas y cómo se calculan."
        >
          <SaveButton dirty={dirty && !feeError} justSaved={justSaved} onSave={save} />
        </SettingsHeader>

        <Section title="Régimen fiscal" index={0}>
          <p className="m-0 text-sm text-muted-foreground">
            Eres{" "}
            <span className="font-medium text-foreground">{profile.kind === "company" ? "sociedad" : "autónomo"}</span>{" "}
            en España.{" "}
            <Link to={BUSINESS_PATH} className="font-medium text-primary no-underline hover:text-primary-hover">
              Cambiar el tipo de empresa
            </Link>
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Región fiscal">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={draft.region}
                  onChange={(v) => set("region", v as FiscalRegion)}
                  groups={[{ options: REGIONS }]}
                />
              )}
            </Field>
            <Field
              label="Método de estimación de IRPF"
              help="Decide cómo se calcula el rendimiento de tu actividad en los modelos 130 y 100."
            >
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={draft.incomeTaxMethod}
                  onChange={(v) => set("incomeTaxMethod", v as IncomeTaxMethod)}
                  groups={[{ options: INCOME_TAX_METHODS }]}
                />
              )}
            </Field>
            <Field label="Régimen de IVA">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={draft.vatRegime}
                  onChange={(v) => set("vatRegime", v as VatRegime)}
                  groups={[{ options: VAT_REGIMES }]}
                />
              )}
            </Field>
          </div>
          {notes.length > 0 && (
            <div role="note" className="flex gap-2 rounded-xl bg-warning-soft px-3.5 py-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <span className="font-medium">cuentalibre todavía no prepara los modelos de este régimen.</span>
                {notes.map((n) => (
                  <span key={n} className="text-muted-foreground">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Actividades económicas" index={1}>
          <ActivitiesTable activities={draft.activities} onChange={(a) => set("activities", a)} />
        </Section>

        <Section title="Valores por defecto en facturas" index={2}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="IVA de las líneas nuevas">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={String(draft.defaultVatRate)}
                  onChange={(v) => set("defaultVatRate", Number(v))}
                  groups={[{ options: VAT_RATE_OPTIONS }]}
                />
              )}
            </Field>
            <Field label="Retención de IRPF" help="Si el cliente tiene una retención en su ficha, se usa la suya.">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={draft.defaultWithholding}
                  onChange={(v) => set("defaultWithholding", v as TaxSetup["defaultWithholding"])}
                  groups={WITHHOLDING_GROUPS}
                />
              )}
            </Field>
          </div>
        </Section>

        <Section title="Cuota de autónomos" index={3}>
          <Field
            label="Cuota mensual (RETA)"
            error={feeError}
            help={`Se propone al registrar la cuota como gasto y se muestra en el calendario fiscal. Al año: ${formatEUR(cents((parsedFee ?? 0) * 12))}.`}
            className="max-w-sm"
          >
            {(p) => (
              <div className="relative">
                <Input
                  {...p}
                  inputMode="decimal"
                  value={fee}
                  onChange={(e) => {
                    setFee(e.target.value);
                    const value = parseEuros(e.target.value);
                    if (value !== null && value >= 0) set("socialSecurityFee", value);
                  }}
                  onBlur={() => parsedFee !== null && setFee(formatEurosInput(parsedFee))}
                  className="pr-8 text-right amount"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                  €
                </span>
              </div>
            )}
          </Field>
        </Section>

        <Section title="Facturas a clientes sin identificar" index={4}>
          <VariousClients value={draft.variousClientsId} onChange={(id) => set("variousClientsId", id)} />
        </Section>
        <SaveButton dirty={dirty && !feeError} justSaved={justSaved} onSave={save} bottom />
      </Page>
    </TooltipProvider>
  );
}
