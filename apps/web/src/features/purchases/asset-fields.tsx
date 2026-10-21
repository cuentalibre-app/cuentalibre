import { useState } from "react";
import {
  ASSET_CATEGORIES,
  amortizationTable,
  isImmediate,
  isValidPlan,
  rateRange,
  roundHundredths,
  yearsRange,
  type AmortizationMethod,
  type AmortizedAsset,
  type AssetCategory,
  type AssetCondition,
} from "@cuentalibre/core";
import type { InvestmentAsset } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { formatDecimalInput, parseDecimal } from "@/lib/format";
import { AMORTIZATION_METHODS, ASSET_CATEGORY_LABELS, ASSET_CATEGORY_ORDER, ASSET_CONDITIONS } from "./purchases-model";

/* The amortization section of an investment good. Tooltips need a TooltipProvider above. */

export interface AssetDraft {
  category: AssetCategory | "";
  condition: AssetCondition;
  method: AmortizationMethod;
  /** Yearly percentage or number of years, as typed. */
  value: string;
  identifier: string;
}

export function toAssetDraft(asset: InvestmentAsset | undefined): AssetDraft {
  return {
    category: asset?.category ?? "",
    condition: asset?.condition ?? "new",
    method: asset?.method ?? "rate",
    value: asset && !isImmediate(asset.condition) ? formatDecimalInput(asset.value) : "",
    identifier: asset?.identifier ?? "",
  };
}

export function assetDraftError(draft: AssetDraft): string | undefined {
  if (!draft.category) return "Elige el tipo de bien.";
  if (isImmediate(draft.condition)) return undefined;
  const value = parseDecimal(draft.value);
  const plan = { category: draft.category, condition: draft.condition, method: draft.method, value: value ?? 0 };
  if (value === null || !isValidPlan(plan))
    return `Indica un valor ${rangeText(draft.category, draft.condition, draft.method)}.`;
  return undefined;
}

/** Only call it on a draft without errors. */
export function toAsset(draft: AssetDraft): InvestmentAsset {
  const immediate = isImmediate(draft.condition);
  return {
    category: draft.category as AssetCategory,
    condition: draft.condition,
    method: immediate ? "rate" : draft.method,
    value: immediate ? 100 : parseDecimal(draft.value)!,
    identifier: draft.identifier.trim() || undefined,
  };
}

const number = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });

function rangeText(category: AssetCategory, condition: AssetCondition, method: AmortizationMethod): string {
  const { min, max } = method === "rate" ? rateRange(category, condition) : yearsRange(category, condition);
  return method === "rate" ? `entre ${number(min)} y ${number(max)} %` : `entre ${number(min)} y ${number(max)} años`;
}

/** The highest rate, or the shortest period: what most people pick to deduct sooner. */
function defaultValue(category: AssetCategory, condition: AssetCondition, method: AmortizationMethod): string {
  const range = method === "rate" ? rateRange(category, condition) : yearsRange(category, condition);
  return formatDecimalInput(method === "rate" ? range.max : range.min);
}

export function AssetSection({
  draft,
  error,
  asset,
  onChange,
}: {
  draft: AssetDraft;
  error?: string;
  /** The amortization inputs once the draft and the amounts are valid, for the preview. */
  asset: AmortizedAsset | null;
  onChange: (draft: AssetDraft) => void;
}) {
  const [picking, setPicking] = useState(false);
  const immediate = isImmediate(draft.condition);

  const pick = (category: AssetCategory, condition: AssetCondition) =>
    onChange({ ...draft, category, condition, value: defaultValue(category, condition, draft.method) });

  const changeMethod = (method: AmortizationMethod) => {
    const value = parseDecimal(draft.value);
    // Keep the same pace: 25 % a year is 4 years
    const converted = value ? formatDecimalInput(roundHundredths(100 / value)) : draft.value;
    onChange({ ...draft, method, value: converted });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field
          label="Tipo de bien"
          required
          error={!draft.category ? error : undefined}
          help="Decide los coeficientes de amortización que permite la tabla simplificada de estimación directa."
          className="sm:col-span-2 xl:col-span-3"
        >
          {(p) => (
            <div className="flex flex-wrap items-center gap-3">
              <Button {...p} variant="secondary" size="md" onClick={() => setPicking(true)}>
                {draft.category ? "Cambiar el tipo de bien" : "Seleccionar el tipo de bien"}
              </Button>
              <span className={cn("text-sm", !draft.category && "text-muted-foreground")}>
                {draft.category
                  ? `${ASSET_CATEGORY_LABELS[draft.category]} · ${ASSET_CONDITIONS.find((c) => c.value === draft.condition)!.label}`
                  : "Sin elegir"}
              </span>
            </div>
          )}
        </Field>

        {draft.category && !immediate && (
          <>
            <Field
              label="Método de amortización"
              help="Un porcentaje del valor cada año, o el valor repartido en un número de años."
            >
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={draft.method}
                  onChange={(v) => changeMethod(v as AmortizationMethod)}
                  groups={[{ options: AMORTIZATION_METHODS }]}
                />
              )}
            </Field>
            <Field
              label={draft.method === "rate" ? "Coeficiente anual" : "Número de años"}
              error={draft.category ? error : undefined}
              hint={`Valor ${rangeText(draft.category, draft.condition, draft.method)}.`}
            >
              {(p) => (
                <span className="relative flex w-36 items-center">
                  <Input
                    {...p}
                    inputMode="decimal"
                    value={draft.value}
                    onChange={(e) => onChange({ ...draft, value: e.target.value })}
                    className="pr-12 text-right amount"
                  />
                  <span
                    className="pointer-events-none absolute right-3 text-sm text-muted-foreground"
                    aria-hidden="true"
                  >
                    {draft.method === "rate" ? "%" : "años"}
                  </span>
                </span>
              )}
            </Field>
          </>
        )}

        <Field label="Identificador" hint="Para vehículos o inmuebles: la matrícula o la referencia catastral.">
          {(p) => (
            <Input
              {...p}
              value={draft.identifier}
              onChange={(e) => onChange({ ...draft, identifier: e.target.value })}
              className="font-mono"
            />
          )}
        </Field>
      </div>

      {immediate && draft.category && (
        <p className="m-0 text-sm text-muted-foreground">
          {ASSET_CONDITIONS.find((c) => c.value === draft.condition)!.hint}
        </p>
      )}

      {asset && <AmortizationPreview asset={asset} />}

      <CategoryDialog
        open={picking}
        onOpenChange={setPicking}
        category={draft.category}
        condition={draft.condition}
        onPick={(category, condition) => {
          pick(category, condition);
          setPicking(false);
        }}
      />
    </div>
  );
}

