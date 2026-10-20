import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import type { DocumentLook, InvoiceTemplate } from "@fiscalia/contracts";
import { Button } from "@fiscalia/ui/components/button";
import { cn } from "@fiscalia/ui/lib/cn";
import { Field, GroupedSelect, LocaleFields } from "./form-fields";
import { defaultNumberFormat } from "./invoice-locale";
import { DEFAULT_SETTINGS, FONTS, TEMPLATES } from "./invoice-settings";
import { TEMPLATE_STYLES } from "./pdf-look";

/* PDF look controls shared by the invoice settings and those of drafts, quotes and delivery notes. */

/** Template picker, font, colors and PDF locale. */
export function LookFields({
  look,
  onChange,
}: {
  look: DocumentLook;
  onChange: (changes: Partial<DocumentLook>) => void;
}) {
  return (
    <>
      <div role="radiogroup" aria-label="Plantilla" className="flex gap-3 overflow-x-auto pb-1">
        {TEMPLATES.map((t) => (
          <TemplateCard
            key={t.value}
            template={t.value}
            label={t.label}
            selected={look.template === t.value}
            look={look}
            onSelect={() => onChange({ template: t.value })}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Fuente">
          {(p) => (
            <GroupedSelect
              {...p}
              value={look.font}
              onChange={(v) => onChange({ font: v as DocumentLook["font"] })}
              groups={[{ options: FONTS.map((f) => ({ value: f, label: f })) }]}
            />
          )}
        </Field>
        <ColorField label="Color texto" value={look.textColor} onChange={(v) => onChange({ textColor: v })} />
        <ColorField label="Color líneas" value={look.lineColor} onChange={(v) => onChange({ lineColor: v })} />
        <ColorField
          label="Color fondo"
          value={look.backgroundColor}
          onChange={(v) => onChange({ backgroundColor: v })}
        />
      </div>
      <Button
        variant="secondary"
        size="md"
        className="self-start"
        onClick={() =>
          onChange({
            font: DEFAULT_SETTINGS.font,
            textColor: DEFAULT_SETTINGS.textColor,
            lineColor: DEFAULT_SETTINGS.lineColor,
            backgroundColor: DEFAULT_SETTINGS.backgroundColor,
          })
        }
      >
        Restablecer
      </Button>

      <LocaleFields
        language={look.language}
        numberFormat={look.numberFormat}
        allowClientDefault={false}
        onLanguageChange={(language) => onChange({ language, numberFormat: defaultNumberFormat(language) })}
        onNumberFormatChange={(numberFormat) => onChange({ numberFormat })}
      />
    </>
  );
}

export function DefaultMark() {
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
  look,
  onSelect,
}: {
  template: InvoiceTemplate;
  label: string;
  selected: boolean;
  look: DocumentLook;
  onSelect: () => void;
}) {
  const { family, traditional } = TEMPLATE_STYLES[template];
  const paper = {
    "--ink": look.textColor,
    "--rule": look.lineColor,
    "--paper": look.backgroundColor,
    fontFamily: look.font,
  } as CSSProperties;
  const bar = (w: string, extra?: string) => (
    <span className={cn("block h-1 rounded-full bg-(--ink) opacity-60", extra)} style={{ width: w }} />
  );
  const filledHeader = family === "professional" || family === "avantGarde";
  const totals = (
    <span className={cn("flex flex-col items-end gap-1", !traditional && "mt-auto")}>
      {bar("30%")}
      {bar("40%", "h-1.5 opacity-90")}
    </span>
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
        {/* The VERI*FACTU code, top right */}
        <span className="block size-3 self-end bg-(--ink) opacity-70" />
        {family === "avantGarde" && <span className="block h-1 bg-(--rule)" />}
        <span className="flex justify-between gap-2">
          <span className="flex w-1/2 flex-col gap-1">
            {bar("80%")}
            {bar("60%")}
          </span>
          <span
            className={cn(
              "flex w-1/2 flex-col gap-1",
              family === "professional" && "border-l-2 border-(--rule) pl-1",
              family === "classic" && "border border-(--rule) p-0.5",
            )}
          >
            {bar("80%")}
            {bar("60%")}
          </span>
        </span>
        {family === "classic" && bar("30%", "self-center")}
        {family === "modern" && bar("45%", "h-2 opacity-80")}
        <span
          className={cn(
            "mt-1 block h-1.5",
            filledHeader && "bg-(--rule)",
            family === "classic" && "border border-(--rule)",
            family === "modern" && "border-b border-(--rule)",
          )}
        />
        {[70, 55].map((w) => (
          <span key={w} className="flex justify-between">
            {bar(`${w}%`)}
            {bar("15%")}
          </span>
        ))}
        {totals}
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </button>
  );
}
