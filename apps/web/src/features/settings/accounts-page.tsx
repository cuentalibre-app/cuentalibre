import { useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { MoreHorizontal, Pencil, Plus, Power, RefreshCw, Trash2 } from "lucide-react";
import { formatIban, isValidEmail, isValidIban, newId } from "@fiscalia/core";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { DropdownMenuTrigger } from "@fiscalia/ui/components/dropdown-menu";
import { Input } from "@fiscalia/ui/components/input";
import { SegmentedControl } from "@fiscalia/ui/components/segmented-control";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { table } from "@fiscalia/ui/lib/table";
import { Field } from "@/features/sales/form-fields";
import { ActionsMenu, EmptyState, IconAction, type Action } from "@/features/sales/list-parts";
import type { AccountKind, TreasuryAccount } from "@/mocks/settings";
import { ACCOUNT_ICONS } from "./account-icons";
import { ConfirmDialog, SettingsHeader } from "./settings-parts";
import { ACCOUNT_KIND_ORDER, ACCOUNT_KINDS, ACCOUNT_STATUS, maskNumber, PAYMENT_METHODS_PATH } from "./settings-model";
import { settingsStore, useSettings } from "./settings-store";

type StatusFilter = "all" | "active" | "inactive";

/** IBANs are grouped in fours; cards keep what was typed. */
function displayNumber(account: Pick<TreasuryAccount, "kind" | "number">): string {
  if (!account.number) return "—";
  return account.kind === "bank"
    ? formatIban(account.number)
    : account.kind === "card"
      ? maskNumber(account.number)
      : account.number;
}

function numberError(kind: AccountKind, number: string): string | undefined {
  const value = number.trim();
  if (!value) return kind === "bank" ? "Introduce el IBAN de la cuenta." : undefined;
  if (kind === "bank" && !isValidIban(value)) return "El IBAN no es válido. Revisa los dígitos de control.";
  if (kind === "paypal" && !isValidEmail(value)) return "Introduce el email de la cuenta de PayPal.";
  if (kind === "card" && !/^[\d\s•*]{4,23}$/.test(value))
    return "Solo dígitos: el número completo o los cuatro últimos.";
  return undefined;
}

/** New account: pick the kind first, then name it. Editing skips the first step. */
export function AccountDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: TreasuryAccount | null;
}) {
  const [kind, setKind] = useState<AccountKind | null>(account?.kind ?? null);
  const [name, setName] = useState(account?.name ?? "");
  const [number, setNumber] = useState(account?.number ?? "");
  const [submitted, setSubmitted] = useState(false);
  const config = kind ? ACCOUNT_KINDS[kind] : null;
  const errors = kind
    ? { name: name.trim() ? undefined : "Ponle un nombre a la cuenta.", number: numberError(kind, number) }
    : {};

  const choose = (k: AccountKind) => {
    setKind(k);
    if (!name.trim()) setName(k === "cash" ? "Efectivo / Caja" : "");
  };

  const save = () => {
    setSubmitted(true);
    if (!kind || errors.name || errors.number) return;
    const value = kind === "bank" ? formatIban(number) : number.trim();
    if (account) settingsStore.updateAccount(account.id, { name: name.trim(), number: value });
    else
      settingsStore.addAccount({
        id: newId(),
        kind,
        name: name.trim(),
        number: value,
        active: true,
      });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{account ? `Editar cuenta · ${account.name}` : "Nueva cuenta"}</DialogTitle>
        {!kind ? (
          <>
            <DialogDescription>Elige el tipo de cuenta bancaria o de tesorería que quieres crear.</DialogDescription>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {ACCOUNT_KIND_ORDER.map((k) => {
                const Icon = ACCOUNT_ICONS[k];
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => choose(k)}
                      className="flex w-full cursor-pointer items-center gap-3.5 rounded-lg border border-border bg-transparent px-4 py-3 text-left text-foreground transition-[background-color,scale] duration-150 hover:bg-accent active:scale-[0.99]"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <span className="flex flex-col">
                        <span className="font-semibold">{ACCOUNT_KINDS[k].label}</span>
                        <span className="text-sm text-muted-foreground">{ACCOUNT_KINDS[k].hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <DialogDescription>
              {account
                ? "Cambia el nombre o el número de la cuenta."
                : `${config!.label}. Podrás vincularla a tus métodos de cobro y pago.`}
            </DialogDescription>
            <Field label="Nombre" required error={submitted ? errors.name : undefined}>
              {(p) => <Input {...p} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            {config!.numberLabel && (
              <Field
                label={config!.numberLabel}
                required={kind === "bank"}
                error={submitted ? errors.number : undefined}
                hint={kind === "card" ? "Basta con los cuatro últimos dígitos." : undefined}
              >
                {(p) => (
                  <Input
                    {...p}
                    value={number}
                    inputMode={kind === "card" ? "numeric" : kind === "paypal" ? "email" : undefined}
                    spellCheck={false}
                    onChange={(e) => setNumber(e.target.value)}
                    className={cn(kind !== "paypal" && "font-mono uppercase")}
                  />
                )}
              </Field>
            )}
            {kind === "bank" && (
              <p className="m-0 flex items-start gap-2 text-sm text-muted-foreground">
                <RefreshCw className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                La sincronización automática con tu banco llegará más adelante. Por ahora la cuenta sirve para vincular
                cobros y pagos.
              </p>
            )}
            <div className="flex justify-between gap-2.5 pt-1">
              {!account ? (
                <Button variant="ghost" onClick={() => setKind(null)}>
                  Cambiar tipo
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2.5">
                <DialogClose asChild>
                  <Button variant="secondary">Cancelar</Button>
                </DialogClose>
                <Button type="submit">{account ? "Guardar" : "Crear cuenta"}</Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AccountsPage() {
  const { accounts, paymentMethods } = useSettings();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<TreasuryAccount | "new" | null>(null);
  const [removing, setRemoving] = useState<TreasuryAccount | null>(null);
  const shown = accounts.filter((a) => status === "all" || a.active === (status === "active"));
  const methodsOf = (id: string) => paymentMethods.filter((m) => m.accountId === id);

  const actions = (a: TreasuryAccount): Action[][] => [
    [
      { label: "Editar cuenta", icon: Pencil, run: () => setEditing(a) },
      {
        label: a.active ? "Desactivar cuenta" : "Activar cuenta",
        icon: Power,
        run: () => settingsStore.updateAccount(a.id, { active: !a.active }),
      },
      { label: "Activar sincronización (próximamente)", icon: RefreshCw },
    ],
    [{ label: "Eliminar cuenta", icon: Trash2, danger: true, run: () => setRemoving(a) }],
  ];

  const methodsCell = (account: TreasuryAccount) => {
    const linked = methodsOf(account.id);
    if (linked.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="flex flex-wrap gap-x-2 gap-y-0.5">
        {linked.map((m) => (
          <Link key={m.id} to={PAYMENT_METHODS_PATH} className="text-foreground underline-offset-2 hover:text-primary">
            {m.name}
          </Link>
        ))}
      </span>
    );
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8">
        <SettingsHeader
          title="Cuentas bancarias y de tesorería"
          description="Dónde entra y sale el dinero: cuentas, caja, PayPal y tarjetas."
        >
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            Nueva cuenta
          </Button>
        </SettingsHeader>

        <SegmentedControl
          label="Estado"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todas" },
            { value: "active", label: "Activas" },
            { value: "inactive", label: "Inactivas" },
          ]}
          className="self-start"
        />

        {shown.length === 0 ? (
          <div className="rounded-xl border border-border">
            <EmptyState
              message={accounts.length === 0 ? "Todavía no tienes cuentas" : "Ninguna cuenta con este estado"}
              hint={
                accounts.length === 0
                  ? "Crea tu cuenta bancaria principal para vincular tus cobros y pagos."
                  : "Prueba con otro filtro."
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
                      Tipo
                    </th>
                    <th scope="col" className={table.th}>
                      Nombre
                    </th>
                    <th scope="col" className={table.th}>
                      Número de cuenta / tarjeta
                    </th>
                    <th scope="col" className={table.th}>
                      Métodos de cobro / pago
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
                  {shown.map((a, i) => {
                    const Icon = ACCOUNT_ICONS[a.kind];
                    const state = ACCOUNT_STATUS[a.active ? "active" : "inactive"];
                    return (
                      <tr key={a.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                        <td className={cn(table.td, "whitespace-nowrap")}>
                          <span className="inline-flex items-center gap-2.5">
                            <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                            </span>
                            {ACCOUNT_KINDS[a.kind].label}
                          </span>
                        </td>
                        <td className={cn(table.td, "font-medium")}>{a.name}</td>
                        <td className={cn(table.td, "font-mono text-sm whitespace-nowrap")}>{displayNumber(a)}</td>
                        <td className={table.td}>{methodsCell(a)}</td>
                        <td className={table.td}>
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </td>
                        <td className={cn(table.td, "whitespace-nowrap")}>
                          <span className="flex justify-end gap-0.5">
                            <IconAction action={{ label: "Editar cuenta", icon: Pencil, run: () => setEditing(a) }} />
                            <ActionsMenu
                              groups={actions(a)}
                              trigger={
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Más opciones de ${a.name}`}
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
              {shown.map((a) => {
                const Icon = ACCOUNT_ICONS[a.kind];
                const state = ACCOUNT_STATUS[a.active ? "active" : "inactive"];
                return (
                  <li key={a.id} className="flex items-start gap-3 rounded-xl border border-border p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{a.name}</span>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{ACCOUNT_KINDS[a.kind].label}</span>
                      {a.number && <span className="truncate font-mono text-sm">{displayNumber(a)}</span>}
                      <span className="text-sm">{methodsCell(a)}</span>
                    </div>
                    <ActionsMenu
                      groups={actions(a)}
                      trigger={
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Opciones de ${a.name}`}
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
              {shown.length} {shown.length === 1 ? "cuenta" : "cuentas"}
            </p>
          </>
        )}

        {editing && (
          <AccountDialog
            key={editing === "new" ? "new" : editing.id}
            open
            onOpenChange={(open) => !open && setEditing(null)}
            account={editing === "new" ? null : editing}
          />
        )}
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Eliminar cuenta"
          confirmLabel="Eliminar"
          danger
          onConfirm={() => removing && settingsStore.removeAccount(removing.id)}
        >
          <p className="m-0">Se eliminará la cuenta «{removing?.name}».</p>
          {removing && methodsOf(removing.id).length > 0 && (
            <p className="m-0">
              Sus métodos de cobro y pago (
              {methodsOf(removing.id)
                .map((m) => m.name)
                .join(", ")}
              ) seguirán disponibles, sin cuenta vinculada.
            </p>
          )}
        </ConfirmDialog>
      </div>
    </TooltipProvider>
  );
}
