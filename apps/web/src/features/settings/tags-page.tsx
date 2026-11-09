import { useState, type CSSProperties } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { newId } from "@cuentalibre/core";
import type { Tag } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { table } from "@cuentalibre/ui/lib/table";
import { Field } from "@/features/sales/form-fields";
import { EmptyState, IconAction } from "@/features/sales/list-parts";
import { ConfirmDialog, SettingsHeader } from "./settings-parts";
import { TagChip } from "./tag-chip";
import { TAG_SWATCHES, nextTagColor, tagsStore, textColorOn, useTags } from "./tags-store";

function TagDialog({ tag, onOpenChange }: { tag: Tag | null; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(() => tag?.color ?? nextTagColor());
  const [submitted, setSubmitted] = useState(false);
  const clash = tagsStore.find(name);
  const nameError = !name.trim()
    ? "Ponle un nombre a la etiqueta."
    : clash && clash.id !== tag?.id
      ? "Ya tienes una etiqueta con ese nombre."
      : undefined;

  const save = () => {
    setSubmitted(true);
    if (nameError) return;
    const values = { name: name.trim(), color };
    if (tag) tagsStore.update(tag.id, values);
    else tagsStore.add({ id: newId(), ...values });
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{tag ? "Modificar etiqueta" : "Crear nueva etiqueta"}</DialogTitle>
        <DialogDescription>
          Las etiquetas sirven para clasificar facturas, presupuestos, albaranes, gastos, contactos y productos.
        </DialogDescription>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field
            label="Nombre"
            required
            error={submitted ? nameError : undefined}
            hint={tag ? "Lo ya etiquetado conserva el nombre anterior." : undefined}
          >
            {(p) => <Input {...p} autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Color de fondo">
            {(p) => (
              <div className="flex flex-wrap items-center gap-2">
                {TAG_SWATCHES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={`Color ${s}`}
                    aria-pressed={color === s}
                    onClick={() => setColor(s)}
                    className={cn(
                      "size-8 cursor-pointer rounded-full border border-border p-0 transition-[scale] duration-150 active:scale-95",
                      color === s && "outline-2 outline-offset-2 outline-ring",
                    )}
                    // A sample of the color itself
                    style={{ backgroundColor: s }}
                  />
                ))}
                <span className="flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-2">
                  <input
                    {...p}
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="size-7 cursor-pointer rounded-sm border-0 bg-transparent p-0"
                  />
                  <span className="text-sm uppercase tabular-nums">{color}</span>
                </span>
              </div>
            )}
          </Field>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Vista previa:
            <span
              className="rounded-full px-2.5 text-sm leading-7 font-medium"
              style={{ backgroundColor: color, color: textColorOn(color) }}
            >
              {name.trim() || "Etiqueta"}
            </span>
          </div>
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary">Cerrar</Button>
            </DialogClose>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TagsPage() {
  const tags = useTags();
  const [editing, setEditing] = useState<Tag | "new" | null>(null);
  const [removing, setRemoving] = useState<Tag | null>(null);
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name, "es"));

  const swatch = (t: Tag) => (
    <span className="flex items-center gap-2">
      <span
        className="size-5 rounded-sm border border-border"
        style={{ backgroundColor: t.color }}
        aria-hidden="true"
      />
      <span className="text-sm uppercase tabular-nums">{t.color}</span>
    </span>
  );
  const operations = (t: Tag) => (
    <span className="flex justify-end gap-0.5">
      <IconAction action={{ label: `Editar etiqueta ${t.name}`, icon: Pencil, run: () => setEditing(t) }} />
      <IconAction action={{ label: `Eliminar etiqueta ${t.name}`, icon: Trash2, run: () => setRemoving(t) }} />
    </span>
  );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8">
        <SettingsHeader
          title="Gestión de etiquetas"
          description="Etiquetas para clasificar facturas, presupuestos, albaranes y gastos."
        >
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            Nueva etiqueta
          </Button>
        </SettingsHeader>

        {sorted.length === 0 ? (
          <div className="rounded-xl border border-border">
            <EmptyState
              message="Todavía no tienes etiquetas"
              hint="Crea una aquí o escríbela al etiquetar un documento."
            />
          </div>
        ) : (
          <>
            <div className="relative hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[40rem] border-collapse">
                <thead>
                  <tr className={table.headRow}>
                    <th scope="col" className={table.th}>
                      Color de fondo
                    </th>
                    <th scope="col" className={table.th}>
                      Nombre de la etiqueta
                    </th>
                    <th scope="col" className={table.th}>
                      Vista previa
                    </th>
                    <th scope="col" className={cn(table.th, "w-0")}>
                      <span className="sr-only">Operaciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t, i) => (
                    <tr key={t.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                      <td className={table.td}>{swatch(t)}</td>
                      <td className={cn(table.td, "font-medium")}>{t.name}</td>
                      <td className={table.td}>
                        <TagChip name={t.name} className="px-2.5 text-xs leading-6" />
                      </td>
                      <td className={cn(table.td, "whitespace-nowrap")}>{operations(t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
              {sorted.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border py-2 pr-2 pl-4">
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                    <TagChip name={t.name} className="max-w-full truncate px-2.5 text-sm leading-7" />
                    {swatch(t)}
                  </div>
                  {operations(t)}
                </li>
              ))}
            </ul>
            <p className="m-0 text-sm text-muted-foreground">
              {sorted.length} {sorted.length === 1 ? "etiqueta" : "etiquetas"}
            </p>
          </>
        )}

        {editing && (
          <TagDialog
            key={editing === "new" ? "new" : editing.id}
            tag={editing === "new" ? null : editing}
            onOpenChange={(open) => !open && setEditing(null)}
          />
        )}
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Eliminar etiqueta"
          confirmLabel="Eliminar"
          danger
          onConfirm={() => removing && tagsStore.remove(removing.id)}
        >
          <p className="m-0">
            Se eliminará «{removing?.name}» de la lista. Lo que ya esté etiquetado la conserva, sin su color.
          </p>
        </ConfirmDialog>
      </div>
    </TooltipProvider>
  );
}
