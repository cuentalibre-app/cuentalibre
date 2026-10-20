import { useState, type CSSProperties } from "react";
import { MoreHorizontal, Pencil, Plus, Power, RefreshCw, Star, Trash2 } from "lucide-react";
import { formatIban, isValidEmail, isValidIban, newId } from "@fiscalia/core";
import type { AccountKind, PaymentMethod, TreasuryAccount } from "@fiscalia/contracts";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { DropdownMenuTrigger } from "@fiscalia/ui/components/dropdown-menu";
import { Input } from "@fiscalia/ui/components/input";
import { SegmentedControl } from "@fiscalia/ui/components/segmented-control";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { Field } from "@/features/sales/form-fields";
import { ActionsMenu, EmptyState, IconAction, type Action } from "@/features/sales/list-parts";
import { ACCOUNT_ICONS } from "./account-icons";
import { accountRemoval, takesMethod } from "./account-methods";
import { MethodDialog } from "./method-dialog";
import { accountMovements, methodUsage } from "./method-usage";
import { ConfirmDialog, SettingsHeader } from "./settings-parts";
import {
  ACCOUNT_KIND_ORDER,
  ACCOUNT_KINDS,
  ACCOUNT_STATUS,
  ACTIVE_STATUS,
  maskNumber,
  methodTypeLabel,
  usePaymentMethods,
} from "./settings-model";
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
                : `${config!.label}. Se creará con su método de cobro y pago, listo para tus facturas.`}
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

function MoreButton({ label }: { label: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" aria-label={label} className="size-8 px-0">
        <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
  );
}

const isUsed = (methodId: string) => methodUsage(methodId) > 0;
const names = (methods: PaymentMethod[]) => methods.map((m) => `«${m.name}»`).join(", ");

