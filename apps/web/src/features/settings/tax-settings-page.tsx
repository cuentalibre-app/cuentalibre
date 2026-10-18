import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Info, Plus, Search, Star, Trash2, TriangleAlert, UserPlus } from "lucide-react";
import { cents, newId } from "@fiscalia/core";
import type { EconomicActivity, FiscalRegion, IncomeTaxMethod, TaxSetup, VatRegime } from "@fiscalia/contracts";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { Input } from "@fiscalia/ui/components/input";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { table } from "@fiscalia/ui/lib/table";
import { ROLES } from "@/features/contacts/contacts-model";
import { contactsStore, useContacts } from "@/features/contacts/contacts-store";
import { Field, GroupedSelect, Section } from "@/features/sales/form-fields";
import { IconAction } from "@/features/sales/list-parts";
import { VAT_RATE_OPTIONS, WITHHOLDING_GROUPS } from "@/features/sales/sales-model";
import { formatEurosInput, parseEuros } from "@/lib/format";
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

type Catalog = Record<string, [code: string, name: string][]>;

/** The IAE catalog is long: load it the first time the dialog opens. */
function useIaeCatalog(enabled: boolean): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    if (enabled && !catalog) void import("./iae-catalog").then((m) => setCatalog(m.IAE_ACTIVITIES));
  }, [enabled, catalog]);
  return catalog;
}

/** Lowercase without accents, so "informatica" finds "Informática". */
const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const MAX_RESULTS = 60;

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
  const catalog = useIaeCatalog(open);
  const [type, setType] = useState("A05");
  const [query, setQuery] = useState("");
  const entries = catalog?.[type] ?? [];
  const results = useMemo(() => {
    const q = fold(query.trim());
    const matches = q ? entries.filter(([code, name]) => code.startsWith(q) || fold(name).includes(q)) : entries;
    return matches.slice(0, MAX_RESULTS);
  }, [entries, query]);
  const taken = new Set(existing.map((a) => `${a.type}:${a.code}:${a.name}`));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Añadir actividad económica</DialogTitle>
        <DialogDescription>
          Elige el tipo y el epígrafe del IAE con los que te diste de alta en el modelo 036 o 037.
        </DialogDescription>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Código y tipo de actividad">
            {(p) => (
              <GroupedSelect
                {...p}
                value={type}
                onChange={(v) => {
                  setType(v);
                  setQuery("");
                }}
                groups={ACTIVITY_TYPES.map((g) => ({ label: g.group, options: g.options }))}
              />
            )}
          </Field>
          <Field label="Buscar epígrafe">
            {(p) => (
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  {...p}
                  type="search"
                  value={query}
                  placeholder="Código o nombre"
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  disabled={entries.length <= 1}
                />
              </div>
            )}
          </Field>
        </div>
        <ul
          aria-label="Epígrafes"
          className="m-0 flex max-h-80 list-none flex-col overflow-y-auto rounded-lg border border-border p-0"
        >
          {!catalog && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Cargando epígrafes…</li>}
          {catalog && results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Ningún epígrafe coincide con la búsqueda.
            </li>
          )}
          {results.map(([code, name]) => {
            const added = taken.has(`${type}:${code}:${name}`);
            return (
              <li key={`${code}-${name}`} className="border-b border-divider last:border-b-0">
                <button
                  type="button"
                  disabled={added}
                  onClick={() => {
                    onAdd({ id: newId(), type, code, name });
                    onOpenChange(false);
                  }}
                  className="flex w-full cursor-pointer items-baseline gap-3 border-0 bg-transparent px-4 py-2.5 text-left text-foreground transition-colors duration-150 hover:bg-accent disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  {code && <span className="w-12 shrink-0 font-mono text-sm text-muted-foreground">{code}</span>}
                  <span className="min-w-0 flex-1">{name}</span>
                  {added && <span className="text-xs text-muted-foreground">Añadida</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {catalog && entries.length > MAX_RESULTS && results.length === MAX_RESULTS && (
          <p className="m-0 text-xs text-muted-foreground">
            Mostrando los {MAX_RESULTS} primeros de {entries.length}. Escribe para afinar la búsqueda.
          </p>
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

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm text-muted-foreground">
        <li>Ordénalas de mayor a menor volumen de operaciones: la primera es tu actividad principal.</li>
        <li>Si no sabes en qué actividades estás de alta, consúltalo en el modelo 036 o 037 que presentaste.</li>
        <li>Fiscalia imputa todos los ingresos y gastos a la actividad principal.</li>
      </ul>

      {activities.length === 0 ? (
        <p className="m-0 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm">
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
          Añade al menos tu actividad principal.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-border">
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
                      {i === 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          <Star className="size-3.5 fill-current" aria-hidden="true" />
                          Principal
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={table.td}>
                    <span className="font-mono text-muted-foreground">{a.type}</span> {typeLabel(a.type)}
                  </td>
                  <td className={table.td}>
                    {a.code && <span className="font-mono text-muted-foreground">{a.code}</span>} {a.name}
                  </td>
                  <td className={cn(table.td, "whitespace-nowrap")}>
                    <span className="flex justify-end gap-0.5">
                      <IconAction
                        action={{ label: "Subir", icon: ArrowUp, run: i > 0 ? () => move(i, -1) : undefined }}
                      />
                      <IconAction
                        action={{
                          label: "Bajar",
                          icon: ArrowDown,
                          run: i < activities.length - 1 ? () => move(i, 1) : undefined,
                        }}
                      />
                      <IconAction action={{ label: "Eliminar", icon: Trash2, run: () => setRemoving(a) }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button variant="secondary" size="md" className="self-start" onClick={() => setAdding(true)}>
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
  const existing = clients.find((c) => /^clientes? varios$/i.test(c.name.trim()));
  const NONE = "none";

  return (
    <>
      <p className="m-0 flex max-w-3xl gap-2 rounded-lg bg-primary-soft px-3 py-2.5 text-sm text-foreground">
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
              contactsStore.add("client", { id, name: "Clientes varios", taxId: "" });
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
          className="self-start text-sm font-medium text-primary no-underline hover:text-primary-hover"
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
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
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
            <Field
              label="Región fiscal"
              help="Cada territorio tiene su propia normativa: en Canarias, por ejemplo, se aplica el IGIC en lugar del IVA."
            >
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
            <div role="note" className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <span className="font-medium">Fiscalia todavía no prepara los modelos de este régimen.</span>
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
            <Field label="Retención de IRPF" hint="Si el cliente tiene una retención en su ficha, se usa la suya.">
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
            hint={
              feeError
                ? undefined
                : `Se propone al registrar la cuota como gasto y se muestra en el calendario fiscal. Al año: ${formatEUR(cents((parsedFee ?? 0) * 12))}.`
            }
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
      </div>
    </TooltipProvider>
  );
}
