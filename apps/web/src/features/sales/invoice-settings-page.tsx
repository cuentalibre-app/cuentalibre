import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft, Check, ImageUp, PenLine, Plus, Trash2 } from "lucide-react";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { Textarea } from "@fiscalia/ui/components/input";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { CheckField, Field, GroupedSelect, LocaleFields, Section } from "./form-fields";
import { defaultNumberFormat } from "./invoice-locale";
import {
  DEFAULT_SETTINGS,
  FONTS,
  TEMPLATES,
  invoiceSettingsStore,
  useInvoiceSettings,
  type InvoiceSettings,
  type InvoiceTemplate,
} from "./invoice-settings";

const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;

const SERIES = [
  { type: "Normal", name: "Facturas normales", defaultFor: "normal", mask: "AAAA-####" },
  { type: "Rectificativa", name: "Facturas rectificativas", defaultFor: "rectifying", mask: "R-AAAA-####" },
] as const;

/** Invoice settings: numbering series, PDF look, defaults and integrations. Changes apply on save. */
export function InvoiceSettingsPage() {
  const saved = useInvoiceSettings();
  const [draft, setDraft] = useState<InvoiceSettings>(saved);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setJustSaved(false);
  };

  // Links like "Configurar series" land on their section
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, []);

  const save = () => {
    invoiceSettingsStore.update(draft);
    setJustSaved(true);
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/ventas/facturas/nueva"
              aria-label="Volver a nueva factura"
              className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-10 no-underline")}
            >
              <ArrowLeft strokeWidth={1.8} aria-hidden="true" />
            </Link>
            <h1 className="m-0 truncate text-2xl font-semibold tracking-tight lg:text-3xl">Configuración de facturas</h1>
          </div>
          <div className="flex items-center gap-3">
            {justSaved && !dirty && (
              <span role="status" className="flex items-center gap-1.5 text-sm text-success">
                <Check className="size-4" aria-hidden="true" />
                Cambios guardados
              </span>
            )}
            <Button onClick={save} disabled={!dirty}>
              Guardar cambios
            </Button>
          </div>
        </header>

        <div id="series" className="scroll-mt-6">
          <Section title="Sistema de auto-numeración" index={1}>
            <p className="m-0 max-w-3xl text-muted-foreground">
              Las series de numeración definen los formatos de numeración de las facturas y permiten proponer el
              siguiente número disponible de cada serie al crear una factura.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead className="bg-muted text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    {["Estado", "Tipo", "Nombre", "Por defecto en normales", "Por defecto en rectificativas", "Máscara"].map(
                      (h) => (
                        <th key={h} scope="col" className="px-3 py-2.5 font-medium">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {SERIES.map((s) => (
                    <tr key={s.name} className="border-t border-divider">
                      <td className="px-3 py-2.5">
                        <Badge tone="success">Activa</Badge>
                      </td>
                      <td className="px-3 py-2.5">{s.type}</td>
                      <td className="px-3 py-2.5 font-medium">{s.name}</td>
                      <td className="px-3 py-2.5">{s.defaultFor === "normal" && <DefaultMark />}</td>
                      <td className="px-3 py-2.5">{s.defaultFor === "rectifying" && <DefaultMark />}</td>
                      <td className="px-3 py-2.5 font-mono">{s.mask}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="secondary" size="md" className="self-start" disabled title="Próximamente">
              <Plus aria-hidden="true" />
              Nueva serie
            </Button>
          </Section>
        </div>

        <Section title="Plantilla de factura" index={2}>
          <div role="radiogroup" aria-label="Plantilla" className="flex gap-3 overflow-x-auto pb-1">
            {TEMPLATES.map((t) => (
              <TemplateCard
                key={t.value}
                template={t.value}
                label={t.label}
                selected={draft.template === t.value}
                settings={draft}
                onSelect={() => set("template", t.value)}
              />
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Fuente">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={draft.font}
                  onChange={(v) => set("font", v as InvoiceSettings["font"])}
                  groups={[{ options: FONTS.map((f) => ({ value: f, label: f })) }]}
                />
              )}
            </Field>
            <ColorField label="Color texto" value={draft.textColor} onChange={(v) => set("textColor", v)} />
            <ColorField label="Color líneas" value={draft.lineColor} onChange={(v) => set("lineColor", v)} />
            <ColorField label="Color fondo" value={draft.backgroundColor} onChange={(v) => set("backgroundColor", v)} />
          </div>
          <Button
            variant="secondary"
            size="md"
            className="self-start"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                font: DEFAULT_SETTINGS.font,
                textColor: DEFAULT_SETTINGS.textColor,
                lineColor: DEFAULT_SETTINGS.lineColor,
                backgroundColor: DEFAULT_SETTINGS.backgroundColor,
              }))
            }
          >
            Restablecer
          </Button>

          <LocaleFields
            language={draft.language}
            numberFormat={draft.numberFormat}
            allowClientDefault={false}
            onLanguageChange={(language) =>
              setDraft((d) => ({ ...d, language, numberFormat: defaultNumberFormat(language) }))
            }
            onNumberFormatChange={(v) => set("numberFormat", v)}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <CheckField
                label="Mostrar las unidades de producto"
                help="Imprime la unidad de medida de cada producto del catálogo junto a la cantidad."
                checked={draft.showProductUnits}
                onChange={(v) => set("showProductUnits", v)}
              />
              <CheckField
                label="No mostrar los impuestos cuando su importe sea cero"
                help="Oculta las líneas de IVA, recargo o retención que valen 0 €."
                checked={draft.hideZeroTaxes}
                onChange={(v) => set("hideZeroTaxes", v)}
              />
              <CheckField
                label="No mostrar la marca de agua al exportar a PDF facturas recibidas y bienes de inversión"
                help="Por defecto esos PDF llevan una marca de agua para distinguirlos de las facturas emitidas."
                checked={draft.hideWatermark}
                onChange={(v) => set("hideWatermark", v)}
              />
            </div>
            <div className="flex flex-col gap-4">
              <CheckField
                label="Mostrar fechas de prestación del servicio"
                checked={draft.showServicePeriod}
                onChange={(v) => set("showServicePeriod", v)}
              />
              <CheckField
                label="Mostrar fecha de operación"
                checked={draft.showOperationDate}
                onChange={(v) => set("showOperationDate", v)}
              />
            </div>
          </div>
          <p className="m-0 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
            El símbolo de la moneda depende del país y la región fiscal configurados en{" "}
            <Link to="/impuestos" className="font-medium text-primary underline">
              Impuestos
            </Link>
            . Elige otro país para cambiar la moneda.
          </p>
        </Section>

        <Section title="Logotipo de facturas, borradores, presupuestos y albaranes" index={3}>
          <LogoField />
        </Section>

        <Section title="Pie de factura fijo" index={4}>
          <Field
            label="Texto en todas las facturas"
            hint="Se imprime en un lateral de la factura: inscripción en el Registro Mercantil, protección de datos… Si tu impresora no imprime pegado al margen, deja uno o dos saltos de línea antes del texto."
          >
            {(p) => <Textarea {...p} rows={3} value={draft.footer} onChange={(e) => set("footer", e.target.value)} />}
          </Field>
        </Section>

        <Section title="Importación de facturas" index={5}>
          <p className="m-0 max-w-3xl text-muted-foreground">
            Añade al pie de tus facturas emitidas un enlace para que quien las reciba pueda importarlas directamente. Si
            lo desactivas, quien intente importarlas verá que no lo autorizas. En las facturas enviadas por email el
            enlace aparece en el pie del email y del PDF.
          </p>
          <CheckField
            label="Insertar enlace en el pie de la factura para permitir su importación"
            checked={draft.allowImport}
            onChange={(v) => set("allowImport", v)}
          />
        </Section>

        <Section title="Firma electrónica de facturas emitidas" index={6}>
          <p className="m-0 max-w-3xl text-muted-foreground">
            Firma digitalmente las facturas emitidas, tanto en PDF como en FacturaE, para dar más seguridad y garantías
            a tus clientes.
          </p>
          <Button variant="secondary" size="md" className="self-start" disabled title="Próximamente">
            <PenLine aria-hidden="true" />
            Configurar la firma electrónica de facturas
          </Button>
        </Section>

        <Section title="Validación del NIF de cliente en facturas intracomunitarias" index={7}>
          <p className="m-0 max-w-3xl text-muted-foreground">
            Comprueba en el VIES que el cliente está registrado como operador intracomunitario al emitir una factura
            intracomunitaria (requisito imprescindible para considerarla como tal). Si lo desactivas, se emitirán sin
            comprobarlo.
          </p>
          <CheckField
            label="Validar el NIF del cliente al dar de alta facturas emitidas intracomunitarias"
            checked={draft.validateVies}
            onChange={(v) => set("validateVies", v)}
          />
        </Section>

        <Section title="Subida de facturas a Dropbox o Google Drive" index={8}>
          <p className="m-0 max-w-3xl text-muted-foreground">
            Elige si las casillas para subir las facturas emitidas a tus cuentas aparecen marcadas por defecto.
          </p>
          <CheckField
            label="Subir facturas emitidas a tu cuenta de Dropbox"
            hint="Necesitas conectar tu cuenta."
            checked={draft.uploadToDropbox}
            disabled
            onChange={(v) => set("uploadToDropbox", v)}
          />
          <CheckField
            label="Subir facturas emitidas a tu cuenta de Google Drive"
            hint="Necesitas conectar tu cuenta."
            checked={draft.uploadToDrive}
            disabled
            onChange={(v) => set("uploadToDrive", v)}
          />
        </Section>
      </div>
    </TooltipProvider>
  );
}

