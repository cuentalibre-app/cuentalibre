import { Link } from "react-router";
import { PenLine, Plus } from "lucide-react";
import type { DocumentKind } from "@fiscalia/contracts";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { Textarea } from "@fiscalia/ui/components/input";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { SaveButton, SettingsHeader, UnsavedChangesGuard, useDraft } from "@/features/settings/settings-parts";
import { CERTIFICATES_PATH, INVOICE_SETTINGS_PATH } from "@/features/settings/settings-model";
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
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
        <SettingsHeader title={copy.title}>
          <SaveButton dirty={dirty} justSaved={justSaved} onSave={save} />
        </SettingsHeader>
        <UnsavedChangesGuard dirty={dirty} />

        <Section title="Sistema de auto-numeración" index={index++}>
          <p className="m-0 max-w-3xl text-muted-foreground">
            Las series de numeración definen los formatos de numeración de {copy.plural} y permiten proponer el
            siguiente número disponible de cada serie al crear {kind === "draft" ? "una" : "un"} {copy.one}.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead className="bg-muted text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  {["Estado", "Nombre", "Por defecto", "Máscara"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-divider">
                  <td className="px-3 py-2.5">
                    <Badge tone="success">Activa</Badge>
                  </td>
                  <td className="px-3 py-2.5 font-medium">{config.seriesLabel}</td>
                  <td className="px-3 py-2.5">
                    <DefaultMark />
                  </td>
                  <td className="px-3 py-2.5 font-mono">{config.numberPrefix}AAAA-####</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Button variant="secondary" size="md" className="self-start" disabled title="Próximamente">
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
          <p className="m-0 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
            El símbolo de la moneda depende del país y la región fiscal configurados en{" "}
            <Link to="/impuestos" className="font-medium text-primary underline">
              Impuestos
            </Link>
            . Elige otro país para cambiar la moneda.
          </p>
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
              <li>
                Marcada, la factura copia los conceptos {kind === "draft" ? "de la factura borrador" : "del albarán"}{" "}
                uno a uno, con su descripción.
              </li>
              <li>
                Desmarcada, copia una línea por cada tipo de impuesto que nombra{" "}
                {kind === "draft" ? "la factura borrador" : "el albarán"} de origen. Es lo recomendable si facturas
                muchos {kind === "draft" ? "borradores" : "albaranes"} en una sola factura.
              </li>
            </ul>
          </Section>
        )}

        {kind !== "draft" && (
          <Section title={`Firma electrónica de ${copy.plural}`} index={index++}>
            <p className="m-0 max-w-3xl text-muted-foreground">
              Firma digitalmente {copy.all} en PDF. Firmarlos aporta seguridad y más garantías a tus clientes.
            </p>
            <Link
              to={CERTIFICATES_PATH}
              className={cn(buttonVariants({ variant: "secondary", size: "md" }), "self-start no-underline")}
            >
              <PenLine aria-hidden="true" />
              Configurar la firma electrónica de {copy.plural}
            </Link>
          </Section>
        )}

        {kind !== "draft" && (
          <Section title={`Subida de ${copy.plural} a Dropbox o Google Drive`} index={index++}>
            <p className="m-0 max-w-3xl text-muted-foreground">
              Elige si las casillas para subir {copy.plural} a tus cuentas aparecen marcadas por defecto.
            </p>
            <CheckField
              label={`Subir ${copy.plural} a tu cuenta de Dropbox`}
              hint="Necesitas conectar tu cuenta."
              checked={draft.uploadToDropbox}
              disabled
              onChange={(v) => set("uploadToDropbox", v)}
            />
            <CheckField
              label={`Subir ${copy.plural} a tu cuenta de Google Drive`}
              hint="Necesitas conectar tu cuenta."
              checked={draft.uploadToDrive}
              disabled
              onChange={(v) => set("uploadToDrive", v)}
            />
          </Section>
        )}
      </div>
    </TooltipProvider>
  );
}