/** Year by year: what is deducted, what is accumulated and what is left. */
function AmortizationPreview({ asset }: { asset: AmortizedAsset }) {
  const rows = amortizationTable(asset);
  if (asset.value <= 0 || rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-sm">
        <span className="text-muted-foreground">Valor amortizable </span>
        <span className="amount font-semibold">{formatEUR(asset.value)}</span>
        <span className="text-muted-foreground"> · base sin el IVA deducible, según la imputación</span>
      </p>
      <div className="max-h-72 overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-card">
            <tr className={table.headRow}>
              <th scope="col" className={table.th}>
                Año
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Amortización
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Acumulada
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Pendiente
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year} className={table.row}>
                <td className={table.td}>{r.year}</td>
                <td className={cn(table.td, "text-right amount font-semibold")}>{formatEUR(r.amount)}</td>
                <td className={cn(table.td, "text-right amount text-muted-foreground")}>{formatEUR(r.accumulated)}</td>
                <td className={cn(table.td, "text-right amount text-muted-foreground")}>{formatEUR(r.pending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The amortization table, as in Contasimple: pick the state of use, then the kind of good. */
function CategoryDialog({
  open,
  onOpenChange,
  category,
  condition,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: AssetCategory | "";
  condition: AssetCondition;
  onPick: (category: AssetCategory, condition: AssetCondition) => void;
}) {
  const [state, setState] = useState(condition);
  const [selected, setSelected] = useState(category);
  const immediate = isImmediate(state);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setState(condition);
          setSelected(category);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogTitle>Tabla de amortizaciones</DialogTitle>
        <DialogDescription>
          Coeficientes de la tabla simplificada de estimación directa. Elige el estado de uso y el tipo de bien.
        </DialogDescription>

        <Field label="1. Estado de uso" hint={ASSET_CONDITIONS.find((c) => c.value === state)!.hint}>
          {(p) => (
            <GroupedSelect
              {...p}
              value={state}
              onChange={(v) => setState(v as AssetCondition)}
              groups={[{ options: ASSET_CONDITIONS }]}
            />
          )}
        </Field>

        <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 p-0 text-sm font-medium text-muted-foreground">
            2. Tipo de bien que amortizas
          </legend>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className={table.headRow}>
                  <th scope="col" className={table.th}>
                    Tipo de bien
                  </th>
                  <th scope="col" className={cn(table.th, "text-right")}>
                    Coeficiente anual
                  </th>
                  <th scope="col" className={cn(table.th, "text-right")}>
                    Periodo (años)
                  </th>
                </tr>
              </thead>
              <tbody>
                {ASSET_CATEGORY_ORDER.map((c) => {
                  const rate = rateRange(c, state);
                  const years = yearsRange(c, state);
                  return (
                    <tr
                      key={c}
                      className={cn(table.row, "cursor-pointer", selected === c && "bg-primary-soft")}
                      onClick={() => setSelected(c)}
                    >
                      <td className={table.td}>
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="radio"
                            name="asset-category"
                            checked={selected === c}
                            onChange={() => setSelected(c)}
                            className="size-4 shrink-0 accent-primary"
                          />
                          {ASSET_CATEGORY_LABELS[c]}
                        </label>
                      </td>
                      <td className={cn(table.td, "text-right whitespace-nowrap text-muted-foreground")}>
                        {immediate ? "100 %" : `${number(rate.min)} – ${number(rate.max)} %`}
                      </td>
                      <td className={cn(table.td, "text-right whitespace-nowrap text-muted-foreground")}>
                        {immediate ? "1" : `${number(years.min)} – ${number(years.max)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-xs text-muted-foreground">
            Cuenta contable: {selected ? `${ASSET_CATEGORIES[selected].account}` : "según el tipo"}. Los intangibles van
            a la 680 y el inmovilizado material a la 681.
          </p>
        </fieldset>

        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!selected} onClick={() => selected && onPick(selected, state)}>
            Seleccionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