function DefaultMark() {
  return (
    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Check className="size-3.5" strokeWidth={2.5} aria-label="Sí" />
    </span>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      {(p) => (
        <span className="flex h-10 items-center gap-3 rounded-lg border border-input bg-background px-2">
          <input
            {...p}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="size-7 cursor-pointer rounded-sm border-0 bg-transparent p-0"
          />
          <span className="font-mono text-sm uppercase">{value}</span>
        </span>
      )}
    </Field>
  );
}

/** Thumbnail of a template, drawn with the chosen colors. */
function TemplateCard({
  template,
  label,
  selected,
  settings,
  onSelect,
}: {
  template: InvoiceTemplate;
  label: string;
  selected: boolean;
  settings: InvoiceSettings;
  onSelect: () => void;
}) {
  const traditional = template.endsWith("Traditional");
  const centered = template.startsWith("elegant");
  const banded = template.startsWith("modern") || template === "avantGarde";
  const paper = {
    "--ink": settings.textColor,
    "--rule": settings.lineColor,
    "--paper": settings.backgroundColor,
    fontFamily: settings.font,
  } as CSSProperties;
  const bar = (w: string, extra?: string) => (
    <span className={cn("block h-1 rounded-full bg-(--ink) opacity-60", extra)} style={{ width: w }} />
  );
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-28 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-lg border-2 bg-transparent p-2 transition-colors duration-150",
        selected ? "border-primary" : "border-transparent hover:border-border",
      )}
    >
      <span
        aria-hidden="true"
        style={paper}
        className="flex aspect-[1/1.414] w-full flex-col gap-1.5 overflow-hidden rounded-sm border border-border bg-(--paper) p-2 shadow-sm"
      >
        {banded && <span className={cn("-mx-2 -mt-2 mb-1 block h-4 bg-(--rule)", template === "avantGarde" && "h-7")} />}
        <span className={cn("flex", centered ? "justify-center" : "justify-between")}>
          {bar("40%")}
          {!centered && bar("25%")}
        </span>
        {bar("30%", centered ? "self-center" : undefined)}
        <span className={cn("mt-1 block border-t border-(--rule)", traditional && "border-t-2")} />
        {[70, 55, 62].map((w) => (
          <span key={w} className={cn("flex justify-between", traditional && "border-b border-(--rule) pb-1")}>
            {bar(`${w}%`)}
            {bar("15%")}
          </span>
        ))}
        <span className="mt-auto flex justify-end">{bar("35%", "h-1.5 opacity-90")}</span>
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </button>
  );
}

