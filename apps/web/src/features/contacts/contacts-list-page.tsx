import { useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeftRight,
  ChevronDown,
  Contact as ContactIcon,
  Copy,
  Download,
  Eye,
  FilePlus2,
  Filter,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { roundCents } from "@fiscalia/core";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { DropdownMenuTrigger } from "@fiscalia/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { table } from "@fiscalia/ui/lib/table";
import { useExpenses } from "@/features/purchases/expenses-store";
import { NEW_EXPENSE_PATH } from "@/features/purchases/expenses-model";
import { NEW_PURCHASE_PATH } from "@/features/purchases/purchases-model";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { TagsField } from "@/features/sales/document-editor";
import { GroupedSelect } from "@/features/sales/form-fields";
import {
  ActionsMenu,
  EmptyState,
  IconAction,
  SortHeader,
  downloadCsv,
  pickFiles,
  type Action,
} from "@/features/sales/list-parts";
import { KINDS } from "@/features/sales/sales-model";
import { useSalesDocuments } from "@/features/sales/sales-store";
import type { Contact, ContactRole } from "@/mocks/contacts";
import { contactActivity, type ActivityRow } from "./contacts-activity";
import {
  CUSTOM_FIELD_LABELS,
  ROLES,
  contactPath,
  countryOf,
  downloadVCard,
  editContactPath,
  formatAddress,
} from "./contacts-model";
import { contactsStore, useContacts } from "./contacts-store";

const ALL = "all";

interface Row {
  contact: Contact;
  address: string;
  /** Short location for the table: "Bilbao, Bizkaia". */
  place: string;
  activity: ActivityRow[];
  /** Invoiced over the contact's whole history (clients: issued invoices; suppliers: invoices and expenses). */
  billed: number;
}

interface Filters {
  query: string;
  country: string;
  province: string;
  tag: string;
}

const NO_FILTERS: Filters = { query: "", country: ALL, province: ALL, tag: ALL };

function matches(r: Row, f: Filters): boolean {
  const q = f.query.trim().toLowerCase();
  const c = r.contact;
  return (
    (f.country === ALL || countryOf(c) === f.country) &&
    (f.province === ALL || (c.province ?? "") === f.province) &&
    (f.tag === ALL || (c.tags ?? []).includes(f.tag)) &&
    (!q ||
      [c.name, c.taxId, r.address, c.phone, c.mobile, c.email, c.notes, c.custom1, c.custom2]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)))
  );
}

