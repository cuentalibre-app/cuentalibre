import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { Button } from "@fiscalia/ui/components/button";
import { cn } from "@fiscalia/ui/lib/cn";
import { Field, GroupedSelect, LocaleFields } from "./form-fields";
import { defaultNumberFormat } from "./invoice-locale";
import { DEFAULT_SETTINGS, FONTS, TEMPLATES, type DocumentLook, type InvoiceTemplate } from "./invoice-settings";

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
  const traditional = template.endsWith("Traditional");
  const centered = template.startsWith("elegant");
  const banded = template.startsWith("modern") || template === "avantGarde";
  const paper = {
    "--ink": look.textColor,
    "--rule": look.lineColor,
    "--paper": look.backgroundColor,
    fontFamily: look.font,
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
        {banded && (
          <span className={cn("-mx-2 -mt-2 mb-1 block h-4 bg-(--rule)", template === "avantGarde" && "h-7")} />
        )}
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