/** Logo upload with preview. Kept in memory until there is a backend. */
function LogoField() {
  const input = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(
    () => () => {
      if (logo) URL.revokeObjectURL(logo.url);
    },
    [logo],
  );

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("El logotipo debe ser una imagen (PNG, JPG o SVG).");
    if (file.size > MAX_LOGO_BYTES) return setError("La imagen pesa más de 1,5 MB.");
    setError("");
    setLogo({ url: URL.createObjectURL(file), name: file.name });
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files[0]);
  };

  const notes: ReactNode[] = [
    "Si supera 325 × 200 píxeles, se reduce proporcionalmente.",
    "Aparece en las facturas y presupuestos que crees a partir de ahora, no en los anteriores.",
  ];

  return (
    <div className="flex flex-col gap-4">
      <ul className="m-0 flex flex-col gap-1 pl-5 text-sm text-muted-foreground">
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-transparent p-6 text-muted-foreground transition-colors duration-150 hover:bg-muted",
            dragging ? "border-primary bg-primary-soft text-primary" : "border-border",
          )}
        >
          <ImageUp className="size-6" strokeWidth={1.6} aria-hidden="true" />
          <span className="font-medium text-foreground">Arrastra aquí el logo o haz clic para buscarlo</span>
          <span className="text-xs">Tamaño máximo: 1,5 MB</span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => accept(e.target.files?.[0])}
        />
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <span className="text-sm font-medium text-muted-foreground">Logo actual</span>
          {logo ? (
            <>
              <img src={logo.url} alt={`Logotipo ${logo.name}`} className="max-h-24 max-w-full self-start object-contain" />
              <Button variant="secondary" size="sm" className="self-start" onClick={() => setLogo(null)}>
                <Trash2 aria-hidden="true" />
                Borrar
              </Button>
            </>
          ) : (
            <span className="text-sm">No se ha subido ningún logo.</span>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
