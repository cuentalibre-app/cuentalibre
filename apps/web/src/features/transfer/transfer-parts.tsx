import type { CSSProperties, ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { BackLink, HelpTip, Page, PageHeader, WithHelpTip } from "@/components/page";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import type { SpreadsheetFormat } from "@/lib/xlsx";
import { FORMAT_OPTIONS } from "./transfer-model";

/* Building blocks shared by the export and import pages. */

export function PageShell({
  title,
  help,
  back,
  actions,
  children,
}: {
  title: string;
  /** Explanation shown behind the help icon beside the title. */
  help?: ReactNode;
  /** Link to the page one level up, with its name for the back button. */
  back?: { to: string; label: string };
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Page>
      <PageHeader
        title={title}
        inline={
          help && (
            <TooltipProvider delayDuration={300}>
              <HelpTip side="bottom">{help}</HelpTip>
            </TooltipProvider>
          )
        }
        back={back && <BackLink to={back.to} label={`Volver a ${back.label}`} />}
        actions={actions}
      />
      {children}
    </Page>
  );
}

export function Panel({
  title,
  description,
  index = 0,
  children,
}: {
  title: string;
  description?: ReactNode;
  index?: number;
  children: ReactNode;
}) {
  return (
    <section
      className="flex animate-rise-in flex-col gap-4 surface p-5 text-card-foreground"
      style={{ "--i": index } as CSSProperties}
    >
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold tracking-tight">{title}</h2>
        {description && <div className="m-0 text-sm text-muted-foreground">{description}</div>}
      </div>
      {children}
    </section>
  );
}

export function FormatField({
  value,
  onChange,
}: {
  value: SpreadsheetFormat;
  onChange: (format: SpreadsheetFormat) => void;
}) {
  return (
    <Field label="Formato de exportación" className="max-w-md">
      {(p) => (
        <GroupedSelect
          {...p}
          value={value}
          onChange={(v) => onChange(v as SpreadsheetFormat)}
          groups={[{ options: FORMAT_OPTIONS }]}
        />
      )}
    </Field>
  );
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button className="self-start" onClick={onClick} disabled={disabled}>
      <Download strokeWidth={1.8} aria-hidden="true" />
      Exportar
    </Button>
  );
}

/** Radio option with a label and an optional help icon after it. */
export function RadioOption({
  name,
  checked,
  label,
  help,
  onChange,
}: {
  name: string;
  checked: boolean;
  label: string;
  /** Explanation behind a help icon after the label. Needs a TooltipProvider around the page. */
  help?: string;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        // Named by the label alone, without the help text
        aria-label={label}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-primary"
      />
      <span className="font-medium">
        {help ? <WithHelpTip text={label} help={help} label={help} /> : label}
      </span>
    </label>
  );
}