/** Treasury accounts, each with the payment methods that book into it. */
export function AccountsPage() {
  const { accounts, defaultPaymentMethodId } = useSettings();
  const methods = usePaymentMethods();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<TreasuryAccount | "new" | null>(null);
  const [editingMethod, setEditingMethod] = useState<{ method: PaymentMethod | null; accountId: string | null } | null>(
    null,
  );
  const [removing, setRemoving] = useState<TreasuryAccount | null>(null);
  const [blocked, setBlocked] = useState<{ account: TreasuryAccount; movements: number } | null>(null);
  const [removingMethod, setRemovingMethod] = useState<PaymentMethod | null>(null);
  const [blockedMethod, setBlockedMethod] = useState<{ method: PaymentMethod; uses: number } | null>(null);

  const matches = (active: boolean) => status === "all" || active === (status === "active");
  const shown = accounts.filter((a) => matches(a.active));
  const methodsOf = (id: string | null) => methods.filter((m) => m.accountId === id);
  // Methods with no account: cheques, or the ones kept after their account was removed
  const unlinked = methodsOf(null).filter((m) => matches(m.active));
  const removal =
    removing && accountRemoval({ accounts, paymentMethods: methods, defaultPaymentMethodId }, removing.id, isUsed);

  const askRemove = (a: TreasuryAccount) => {
    const movements = accountMovements(a.id);
    if (movements > 0) setBlocked({ account: a, movements });
    else setRemoving(a);
  };

  const askRemoveMethod = (m: PaymentMethod) => {
    const uses = methodUsage(m.id);
    if (uses > 0) setBlockedMethod({ method: m, uses });
    else setRemovingMethod(m);
  };

  const accountActions = (a: TreasuryAccount): Action[][] => [
    [
      { label: "Editar cuenta", icon: Pencil, run: () => setEditing(a) },
      // Cash, PayPal and a credit card are a single method: only a bank account takes more
      ...(takesMethod(a, methods)
        ? [{ label: "Añadir método", icon: Plus, run: () => setEditingMethod({ method: null, accountId: a.id }) }]
        : []),
      {
        label: a.active ? "Desactivar cuenta" : "Activar cuenta",
        icon: Power,
        run: () => settingsStore.setAccountActive(a.id, !a.active),
      },
      { label: "Activar sincronización (próximamente)", icon: RefreshCw },
    ],
    [{ label: "Eliminar cuenta", icon: Trash2, danger: true, run: () => askRemove(a) }],
  ];

  const methodActions = (m: PaymentMethod): Action[][] => {
    const isDefault = m.id === defaultPaymentMethodId;
    const account = accounts.find((a) => a.id === m.accountId);
    return [
      [
        {
          label: "Establecer por defecto",
          icon: Star,
          run: isDefault || !m.active ? undefined : () => settingsStore.setDefaultPaymentMethod(m.id),
        },
        { label: "Editar método", icon: Pencil, run: () => setEditingMethod({ method: m, accountId: m.accountId }) },
        {
          label: m.active ? "Desactivar método" : "Activar método",
          icon: Power,
          // The default method stays active: it's proposed on every new document. An inactive
          // account's methods wait for the account.
          run:
            isDefault || (!m.active && account && !account.active)
              ? undefined
              : () => settingsStore.updatePaymentMethod(m.id, { active: !m.active }),
        },
      ],
      [{ label: "Eliminar método", icon: Trash2, danger: true, run: isDefault ? undefined : () => askRemoveMethod(m) }],
    ];
  };

  const methodList = (list: PaymentMethod[], account: TreasuryAccount | null) => (
    <ul className="m-0 flex list-none flex-col p-0">
      {list.map((m) => (
        <li key={m.id} className="flex items-center gap-3 border-t border-border py-2.5 pr-3 pl-4 lg:pl-[4.25rem]">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2.5">
              <span className={cn("truncate font-medium", !m.active && "text-muted-foreground")}>{m.name}</span>
              {m.id === defaultPaymentMethodId && defaultMark}
            </span>
            <span className="text-sm text-muted-foreground sm:ml-auto">
              {methodTypeLabel(m.type)}
              {m.number && <span className="font-mono"> · {maskNumber(m.number)}</span>}
            </span>
          </div>
          {!m.active && <Badge tone={ACTIVE_STATUS.inactive.tone}>{ACTIVE_STATUS.inactive.label}</Badge>}
          <ActionsMenu groups={methodActions(m)} trigger={<MoreButton label={`Más opciones del método ${m.name}`} />} />
        </li>
      ))}
      {account && takesMethod(account, methods) && (
        <li className="border-t border-border py-1.5 pl-2 lg:pl-14">
          <Button variant="ghost" size="sm" onClick={() => setEditingMethod({ method: null, accountId: account.id })}>
            <Plus aria-hidden="true" />
            Añadir método
          </Button>
        </li>
      )}
    </ul>
  );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8">
        <SettingsHeader
          title="Cuentas y métodos de pago"
          description="Dónde entra y sale el dinero, y cómo te pagan tus clientes y pagas a tus proveedores."
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

        {shown.length === 0 && unlinked.length === 0 ? (
          <div className="rounded-xl border border-border">
            <EmptyState
              message={accounts.length === 0 ? "Todavía no tienes cuentas" : "Ninguna cuenta con este estado"}
              hint={
                accounts.length === 0
                  ? "Crea tu cuenta bancaria principal: tendrá su método de cobro y pago para tus facturas."
                  : "Prueba con otro filtro."
              }
            />
          </div>
        ) : (
          <>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {shown.map((a, i) => {
                const Icon = ACCOUNT_ICONS[a.kind];
                const state = ACCOUNT_STATUS[a.active ? "active" : "inactive"];
                return (
                  <li
                    key={a.id}
                    className="animate-row-in overflow-hidden rounded-xl border border-border"
                    style={{ "--i": i } as CSSProperties}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="truncate font-semibold">{a.name}</span>
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {ACCOUNT_KINDS[a.kind].label}
                          {a.number && <span className="font-mono"> · {displayNumber(a)}</span>}
                        </span>
                      </div>
                      <span className="flex gap-0.5">
                        <span className="hidden lg:contents">
                          <IconAction action={{ label: "Editar cuenta", icon: Pencil, run: () => setEditing(a) }} />
                        </span>
                        <ActionsMenu
                          groups={accountActions(a)}
                          trigger={<MoreButton label={`Más opciones de la cuenta ${a.name}`} />}
                        />
                      </span>
                    </div>
                    {methodList(methodsOf(a.id), a)}
                  </li>
                );
              })}
              {unlinked.length > 0 && (
                <li className="overflow-hidden rounded-xl border border-border">
                  <div className="flex flex-col gap-0.5 p-4">
                    <span className="font-semibold">Sin cuenta vinculada</span>
                    <span className="text-sm text-muted-foreground">
                      Métodos que no se anotan en ninguna cuenta, como los pagarés, o que conservan documentos de una
                      cuenta eliminada.
                    </span>
                  </div>
                  {methodList(unlinked, null)}
                </li>
              )}
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
        {editingMethod && (
          <MethodDialog
            key={editingMethod.method?.id ?? `new-${editingMethod.accountId}`}
            open
            onOpenChange={(open) => !open && setEditingMethod(null)}
            method={editingMethod.method}
            accountId={editingMethod.accountId}
          />
        )}

        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Eliminar cuenta"
          confirmLabel="Eliminar"
          danger
          onConfirm={() => removing && settingsStore.removeAccount(removing.id, isUsed)}
        >
          <p className="m-0">Se eliminará la cuenta «{removing?.name}».</p>
          {removal && removal.removed.length > 0 && (
            <p className="m-0">
              También {removal.removed.length === 1 ? "se eliminará su método" : "se eliminarán sus métodos"} de cobro y
              pago: {names(removal.removed)}.
            </p>
          )}
          {removal && removal.kept.length > 0 && (
            <p className="m-0">
              {names(removal.kept)} {removal.kept.length === 1 ? "aparece" : "aparecen"} en documentos o contactos:{" "}
              {removal.kept.length === 1 ? "se conservará desactivado" : "se conservarán desactivados"}, sin cuenta
              vinculada.
            </p>
          )}
        </ConfirmDialog>
        <ConfirmDialog
          open={blocked !== null}
          onOpenChange={(open) => !open && setBlocked(null)}
          title="Esta cuenta tiene movimientos"
          confirmLabel="Desactivar"
          onConfirm={() => blocked && settingsStore.setAccountActive(blocked.account.id, false)}
        >
          <p className="m-0">
            «{blocked?.account.name}» tiene {blocked?.movements}{" "}
            {blocked?.movements === 1 ? "movimiento bancario" : "movimientos bancarios"}, así que no se puede eliminar.
          </p>
          <p className="m-0">
            Puedes desactivarla: sus métodos de cobro y pago dejarán de proponerse, pero los documentos los conservan.
          </p>
        </ConfirmDialog>
        <ConfirmDialog
          open={removingMethod !== null}
          onOpenChange={(open) => !open && setRemovingMethod(null)}
          title="Eliminar método"
          confirmLabel="Eliminar"
          danger
          onConfirm={() => removingMethod && settingsStore.removePaymentMethod(removingMethod.id)}
        >
          <p className="m-0">
            Se eliminará el método «{removingMethod?.name}». No lo usa ningún documento ni contacto.
          </p>
        </ConfirmDialog>
        <ConfirmDialog
          open={blockedMethod !== null}
          onOpenChange={(open) => !open && setBlockedMethod(null)}
          title="Este método está en uso"
          confirmLabel="Desactivar"
          onConfirm={() =>
            blockedMethod && settingsStore.updatePaymentMethod(blockedMethod.method.id, { active: false })
          }
        >
          <p className="m-0">
            «{blockedMethod?.method.name}» aparece en {blockedMethod?.uses}{" "}
            {blockedMethod?.uses === 1 ? "documento o contacto" : "documentos o contactos"}, así que no se puede
            eliminar.
          </p>
          <p className="m-0">Puedes desactivarlo: dejará de proponerse, pero los documentos lo conservan.</p>
        </ConfirmDialog>
      </div>
    </TooltipProvider>
  );
}
