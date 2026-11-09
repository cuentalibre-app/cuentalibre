import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { newId } from "@cuentalibre/core";
import type { EconomicActivity } from "@cuentalibre/contracts";
import { Input } from "@cuentalibre/ui/components/input";
import { cn } from "@cuentalibre/ui/lib/cn";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { ACTIVITY_TYPES } from "./settings-model";

type Catalog = Record<string, [code: string, name: string][]>;

/** The IAE catalog is long: load it the first time a picker shows. */
function useIaeCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    if (!catalog) void import("./iae-catalog").then((m) => setCatalog(m.IAE_ACTIVITIES));
  }, [catalog]);
  return catalog;
}

/** Lowercase without accents, so "informatica" finds "Informática". */
const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const MAX_RESULTS = 60;

/** Picks an activity of forms 036/037: its type, then its IAE epígrafe from a searchable list. */
export function ActivityPicker({
  existing,
  onPick,
  listClassName,
}: {
  /** Activities already chosen: shown, but they can't be picked again. */
  existing: EconomicActivity[];
  onPick: (activity: EconomicActivity) => void;
  listClassName?: string;
}) {
  const catalog = useIaeCatalog();
  const [type, setType] = useState("A05");
  const [query, setQuery] = useState("");
  const entries = catalog?.[type] ?? [];
  const results = useMemo(() => {
    const q = fold(query.trim());
    const matches = q ? entries.filter(([code, name]) => code.startsWith(q) || fold(name).includes(q)) : entries;
    return matches.slice(0, MAX_RESULTS);
  }, [entries, query]);
  const taken = new Set(existing.map((a) => `${a.type}:${a.code}:${a.name}`));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código y tipo de actividad">
          {(p) => (
            <GroupedSelect
              {...p}
              value={type}
              onChange={(v) => {
                setType(v);
                setQuery("");
              }}
              groups={ACTIVITY_TYPES.map((g) => ({ label: g.group, options: g.options }))}
            />
          )}
        </Field>
        <Field label="Buscar epígrafe">
          {(p) => (
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                {...p}
                type="search"
                value={query}
                placeholder="Código o nombre"
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                disabled={entries.length <= 1}
              />
            </div>
          )}
        </Field>
      </div>
      <ul
        aria-label="Epígrafes"
        className={cn(
          "m-0 flex max-h-80 list-none flex-col overflow-y-auto rounded-lg border border-border p-0",
          listClassName,
        )}
      >
        {!catalog && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Cargando epígrafes…</li>}
        {catalog && results.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            Ningún epígrafe coincide con la búsqueda.
          </li>
        )}
        {results.map(([code, name]) => {
          const added = taken.has(`${type}:${code}:${name}`);
          return (
            <li key={`${code}-${name}`} className="border-b border-divider last:border-b-0">
              <button
                type="button"
                disabled={added}
                onClick={() => onPick({ id: newId(), type, code, name })}
                className="flex w-full cursor-pointer items-baseline gap-3 border-0 bg-transparent px-4 py-2.5 text-left text-foreground transition-colors duration-150 hover:bg-accent disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
              >
                {code && <span className="w-12 shrink-0 text-sm text-muted-foreground tabular-nums">{code}</span>}
                <span className="min-w-0 flex-1">{name}</span>
                {added && <span className="text-xs text-muted-foreground">Añadida</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {catalog && entries.length > MAX_RESULTS && results.length === MAX_RESULTS && (
        <p className="m-0 text-xs text-muted-foreground">
          Mostrando los {MAX_RESULTS} primeros de {entries.length}. Escribe para afinar la búsqueda.
        </p>
      )}
    </div>
  );
}
