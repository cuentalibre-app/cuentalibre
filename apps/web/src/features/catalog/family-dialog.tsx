import { useState, type FormEvent } from "react";
import { ChevronRight, Folder, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import type { CatalogFamily } from "@fiscalia/core";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { Input } from "@fiscalia/ui/components/input";
import { cn } from "@fiscalia/ui/lib/cn";
import { catalogStore, useCatalog } from "./catalog-store";

/**
 * "Seleccionar familia/subfamilia": the family tree, where families can also be
 * created, renamed and deleted. Picking the root leaves the product without a family.
 */
export function FamilyDialog({
  open,
  onOpenChange,
  value,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string | null;
  onSelect: (familyId: string | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open && (
          <FamilyPicker
            initial={value}
            onCancel={() => onOpenChange(false)}
            onSelect={(id) => {
              onSelect(id);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Editing = { mode: "new"; parentId: string | null } | { mode: "rename"; id: string } | null;

function FamilyPicker({
  initial,
  onCancel,
  onSelect,
}: {
  initial: string | null;
  onCancel: () => void;
  onSelect: (id: string | null) => void;
}) {
  const { families, products } = useCatalog();
  const [selected, setSelected] = useState<string | null>(initial);
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const children = (parentId: string | null) =>
    families.filter((f) => f.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const current = families.find((f) => f.id === selected);

  const startNew = () => {
    setEditing({ mode: "new", parentId: selected });
    setName("");
    setError(null);
  };
  const startRename = () => {
    if (!current) return;
    setEditing({ mode: "rename", id: current.id });
    setName(current.name);
    setError(null);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = name.trim();
    if (!editing) return;
    if (!trimmed) {
      setError("Escribe el nombre de la familia.");
      return;
    }
    const parentId =
      editing.mode === "new" ? editing.parentId : (families.find((f) => f.id === editing.id)?.parentId ?? null);
    const clash = families.some(
      (f) =>
        f.parentId === parentId &&
        f.name.toLowerCase() === trimmed.toLowerCase() &&
        (editing.mode === "new" || f.id !== editing.id),
    );
    if (clash) {
      setError("Ya hay una familia con ese nombre en el mismo nivel.");
      return;
    }
    if (editing.mode === "new") setSelected(catalogStore.addFamily(trimmed, parentId).id);
    else catalogStore.renameFamily(editing.id, trimmed);
    setEditing(null);
  };

  const remove = () => {
    if (!current) return;
    if (children(current.id).length > 0) {
      window.alert(`«${current.name}» tiene subfamilias. Bórralas antes.`);
      return;
    }
    const used = products.filter((p) => p.familyId === current.id).length;
    const message = used
      ? `¿Borrar la familia «${current.name}»? ${used === 1 ? "1 producto se quedará" : `${used} productos se quedarán`} sin familia.`
      : `¿Borrar la familia «${current.name}»?`;
    if (window.confirm(message)) {
      catalogStore.removeFamily(current.id);
      setSelected(current.parentId);
    }
  };

  const Node = ({ family, depth }: { family: CatalogFamily; depth: number }) => {
    const kids = children(family.id);
    const isSelected = selected === family.id;
    return (
      <li>
        <button
          type="button"
          onClick={() => setSelected(family.id)}
          onDoubleClick={() => onSelect(family.id)}
          aria-pressed={isSelected}
          style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
          className={cn(
            "flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border-0 pr-3 text-left text-foreground transition-colors duration-150",
            isSelected ? "bg-primary-soft font-medium text-primary" : "bg-transparent hover:bg-accent",
          )}
        >
          {kids.length > 0 ? (
            <FolderOpen className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Folder className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          )}
          <span className="truncate">{family.name}</span>
        </button>
        {kids.length > 0 && (
          <ul className="m-0 list-none p-0">
            {kids.map((k) => (
              <Node key={k.id} family={k} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      <DialogTitle>Seleccionar familia/subfamilia</DialogTitle>
      <DialogDescription>
        Elige la familia o subfamilia del producto. Desde aquí también puedes crear familias nuevas y editar o borrar
        las que ya tienes.
      </DialogDescription>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="md" onClick={startNew}>
          <Plus strokeWidth={2} aria-hidden="true" />
          {current ? "Nueva subfamilia" : "Nueva familia"}
        </Button>
        <Button variant="secondary" size="md" onClick={startRename} disabled={!current}>
          <Pencil strokeWidth={1.8} aria-hidden="true" />
          Editar familia
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={remove}
          disabled={!current}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 strokeWidth={1.8} aria-hidden="true" />
          Borrar familia
        </Button>
      </div>

      {editing && (
        <form onSubmit={save} className="flex flex-col gap-1.5 rounded-lg bg-muted p-3">
          <label htmlFor="family-name" className="text-sm font-medium text-muted-foreground">
            {editing.mode === "rename"
              ? "Nuevo nombre"
              : editing.parentId
                ? `Nombre de la subfamilia de «${families.find((f) => f.id === editing.parentId)?.name}»`
                : "Nombre de la familia"}
          </label>
          <div className="flex gap-2">
            <Input
              id="family-name"
              autoFocus
              value={name}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            <Button type="submit" size="lg">
              {editing.mode === "new" ? "Crear" : "Guardar"}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
          {error && <p className="m-0 text-xs text-destructive">{error}</p>}
        </form>
      )}

      <div className="max-h-80 min-h-40 overflow-y-auto rounded-lg border border-border p-1.5">
        <ul className="m-0 list-none p-0">
          <li>
            <button
              type="button"
              onClick={() => setSelected(null)}
              onDoubleClick={() => onSelect(null)}
              aria-pressed={selected === null}
              className={cn(
                "flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border-0 px-3 text-left text-foreground transition-colors duration-150",
                selected === null ? "bg-primary-soft font-medium text-primary" : "bg-transparent hover:bg-accent",
              )}
            >
              <ChevronRight className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              Familias/Subfamilias
              <span className="ml-auto text-xs font-normal text-muted-foreground">Sin familia</span>
            </button>
            {children(null).length > 0 ? (
              <ul className="m-0 list-none p-0">
                {children(null).map((f) => (
                  <Node key={f.id} family={f} depth={1} />
                ))}
              </ul>
            ) : (
              <p className="m-0 px-3 py-2 text-sm text-muted-foreground">Todavía no hay familias.</p>
            )}
          </li>
        </ul>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cerrar
        </Button>
        <Button onClick={() => onSelect(selected)}>Seleccionar</Button>
      </div>
    </>
  );
}
