import { useRef, useState, type CSSProperties } from "react";
import { Braces, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { newId, unknownPlaceholders } from "@cuentalibre/core";
import type { EmailTemplate, SalesKind } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@cuentalibre/ui/components/dropdown-menu";
import { Input, Textarea } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { table } from "@cuentalibre/ui/lib/table";
import { EMAIL_PLACEHOLDERS, EMAIL_PLACEHOLDER_NAMES, builtInEmailTemplate } from "@/features/sales/email-templates";
import { emailTemplatesStore, useEmailTemplates } from "@/features/sales/email-templates-store";
import { CheckField, Field, GroupedSelect } from "@/features/sales/form-fields";
import { EmptyState, IconAction } from "@/features/sales/list-parts";
import { KINDS } from "@/features/sales/sales-model";
import { ConfirmDialog, SettingsHeader } from "./settings-parts";

const KIND_ORDER: SalesKind[] = ["invoice", "quote", "deliveryNote", "draft"];

/** "Usarla por defecto al enviar facturas". */
const PLURALS: Record<SalesKind, string> = {
  invoice: "facturas",
  draft: "facturas borrador",
  quote: "presupuestos",
  deliveryNote: "albaranes",
};

type Draft = Omit<EmailTemplate, "id">;

/** Creates or edits a template; the data buttons insert `{{name}}` where the cursor was. */
function TemplateDialog({
  template,
  isDefault: wasDefault,
  onOpenChange,
}: {
  template: EmailTemplate | null;
  isDefault: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(
    () => template ?? { name: "", kind: "invoice", ...builtInEmailTemplate("invoice") },
  );
  const [isDefault, setIsDefault] = useState(wasDefault);
  const [submitted, setSubmitted] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Where "Insertar dato" writes: the field last focused, the message at first
  const target = useRef<"subject" | "body">("body");
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const unknown = (text: string) => {
    const names = unknownPlaceholders(text, EMAIL_PLACEHOLDER_NAMES);
    return names.length > 0 ? `No existe el dato ${names.map((n) => `{{${n}}}`).join(", ")}.` : undefined;
  };
  const errors = {
    name: draft.name.trim() ? undefined : "Ponle un nombre a la plantilla.",
    subject: draft.subject.trim() ? unknown(draft.subject) : "Escribe un asunto.",
    body: unknown(draft.body),
  };
  const shown: Partial<typeof errors> = submitted ? errors : {};

  const insert = (name: string) => {
    const field = target.current;
    const element = field === "subject" ? subjectRef.current : bodyRef.current;
    const text = draft[field];
    const token = `{{${name}}}`;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    set(field, text.slice(0, start) + token + text.slice(end));
    // Back to the field, with the cursor after the data, once the menu has closed
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = () => {
    setSubmitted(true);
    if (errors.name || errors.subject || errors.body) return;
    emailTemplatesStore.save(
      { id: template?.id ?? newId(), ...draft, name: draft.name.trim(), subject: draft.subject.trim() },
      isDefault,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{template ? "Modificar plantilla" : "Nueva plantilla de correo"}</DialogTitle>
        <DialogDescription>El asunto y el mensaje con los que envías un tipo de documento.</DialogDescription>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" required error={shown.name}>
              {(p) => (
                <Input
                  {...p}
                  autoFocus
                  value={draft.name}
                  maxLength={80}
                  onChange={(e) => set("name", e.target.value)}
                />
              )}
            </Field>
            <Field label="Documento">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={draft.kind}
                  onChange={(value) => {
                    const kind = value as SalesKind;
                    const before = builtInEmailTemplate(draft.kind);
                    // Untouched, cuentalibre's text follows the kind of document
                    const untouched = draft.subject === before.subject && draft.body === before.body;
                    setDraft((d) => ({ ...d, kind, ...(untouched && builtInEmailTemplate(kind)) }));
                  }}
                  groups={[{ options: KIND_ORDER.map((k) => ({ value: k, label: KINDS[k].singular })) }]}
                />
              )}
            </Field>
          </div>
          <Field label="Asunto" required error={shown.subject}>
            {(p) => (
              <Input
                {...p}
                ref={subjectRef}
                value={draft.subject}
                maxLength={200}
                onFocus={() => (target.current = "subject")}
                onChange={(e) => set("subject", e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Mensaje"
            error={shown.body}
            help="Los datos entre llaves, como {{numero}}, se rellenan con los del documento al enviarlo."
            action={
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    <Braces strokeWidth={1.8} aria-hidden="true" />
                    Insertar dato
                    <ChevronDown strokeWidth={1.8} aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                  {EMAIL_PLACEHOLDERS.map((p) => (
                    <DropdownMenuItem key={p.name} onSelect={() => insert(p.name)}>
                      <span className="flex-1">{p.label}</span>
                      <span className="text-xs text-muted-foreground">{`{{${p.name}}}`}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          >
            {(p) => (
              <Textarea
                {...p}
                ref={bodyRef}
                rows={8}
                value={draft.body}
                onFocus={() => (target.current = "body")}
                onChange={(e) => set("body", e.target.value)}
              />
            )}
          </Field>
          <CheckField
            label={`Usarla por defecto al enviar ${PLURALS[draft.kind]}`}
            checked={isDefault}
            onChange={setIsDefault}
          />
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Configuración › Plantillas de correo: subjects and messages for emailing sales documents. */
export function EmailTemplatesPage() {
  const { templates, defaults } = useEmailTemplates();
  const [editing, setEditing] = useState<EmailTemplate | "new" | null>(null);
  const [removing, setRemoving] = useState<EmailTemplate | null>(null);
  const sorted = [...templates].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name, "es"),
  );
  const isDefault = (t: EmailTemplate) => defaults[t.kind] === t.id;

  const name = (t: EmailTemplate) => (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-medium">{t.name}</span>
      {isDefault(t) && <Badge tone="primary">Por defecto</Badge>}
    </span>
  );
  const operations = (t: EmailTemplate) => (
    <span className="flex justify-end gap-0.5">
      <IconAction action={{ label: `Editar plantilla ${t.name}`, icon: Pencil, run: () => setEditing(t) }} />
      <IconAction action={{ label: `Eliminar plantilla ${t.name}`, icon: Trash2, run: () => setRemoving(t) }} />
    </span>
  );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8">
        <SettingsHeader
          title="Plantillas de correo"
          description="El asunto y el mensaje con los que envías facturas, presupuestos y albaranes."
        >
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            Nueva plantilla
          </Button>
        </SettingsHeader>

        {sorted.length === 0 ? (
          <div className="rounded-xl border border-border">
            <EmptyState
              message="Todavía no tienes plantillas"
              hint="Mientras tanto, los correos llevan el texto de cuentalibre."
            />
          </div>
        ) : (
          <>
            <div className="relative hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[40rem] border-collapse">
                <thead>
                  <tr className={table.headRow}>
                    <th scope="col" className={table.th}>
                      Nombre
                    </th>
                    <th scope="col" className={table.th}>
                      Documento
                    </th>
                    <th scope="col" className={table.th}>
                      Asunto
                    </th>
                    <th scope="col" className={cn(table.th, "w-0")}>
                      <span className="sr-only">Operaciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t, i) => (
                    <tr key={t.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                      <td className={table.td}>{name(t)}</td>
                      <td className={table.td}>{KINDS[t.kind].singular}</td>
                      <td className={cn(table.td, "max-w-80 truncate text-muted-foreground")}>{t.subject}</td>
                      <td className={cn(table.td, "whitespace-nowrap")}>{operations(t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
              {sorted.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border py-2 pr-2 pl-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {name(t)}
                    <span className="truncate text-sm text-muted-foreground">
                      {KINDS[t.kind].singular} · {t.subject}
                    </span>
                  </div>
                  {operations(t)}
                </li>
              ))}
            </ul>
            <p className="m-0 text-sm text-muted-foreground">
              {sorted.length} {sorted.length === 1 ? "plantilla" : "plantillas"}
            </p>
          </>
        )}

        {editing && (
          <TemplateDialog
            key={editing === "new" ? "new" : editing.id}
            template={editing === "new" ? null : editing}
            isDefault={editing !== "new" && isDefault(editing)}
            onOpenChange={(open) => !open && setEditing(null)}
          />
        )}
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Eliminar plantilla"
          confirmLabel="Eliminar"
          danger
          onConfirm={() => removing && emailTemplatesStore.remove(removing.id)}
        >
          <p className="m-0">
            Se eliminará «{removing?.name}».
            {removing && isDefault(removing) && " Los correos volverán a llevar el texto de cuentalibre."}
          </p>
        </ConfirmDialog>
      </div>
    </TooltipProvider>
  );
}