export function ContactsListPage({ role }: { role: ContactRole }) {
  const config = ROLES[role];
  const today = useMemo(() => new Date(), []);
  const contacts = useContacts(role);
  const sales = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [tagging, setTagging] = useState<Contact | null>(null);

  const allRows = useMemo(
    () =>
      contacts.map((contact): Row => {
        const activity = contactActivity(role, contact.id, { sales, purchases, expenses }, today);
        const billedKinds = role === "client" ? ["invoice"] : ["purchase", "expense"];
        return {
          contact,
          address: formatAddress(contact),
          place: [contact.city, contact.province !== contact.city ? contact.province : undefined]
            .filter(Boolean)
            .join(", "),
          activity,
          billed: roundCents(activity.filter((a) => billedKinds.includes(a.kind)).reduce((s, a) => s + a.total, 0)),
        };
      }),
    [contacts, role, sales, purchases, expenses, today],
  );

  const rows = useMemo(
    () =>
      sortRows(
        allRows.filter((r) => matches(r, filters)),
        sort,
      ),
    [allRows, filters, sort],
  );

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const extraFilters = (["country", "province", "tag"] as const).filter((k) => filters[k] !== NO_FILTERS[k]).length;
  const filtered = extraFilters > 0 || filters.query.trim() !== "";

  const distinct = (values: (string | undefined)[]) =>
    [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "es"));
  const countries = distinct(contacts.map(countryOf));
  const provinces = distinct(contacts.map((c) => c.province));
  const tags = distinct(contacts.flatMap((c) => c.tags ?? []));

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 lg:gap-4 lg:px-8 lg:pt-6 lg:pb-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">{config.title}</h1>
            <p className="m-0 text-sm text-muted-foreground">
              {contacts.length === 1
                ? `1 ${config.singular.toLowerCase()}`
                : `${contacts.length} ${config.title.toLowerCase()}`}
              . Sus datos fiscales se usan en{" "}
              {role === "client" ? "las facturas que emites" : "las facturas recibidas y los gastos"}.
            </p>
          </div>
          <Link to={config.newPath} className={cn(buttonVariants(), "hidden no-underline lg:inline-flex")}>
            <Plus strokeWidth={2} aria-hidden="true" />
            Nuevo {config.singular.toLowerCase()}
          </Link>
        </header>

        <section
          aria-label={`Listado de ${config.title.toLowerCase()}`}
          className="flex animate-rise-in flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:border-border"
          style={{ "--i": 1 } as CSSProperties}
        >
          <div className="flex flex-wrap items-center gap-2.5 pb-3 lg:px-4 lg:py-3">
            <div className="flex h-10 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-lg border border-input px-3 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring lg:max-w-96">
              <Search className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <input
                type="search"
                value={filters.query}
                onChange={(e) => set("query", e.target.value)}
                placeholder="Buscar por nombre, NIF, dirección, email, teléfono o notas"
                aria-label="Buscar"
                className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Button
              variant="secondary"
              size="md"
              aria-expanded={showFilters}
              aria-controls="contact-filters"
              onClick={() => setShowFilters((s) => !s)}
            >
              <Filter strokeWidth={1.8} aria-hidden="true" />
              Filtros
              {extraFilters > 0 && (
                <span className="flex size-5 items-center justify-center rounded-sm bg-primary text-2xs font-semibold text-primary-foreground">
                  {extraFilters}
                </span>
              )}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" size="md" disabled={rows.length === 0} onClick={() => exportCsv(role, rows)}>
                <Download strokeWidth={1.8} aria-hidden="true" />
                CSV
              </Button>
            </div>
          </div>

          {showFilters && (
            <div
              id="contact-filters"
              className="grid animate-fade-in gap-3 border-y border-border bg-muted/50 py-3 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,16rem))_auto] lg:items-end lg:px-4"
            >
              {(
                [
                  ["country", "País", countries, "Todos"],
                  ["province", "Provincia", provinces, "Todas"],
                  ["tag", "Etiqueta", tags, tags.length ? "Todas" : "Sin etiquetas"],
                ] as const
              ).map(([key, label, values, allLabel]) => (
                <label key={key} className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <GroupedSelect
                    id={`filter-${key}`}
                    value={filters[key]}
                    onChange={(v) => set(key, v)}
                    disabled={values.length === 0}
                    groups={[
                      { options: [{ value: ALL, label: allLabel }, ...values.map((v) => ({ value: v, label: v }))] },
                    ]}
                  />
                </label>
              ))}
              <Button
                variant="ghost"
                size="md"
                onClick={() => setFilters((f) => ({ ...NO_FILTERS, query: f.query }))}
                className="justify-self-start"
              >
                <X strokeWidth={1.8} aria-hidden="true" />
                Quitar filtros
              </Button>
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState
              message={
                filtered
                  ? `Ningún ${config.singular.toLowerCase()} coincide con la búsqueda.`
                  : `Todavía no tienes ${config.title.toLowerCase()}.`
              }
              hint={
                filtered
                  ? "Prueba con otro término o quita algún filtro."
                  : `Añádelos aquí o al crear ${role === "client" ? "una factura" : "una factura recibida o un gasto"}.`
              }
              action={
                !filtered && (
                  <Link
                    to={config.newPath}
                    className={cn(buttonVariants({ variant: "secondary" }), "mt-3 no-underline")}
                  >
                    <Plus strokeWidth={2} aria-hidden="true" />
                    Nuevo {config.singular.toLowerCase()}
                  </Link>
                )
              }
            />
          ) : (
            <>
              <ContactsTable role={role} rows={rows} sort={sort} onSort={setSort} onTags={setTagging} />
              <ContactsList role={role} rows={rows} onTags={setTagging} />
            </>
          )}
        </section>
      </div>

      <TagsDialog role={role} contact={tagging} onClose={() => setTagging(null)} />
    </TooltipProvider>
  );
}

