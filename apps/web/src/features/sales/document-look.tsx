import { Check } from "lucide-react";
import type { DocumentLook, InvoiceTemplate } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { cn } from "@cuentalibre/ui/lib/cn";
import { Field, GroupedSelect, LocaleFields } from "./form-fields";
import { defaultNumberFormat } from "./invoice-locale";
import { DEFAULT_SETTINGS, FONTS, TEMPLATES } from "./invoice-settings";
import { TemplateThumbnail } from "./template-thumbnail";

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
            template: DEFAULT_SETTINGS.template,
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
      <TemplateThumbnail template={template} look={look} />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </button>
  );
}
