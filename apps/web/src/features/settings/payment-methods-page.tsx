import { useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { MoreHorizontal, Pencil, Plus, Power, Search, Star, Trash2 } from "lucide-react";
import { newId } from "@fiscalia/core";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { DropdownMenuTrigger } from "@fiscalia/ui/components/dropdown-menu";
import { Input } from "@fiscalia/ui/components/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { table } from "@fiscalia/ui/lib/table";
import { contactsStore } from "@/features/contacts/contacts-store";
import { expensesStore } from "@/features/purchases/expenses-store";
import { purchasesStore } from "@/features/purchases/purchases-store";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { ActionsMenu, EmptyState, IconAction, type Action } from "@/features/sales/list-parts";
import { salesStore } from "@/features/sales/sales-store";
import type { PaymentMethod, PaymentMethodType } from "@/mocks/settings";
import { ACCOUNT_ICONS } from "./account-icons";
import { ConfirmDialog, SettingsHeader } from "./settings-parts";
import {
  ACCOUNT_KIND_FOR_METHOD,
  ACCOUNTS_PATH,
  ACTIVE_STATUS,
  maskNumber,
  METHOD_TYPES,
  methodTypeLabel,
  usePaymentMethods,
} from "./settings-model";
import { settingsStore, useSettings } from "./settings-store";

const ALL = "all";
const NEW_ACCOUNT = "new";
const NO_ACCOUNT = "none";

/** Documents and contacts that use a method: removing it would leave them pointing nowhere. */
function methodUsage(id: string): number {
  return (
    salesStore.all().filter((d) => d.paymentMethodId === id).length +
    purchasesStore.all().filter((p) => p.payments.some((x) => x.paymentMethodId === id)).length +
    expensesStore.all().filter((e) => e.payment?.paymentMethodId === id).length +
    [...contactsStore.all("client"), ...contactsStore.all("supplier")].filter((c) => c.paymentMethodId === id).length
  );
}

function MethodDialog({
  open,
  onOpenChange,
  method,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: PaymentMethod | null;
}) {
  const { accounts } = useSettings();
  const [type, setType] = useState<PaymentMethodType>(method?.type ?? "transfer");
  const [name, setName] = useState(method?.name ?? "");
  const [number, setNumber] = useState(method?.number ?? "");
  const [accountId, setAccountId] = useState(
    method?.accountId ?? accounts.find((a) => a.kind === "bank")?.id ?? NEW_ACCOUNT,
  );
  const [submitted, setSubmitted] = useState(false);
  const nameError = name.trim() ? undefined : "Ponle un nombre al método.";

  const save = () => {
    setSubmitted(true);
    if (nameError) return;
    let linked: string | null = accountId === NO_ACCOUNT ? null : accountId;
    // "Crear una nueva cuenta" opens an account of the matching kind with the method's details
    if (accountId === NEW_ACCOUNT) {
      linked = newId();
      settingsStore.addAccount({
        id: linked,
        kind: ACCOUNT_KIND_FOR_METHOD[type],
        name: name.trim(),
        number: number.trim(),
        active: true,
      });
    }
    const values = { type, name: name.trim(), number: number.trim(), accountId: linked };
    if (method) settingsStore.updatePaymentMethod(method.id, values);
    else settingsStore.addPaymentMethod({ id: newId(), ...values, active: true });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{method ? "Modificar método de pago/cobro" : "Nuevo método de pago/cobro"}</DialogTitle>
        <DialogDescription>
          Indica el medio y la cuenta o tarjeta de cada cobro y pago para poder seguirlos. Si lo prefieres, guarda solo
          los cuatro últimos dígitos.
        </DialogDescription>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" required>
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={type}
                  onChange={(v) => setType(v as PaymentMethodType)}
                  groups={[{ options: METHOD_TYPES }]}
                />
              )}
            </Field>
            <Field label="Nombre del método" required error={submitted ? nameError : undefined}>
              {(p) => (
                <Input
                  {...p}
                  autoFocus
                  value={name}
                  placeholder="Cuenta empresa"
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
          </div>
          {type !== "cash" && (
            <Field label="Número de tarjeta / cuenta corriente" hint="Por ejemplo, 8090: los cuatro últimos dígitos.">
              {(p) => (
                <Input
                  {...p}
                  value={number}
                  spellCheck={false}
                  onChange={(e) => setNumber(e.target.value)}
                  className="font-mono uppercase"
                />
              )}
            </Field>
          )}
          <Field
            label="Cuenta vinculada"
            hint="La cuenta de tesorería donde se anotan los cobros y pagos con este método."
          >
            {(p) => (
              <GroupedSelect
                {...p}
                value={accountId}
                onChange={setAccountId}
                groups={[
                  {
                    options: [
                      { value: NEW_ACCOUNT, label: "Crear una nueva cuenta" },
                      { value: NO_ACCOUNT, label: "Sin cuenta vinculada" },
                    ],
                  },
                  {
                    label: "Cuentas existentes",
                    options: accounts.map((a) => ({ value: a.id, label: a.active ? a.name : `${a.name} (inactiva)` })),
                  },
                ]}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit">{method ? "Guardar" : "Crear método"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentMethodsPage() {
  const methods = usePaymentMethods();
  const { accounts, defaultPaymentMethodId } = useSettings();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PaymentMethodType | typeof ALL>(ALL);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<PaymentMethod | "new" | null>(null);
  const [removing, setRemoving] = useState<PaymentMethod | null>(null);
  const [blocked, setBlocked] = useState<{ method: PaymentMethod; uses: number } | null>(null);

  const q = query.trim().toLowerCase();
  const shown = methods.filter(
    (m) =>
      (!q || m.name.toLowerCase().includes(q) || m.number.toLowerCase().includes(q)) &&
      (type === ALL || m.type === type) &&
      (status === "all" || m.active === (status === "active")),
  );
  const filtered = q !== "" || type !== ALL || status !== "all";
  const accountOf = (id: string | null) => accounts.find((a) => a.id === id);

  const askRemove = (m: PaymentMethod) => {
    const uses = methodUsage(m.id);
    if (uses > 0) setBlocked({ method: m, uses });
    else setRemoving(m);
  };

  const actions = (m: PaymentMethod): Action[][] => {
    const isDefault = m.id === defaultPaymentMethodId;
    return [
      [
        {
          label: "Establecer por defecto",
          icon: Star,
          run: isDefault || !m.active ? undefined : () => settingsStore.setDefaultPaymentMethod(m.id),
        },
        { label: "Editar método", icon: Pencil, run: () => setEditing(m) },
        {
          label: m.active ? "Desactivar método" : "Activar método",
          icon: Power,
          // The default method stays active: it's proposed on every new document
          run: isDefault ? undefined : () => settingsStore.updatePaymentMethod(m.id, { active: !m.active }),
        },
      ],
      [{ label: "Eliminar método", icon: Trash2, danger: true, run: isDefault ? undefined : () => askRemove(m) }],
    ];
  };

  const linkedAccount = (m: PaymentMethod) => {
    const account = accountOf(m.accountId);
    if (!account) return <span className="text-muted-foreground">—</span>;
    const Icon = ACCOUNT_ICONS[account.kind];
    return (
      <Link
        to={ACCOUNTS_PATH}
        className="inline-flex items-center gap-1.5 text-foreground no-underline hover:text-primary"
      >
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        {account.name}
      </Link>
    );
  };

  const defaultMark = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          <Star className="size-3.5 fill-current" aria-hidden="true" />
          Por defecto
        </span>
      </TooltipTrigger>
      <TooltipContent>Se propone en las facturas nuevas</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8">
        <SettingsHeader
          title="Métodos de pago y cobro"
          description="Cómo te pagan tus clientes y cómo pagas a tus proveedores."
        >
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            Nuevo método
          </Button>
        </SettingsHeader>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Buscar por nombre o número"
              placeholder="Buscar por nombre o número"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <GroupedSelect
            id="method-type-filter"
            aria-label="Tipo"
            value={type}
            onChange={(v) => setType(v as PaymentMethodType | typeof ALL)}
            groups={[{ options: [{ value: ALL, label: "Todos los tipos" }, ...METHOD_TYPES] }]}
            className="w-auto min-w-44"
          />
          <GroupedSelect
            id="method-status-filter"
            aria-label="Estado"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            groups={[
              {
                options: [
                  { value: "all", label: "Todos los estados" },
                  { value: "active", label: "Activos" },
                  { value: "inactive", label: "Inactivos" },
                ],
              },
            ]}
            className="w-auto min-w-40"
          />
          {filtered && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setQuery("");
                setType(ALL);
                setStatus("all");
              }}
            >
              Restablecer
            </Button>
          )}
        </div>

        {shown.length === 0 ? (
          <div className="rounded-xl border border-border">
            <EmptyState
              message={methods.length === 0 ? "Todavía no tienes métodos" : "Ningún método coincide con los filtros"}
              hint={
                methods.length === 0 ? "Crea al menos uno para tus facturas." : "Prueba a cambiar o quitar los filtros."
              }
            />
          </div>
        ) : (
          <>
            <div className="relative hidden overflow-x-auto rounded-xl border border-border lg:block">
              <table className="w-full min-w-[56rem] border-collapse">
                <thead>
                  <tr className={table.headRow}>
                    <th scope="col" className={table.th}>
                      Nombre
                    </th>
                    <th scope="col" className={table.th}>
                      Tipo
                    </th>
                    <th scope="col" className={table.th}>
                      Número de tarjeta / cuenta
                    </th>
                    <th scope="col" className={table.th}>
                      Cuenta vinculada
                    </th>
                    <th scope="col" className={table.th}>
                      Estado
                    </th>
                    <th scope="col" className={cn(table.th, "w-0")}>
                      <span className="sr-only">Operaciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m, i) => {
                    const state = ACTIVE_STATUS[m.active ? "active" : "inactive"];
                    return (
                      <tr key={m.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                        <td className={table.td}>
                          <span className="flex flex-wrap items-center gap-x-2.5">
                            <span className="font-medium">{m.name}</span>
                            {m.id === defaultPaymentMethodId && defaultMark}
                          </span>
                        </td>
                        <td className={table.td}>{methodTypeLabel(m.type)}</td>
                        <td className={cn(table.td, "font-mono text-sm whitespace-nowrap")}>
                          {m.number ? maskNumber(m.number) : "—"}
                        </td>
                        <td className={table.td}>{linkedAccount(m)}</td>
                        <td className={table.td}>
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </td>
                        <td className={cn(table.td, "whitespace-nowrap")}>
                          <span className="flex justify-end gap-0.5">
                            <IconAction action={{ label: "Editar método", icon: Pencil, run: () => setEditing(m) }} />
                            <ActionsMenu
                              groups={actions(m)}
                              trigger={
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Más opciones de ${m.name}`}
                                    className="size-8 px-0"
                                  >
                                    <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
                                  </Button>
                                </DropdownMenuTrigger>
                              }
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:hidden">
              {shown.map((m) => {
                const state = ACTIVE_STATUS[m.active ? "active" : "inactive"];
                return (
                  <li key={m.id} className="flex items-start gap-3 rounded-xl border border-border p-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{m.name}</span>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {methodTypeLabel(m.type)}
                        {m.number && <span className="font-mono"> · {maskNumber(m.number)}</span>}
                      </span>
                      <span className="text-sm">{linkedAccount(m)}</span>
                      {m.id === defaultPaymentMethodId && defaultMark}
                    </div>
                    <ActionsMenu
                      groups={actions(m)}
                      trigger={
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Opciones de ${m.name}`}
                            className="size-9 px-0"
                          >
                            <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                      }
                    />
                  </li>
                );
              })}
            </ul>
            <p className="m-0 text-sm text-muted-foreground">
              {shown.length} {shown.length === 1 ? "método" : "métodos"}
              {filtered && ` de ${methods.length}`}
            </p>
          </>
        )}

        {editing && (
          <MethodDialog
            key={editing === "new" ? "new" : editing.id}
            open
            onOpenChange={(open) => !open && setEditing(null)}
            method={editing === "new" ? null : editing}
          />
        )}
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Eliminar método"
          confirmLabel="Eliminar"
          danger
          onConfirm={() => removing && settingsStore.removePaymentMethod(removing.id)}
        >
          <p className="m-0">Se eliminará el método «{removing?.name}». No lo usa ningún documento ni contacto.</p>
        </ConfirmDialog>
        <ConfirmDialog
          open={blocked !== null}
          onOpenChange={(open) => !open && setBlocked(null)}
          title="Este método está en uso"
          confirmLabel="Desactivar"
          onConfirm={() => blocked && settingsStore.updatePaymentMethod(blocked.method.id, { active: false })}
        >
          <p className="m-0">
            «{blocked?.method.name}» aparece en {blocked?.uses}{" "}
            {blocked?.uses === 1 ? "documento o contacto" : "documentos o contactos"}, así que no se puede eliminar.
          </p>
          <p className="m-0">Puedes desactivarlo: dejará de proponerse, pero los documentos lo conservan.</p>
        </ConfirmDialog>
      </div>
    </TooltipProvider>
  );
}
