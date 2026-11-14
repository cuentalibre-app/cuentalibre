import { Link } from "react-router";
import { Plus } from "lucide-react";
import type { DocumentKind } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button } from "@cuentalibre/ui/components/button";
import { Textarea } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { Page } from "@/components/page";
import { SaveButton, SettingsHeader, UnsavedChangesGuard, useDraft } from "@/features/settings/settings-parts";
import { INVOICE_SETTINGS_PATH } from "@/features/settings/settings-model";
import { DefaultMark, LookFields } from "./document-look";
import { CheckField, Field, Section } from "./form-fields";
import { documentSettingsStore, useDocumentSettings } from "./invoice-settings";
import { KINDS } from "./sales-model";

/** Wording that changes between drafts, quotes and delivery notes. */
const COPY: Record<
  DocumentKind,
  { title: string; plural: string; one: string; all: string; template: string; footer: string }
> = {
  draft: {
    title: "Configuración de facturas borrador",
    plural: "facturas borrador",
    one: "factura borrador",
    all: "todas las facturas borrador",
    template: "Plantilla de factura borrador",
    footer: "Pie de factura borrador fijo",
  },
  quote: {
    title: "Configuración de presupuestos",
    plural: "presupuestos",
    one: "presupuesto",
    all: "todos los presupuestos",
    template: "Plantilla de presupuesto",
    footer: "Pie de presupuesto fijo",
  },
  deliveryNote: {
    title: "Configuración de albaranes",
    plural: "albaranes",
    one: "albarán",
    all: "todos los albaranes",
    template: "Plantilla de albarán",
    footer: "Pie de albarán fijo",
  },
};

/** Settings of drafts, quotes or delivery notes: series, PDF look, footer and invoicing. Changes apply on save. */
export function DocumentSettingsPage({ kind }: { kind: DocumentKind }) {
  const saved = useDocumentSettings(kind);
  const { draft, setDraft, set, dirty, justSaved, markSaved } = useDraft(saved);
  const copy = COPY[kind];
  const config = KINDS[kind];
  const save = () => {
    documentSettingsStore.update(kind, draft);
    markSaved();
  };
  let index = 0;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <SettingsHeader title={copy.title}>
          <SaveButton dirty={dirty} justSaved={justSaved} onSave={save} />
        </SettingsHeader>
        <UnsavedChangesGuard dirty={dirty} />

        <Section title="Sistema de auto-numeración" index={index++}>
          <div className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2.5 md:hidden">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">{config.seriesLabel}</span>
              <Badge tone="primary">Por defecto</Badge>
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">{config.numberPrefix}AAAA-####</span>
          </div>
          <div className="relative overflow-x-auto rounded-lg border border-border max-md:hidden">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead className="text-xs text-foreground">
                <tr>
                  {["Estado", "Nombre", "Por defecto", "Máscara"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="border-l border-border px-3 py-2.5 font-semibold first:border-l-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-divider">
                  <td className="border-l border-border px-3 py-2.5 first:border-l-0">
                    <Badge tone="success">Activa</Badge>
                  </td>
                  <td className="border-l border-border px-3 py-2.5 font-medium first:border-l-0">
                    {config.seriesLabel}
                  </td>
                  <td className="border-l border-border px-3 py-2.5 first:border-l-0">
                    <DefaultMark />
                  </td>
                  <td className="border-l border-border px-3 py-2.5 tabular-nums first:border-l-0">
                    {config.numberPrefix}AAAA-####
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <Button variant="secondary" className="self-start" disabled title="Próximamente">
            <Plus aria-hidden="true" />
            Nueva serie
          </Button>
        </Section>

        <Section title={copy.template} index={index++}>
          <LookFields look={draft} onChange={(changes) => setDraft((d) => ({ ...d, ...changes }))} />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <CheckField
                label="Mostrar las unidades de producto"
                help="Imprime la unidad de medida de cada producto del catálogo junto a la cantidad."
                checked={draft.showProductUnits}
                onChange={(v) => set("showProductUnits", v)}
              />
              <CheckField
                label="Mostrar fechas de prestación del servicio"
                checked={draft.showServicePeriod}
                onChange={(v) => set("showServicePeriod", v)}
              />
              <CheckField
                label="Mostrar los precios de los productos/servicios"
                help="Sin precios, el PDF lista solo los conceptos y cantidades."
                checked={draft.showPrices}
                onChange={(v) => set("showPrices", v)}
              />
            </div>
            {kind !== "deliveryNote" && (
              <div className="flex flex-col gap-4">
                <CheckField
                  label="Mostrar los impuestos"
                  help="Sin impuestos, el PDF muestra solo la base imponible como total."
                  checked={draft.showTaxes}
                  onChange={(v) => set("showTaxes", v)}
                />
                <div className="pl-7.5">
                  <CheckField
                    label="Pero esconder los impuestos cuando su importe sea 0"
                    checked={draft.hideZeroTaxes}
                    disabled={!draft.showTaxes}
                    onChange={(v) => set("hideZeroTaxes", v)}
                  />
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section title={`Logotipo de ${copy.plural}`} index={index++}>
          <p className="m-0 max-w-3xl text-muted-foreground">
            {kind === "deliveryNote"
              ? "Los albaranes usan"
              : `Los ${kind === "draft" ? "borradores" : "presupuestos"} usan`}{" "}
            el mismo logotipo que las facturas. Puedes cambiarlo en{" "}
            <Link to={`${INVOICE_SETTINGS_PATH}#logotipo`} className="font-medium text-primary underline">
              Configuración de facturas
            </Link>
            .
          </p>
        </Section>

        <Section title={copy.footer} index={index++}>
          <Field
            label={`Texto en ${copy.all}`}
            hint={`Se imprime en un lateral ${kind === "draft" ? "de la factura borrador" : `del ${copy.one}`}: inscripción en el Registro Mercantil, protección de datos… Si tu impresora no imprime pegado al margen, deja uno o dos saltos de línea antes del texto.`}
          >
            {(p) => <Textarea {...p} rows={3} value={draft.footer} onChange={(e) => set("footer", e.target.value)} />}
          </Field>
        </Section>

        {kind !== "quote" && (
          <Section title={`Facturar ${copy.plural}`} index={index++}>
            <CheckField
              label={`Convertir ${copy.plural} en facturas conservando todas sus líneas`}
              checked={draft.keepLinesOnInvoice}
              onChange={(v) => set("keepLinesOnInvoice", v)}
            />
            <ul className="m-0 flex max-w-3xl flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
              <li>Marcada: copia cada concepto con su descripción.</li>
              <li>
                Desmarcada: una línea por tipo de impuesto, útil para agrupar muchos{" "}
                {kind === "draft" ? "borradores" : "albaranes"} en una factura.
              </li>
            </ul>
          </Section>
        )}
      </Page>
    </TooltipProvider>
  );
}