type SortKey = "name" | "taxId" | "place" | "phone" | "email" | "billed";
type SortDir = "asc" | "desc";
interface Sort {
  key: SortKey;
  dir: SortDir;
}

const DEFAULT_SORT: Sort = { key: "name", dir: "asc" };

const byText = (a = "", b = "") => {
  // Empty values go last whichever the direction
  if (!a !== !b) return a ? -1 : 1;
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
};

const COMPARE: Record<SortKey, (a: Row, b: Row) => number> = {
  name: (a, b) => byText(a.contact.name, b.contact.name),
  taxId: (a, b) => byText(a.contact.taxId, b.contact.taxId),
  place: (a, b) => byText(a.place, b.place),
  phone: (a, b) => byText(a.contact.phone ?? a.contact.mobile, b.contact.phone ?? b.contact.mobile),
  email: (a, b) => byText(a.contact.email, b.contact.email),
  billed: (a, b) => a.billed - b.billed,
};

function sortRows(rows: Row[], sort: Sort): Row[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * COMPARE[sort.key](a, b) || byText(a.contact.name, b.contact.name));
}

function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: key === "billed" ? "desc" : "asc" };
}

function ContactsTable({
  role,
  rows,
  sort,
  onSort,
  onTags,
}: {
  role: ContactRole;
  rows: Row[];
  sort: Sort;
  onSort: (sort: Sort) => void;
  onTags: (contact: Contact) => void;
}) {
  const th = cn(table.th, "px-2.5");
  const td = cn(table.td, "px-2.5");
  const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: "name", label: "Nombre" },
    { key: "taxId", label: "NIF" },
    { key: "place", label: "Dirección" },
    { key: "phone", label: "Teléfono" },
    { key: "email", label: "Email" },
    { key: "billed", label: role === "client" ? "Facturado" : "Gastado", numeric: true },
  ];
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[980px] border-collapse">
        <thead>
          <tr className={table.headRow}>
            {columns.map((c) => (
              <SortHeader
                key={c.key}
                label={c.label}
                numeric={c.numeric}
                dir={sort.key === c.key ? sort.dir : null}
                onClick={() => onSort(nextSort(sort, c.key))}
                className={th}
              />
            ))}
            <th scope="col" className={cn(th, "text-center")}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const c = r.contact;
            return (
              <tr key={c.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                <td className={td}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      to={contactPath(role, c.id)}
                      title={c.name}
                      className="block max-w-64 truncate font-medium text-foreground no-underline hover:text-primary"
                    >
                      {c.name}
                    </Link>
                    {!!c.tags?.length && (
                      <span className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span key={t} className="rounded-full bg-accent px-2 text-2xs leading-5 font-medium">
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </td>
                <td className={cn(td, "font-mono text-sm whitespace-nowrap")}>{c.taxId}</td>
                <td className={cn(td, "text-sm")}>
                  <span className="block max-w-56 truncate" title={r.address}>
                    {r.place || countryOf(c)}
                  </span>
                  {r.place && countryOf(c) !== "España" && (
                    <span className="block text-xs text-muted-foreground">{countryOf(c)}</span>
                  )}
                </td>
                <td className={cn(td, "text-sm whitespace-nowrap")}>
                  {c.phone || c.mobile ? (
                    <a
                      href={`tel:${(c.phone || c.mobile)!.replace(/\s/g, "")}`}
                      className="text-foreground no-underline hover:text-primary"
                    >
                      {c.phone || c.mobile}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className={cn(td, "text-sm")}>
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      title={c.email}
                      className="block max-w-52 truncate text-foreground no-underline hover:text-primary"
                    >
                      {c.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className={cn(td, "text-right")}>
                  <span className={cn("amount", r.billed === 0 && "text-muted-foreground")}>{formatEUR(r.billed)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.activity.length === 1 ? "1 documento" : `${r.activity.length} documentos`}
                  </span>
                </td>
                <td className={cn(td, "px-1.5 first:pl-1.5 last:pr-1.5")}>
                  <QuickActions role={role} row={r} onTags={onTags} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted font-semibold">
            <td colSpan={5} className={cn(td, "text-sm text-muted-foreground")}>
              {rows.length} {rows.length === 1 ? ROLES[role].singular.toLowerCase() : ROLES[role].title.toLowerCase()}
            </td>
            <td className={cn(td, "text-right amount")}>
              {formatEUR(roundCents(rows.reduce((s, r) => s + r.billed, 0)))}
            </td>
            <td className={td} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ContactsList({ role, rows, onTags }: { role: ContactRole; rows: Row[]; onTags: (contact: Contact) => void }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0 lg:hidden">
      {rows.map((r, i) => (
        <li
          key={r.contact.id}
          className="flex animate-row-in items-center gap-1 border-b border-divider"
          style={{ "--i": i } as CSSProperties}
        >
          <Link
            to={contactPath(role, r.contact.id)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-3 text-foreground no-underline transition-opacity duration-150 active:opacity-60"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{r.contact.name}</span>
              <span className="truncate text-sm text-muted-foreground">
                <span className="font-mono">{r.contact.taxId}</span>
                {r.place && ` · ${r.place}`}
              </span>
            </div>
            <span className={cn("amount text-base", r.billed === 0 && "text-muted-foreground")}>
              {formatEUR(r.billed)}
            </span>
          </Link>
          <RowActions role={role} row={r} onTags={onTags} />
        </li>
      ))}
      <li className="py-3 text-sm text-muted-foreground">
        {rows.length} {rows.length === 1 ? ROLES[role].singular.toLowerCase() : ROLES[role].title.toLowerCase()}
      </li>
    </ul>
  );
}

/** Operations on a contact, shared by the list and the sheet. */
export function useContactActions(
  role: ContactRole,
  contact: Contact,
  documents: number,
  onTags?: (c: Contact) => void,
) {
  const navigate = useNavigate();
  const config = ROLES[role];
  const opposite = ROLES[config.opposite];
  const attachments = contact.attachments ?? [];

  const attach: Action = {
    label: attachments.length > 0 ? `Adjuntar archivos (${attachments.length})` : "Adjuntar archivos",
    icon: Paperclip,
    run: () =>
      pickFiles((files) => {
        if (files.length === 0) return;
        const added = files.map((f) => ({
          id: crypto.randomUUID(),
          name: f.name,
          size: f.size,
          url: URL.createObjectURL(f),
        }));
        contactsStore.update(role, contact.id, { attachments: [...attachments, ...added] });
      }),
  };

  const view: Action = { label: "Ver ficha", icon: Eye, run: () => navigate(contactPath(role, contact.id)) };

  const newDocument: Action =
    role === "client"
      ? {
          label: "Nueva factura",
          icon: FilePlus2,
          run: () => navigate(`${KINDS.invoice.newPath}?cliente=${contact.id}`),
        }
      : {
          label: "Nueva factura recibida",
          icon: FilePlus2,
          run: () => navigate(`${NEW_PURCHASE_PATH}?proveedor=${contact.id}`),
        };

  const secondaryDocuments: Action[] =
    role === "client"
      ? [
          {
            label: "Nuevo presupuesto",
            icon: FilePlus2,
            run: () => navigate(`${KINDS.quote.newPath}?cliente=${contact.id}`),
          },
          {
            label: "Nuevo albarán",
            icon: FilePlus2,
            run: () => navigate(`${KINDS.deliveryNote.newPath}?cliente=${contact.id}`),
          },
        ]
      : [{ label: "Nuevo gasto", icon: FilePlus2, run: () => navigate(`${NEW_EXPENSE_PATH}?proveedor=${contact.id}`) }];

  const remove: Action = {
    label: "Eliminar contacto",
    icon: Trash2,
    danger: true,
    run: () => {
      if (documents > 0) {
        window.alert(
          `No se puede eliminar «${contact.name}»: tiene ${documents === 1 ? "1 documento" : `${documents} documentos`}. Elimínalos antes o deja el contacto.`,
        );
        return;
      }
      if (window.confirm(`¿Eliminar ${config.noun} «${contact.name}»? No se puede deshacer.`)) {
        contactsStore.remove(role, contact.id);
        navigate(config.path);
      }
    },
  };

  const groups: Action[][] = [
    [view, { label: "Editar contacto", icon: Pencil, run: () => navigate(editContactPath(role, contact.id)) }],
    [newDocument, ...secondaryDocuments],
    [
      attach,
      { label: "Gestionar etiquetas", icon: Tags, run: onTags ? () => onTags(contact) : undefined },
      { label: "Descargar vCard", icon: ContactIcon, run: () => downloadVCard(contact) },
      { label: "Crear por copia", icon: Copy, run: () => navigate(`${config.newPath}?desde=${contact.id}`) },
      {
        label: `Copiar como ${opposite.singular.toLowerCase()}`,
        icon: ArrowLeftRight,
        run: () => navigate(`${opposite.newPath}?desde=${contact.id}&de=opuesto`),
      },
    ],
    [remove],
  ];

  return { attach, view, newDocument, groups, attachments: attachments.length };
}

function QuickActions({ role, row, onTags }: { role: ContactRole; row: Row; onTags: (c: Contact) => void }) {
  const { attach, newDocument, groups, attachments } = useContactActions(
    role,
    row.contact,
    row.activity.length,
    onTags,
  );
  return (
    <div className="flex items-center justify-center gap-0.5">
      <IconAction action={attach} badge={attachments} />
      <IconAction action={newDocument} />
      <ActionsMenu
        groups={groups}
        trigger={
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-8 px-0"
                  aria-label={`Más acciones de ${row.contact.name}`}
                >
                  <ChevronDown strokeWidth={1.8} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Más acciones</TooltipContent>
          </Tooltip>
        }
      />
    </div>
  );
}

function RowActions({ role, row, onTags }: { role: ContactRole; row: Row; onTags: (c: Contact) => void }) {
  const { groups } = useContactActions(role, row.contact, row.activity.length, onTags);
  return (
    <ActionsMenu
      groups={groups}
      trigger={
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`Acciones de ${row.contact.name}`}>
            <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      }
    />
  );
}

/** "Gestionar etiquetas" without leaving the list. */
export function TagsDialog({
  role,
  contact,
  onClose,
}: {
  role: ContactRole;
  contact: Contact | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!contact} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {contact && <TagsEditor key={contact.id} role={role} contact={contact} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function TagsEditor({ role, contact, onClose }: { role: ContactRole; contact: Contact; onClose: () => void }) {
  const [tags, setTags] = useState(contact.tags ?? []);
  const used = [...new Set(contactsStore.all(role).flatMap((c) => c.tags ?? []))]
    .filter((t) => !tags.includes(t))
    .sort();
  return (
    <>
      <DialogTitle>Etiquetas</DialogTitle>
      <DialogDescription>{contact.name}</DialogDescription>
      <TagsField tags={tags} onChange={setTags} />
      {used.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-muted-foreground">Usadas:</span>
          {used.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTags([...tags, t])}
              className="h-7 cursor-pointer rounded-full border border-border bg-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              + {t}
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="md" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          size="md"
          onClick={() => {
            contactsStore.update(role, contact.id, { tags: tags.length ? tags : undefined });
            onClose();
          }}
        >
          Guardar
        </Button>
      </div>
    </>
  );
}

function exportCsv(role: ContactRole, rows: Row[]) {
  downloadCsv(
    [
      "Nombre",
      "NIF",
      "Dirección",
      "Código postal",
      "Población",
      "Provincia",
      "País",
      "Teléfono",
      "Móvil",
      "Email",
      "Web",
      "Etiquetas",
      ...CUSTOM_FIELD_LABELS,
      "Notas",
      role === "client" ? "Facturado" : "Gastado",
    ],
    rows.map(({ contact: c, billed }) => [
      c.name,
      c.taxId,
      c.address ?? "",
      c.postalCode ?? "",
      c.city ?? "",
      c.province ?? "",
      countryOf(c),
      c.phone ?? "",
      c.mobile ?? "",
      c.email ?? "",
      c.website ?? "",
      (c.tags ?? []).join(", "),
      c.custom1 ?? "",
      c.custom2 ?? "",
      c.notes ?? "",
      billed,
    ]),
    ROLES[role].title.toLowerCase(),
  );
}
