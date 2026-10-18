import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { FileDown, FileUp, TriangleAlert } from "lucide-react";
import {
  isDuplicateMovement,
  parseBankStatement,
  toIsoDate,
  type Cents,
  type ReconciliationStatus,
  type StatementLine,
  type StatementParse,
} from "@fiscalia/core";
import type { TreasuryAccount } from "@fiscalia/contracts";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { Input, Textarea } from "@fiscalia/ui/components/input";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { table } from "@fiscalia/ui/lib/table";
import { ACCOUNT_ICONS } from "@/features/settings/account-icons";
import {
  ACCOUNTS_PATH,
  defaultPaymentMethodId,
  maskNumber,
  paymentMethodOptions,
} from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { formatDate, formatEurosInput, parseEuros } from "@/lib/format";
import { RECONCILIATION } from "./treasury-model";
import { treasuryStore } from "./treasury-store";

/* Building blocks shared by the treasury pages. */

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">{title}</h1>
        <p className="m-0 text-sm text-muted-foreground">{description}</p>
      </div>
      {children && <div className="flex flex-wrap gap-2.5">{children}</div>}
    </header>
  );
}

export function ReconciliationBadge({ status }: { status: ReconciliationStatus }) {
  return <Badge tone={RECONCILIATION[status].tone}>{RECONCILIATION[status].label}</Badge>;
}

/** Green for money in, plain for money out, with an explicit sign. */
export function SignedAmount({ value, className }: { value: Cents; className?: string }) {
  return (
    <span className={cn("amount whitespace-nowrap", value > 0 && "text-success", className)}>
      {value > 0 ? "+" : ""}
      {formatEUR(value)}
    </span>
  );
}

export function accountNumber(account: Pick<TreasuryAccount, "kind" | "number">): string {
  if (!account.number) return "";
  return account.kind === "bank" || account.kind === "card" ? maskNumber(account.number) : account.number;
}

/** Account picker as cards, like the one the reference app shows before importing. */
function AccountPicker({
  accounts,
  value,
  onChange,
}: {
  accounts: TreasuryAccount[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Cuenta" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {accounts.map((a) => {
        const Icon = ACCOUNT_ICONS[a.kind];
        const selected = a.id === value;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(a.id)}
            className={cn(
              "flex min-w-0 cursor-pointer flex-col items-start gap-1.5 rounded-lg border bg-transparent px-3 py-2.5 text-left text-foreground transition-[background-color,border-color,scale] duration-150 hover:bg-accent active:scale-[0.98]",
              selected ? "border-primary bg-primary-soft hover:bg-primary-soft" : "border-border",
            )}
          >
            <Icon className={cn("size-4", selected ? "text-primary" : "text-muted-foreground")} strokeWidth={1.8} />
            <span className="w-full truncate text-sm font-semibold">{a.name}</span>
            {a.number && <span className="font-mono text-2xs text-muted-foreground">{accountNumber(a)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function NoAccounts() {
  return (
    <p className="m-0 rounded-lg bg-muted px-4 py-3 text-sm">
      Todavía no tienes cuentas activas.{" "}
      <Link to={ACCOUNTS_PATH} className="font-medium text-primary no-underline hover:text-primary-hover">
        Crea una en Configuración
      </Link>
      .
    </p>
  );
}

/* ─────────────────────────────── Manual movement ─────────────────────────────── */

export function MovementDialog({
  open,
  onOpenChange,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
}) {
  const accounts = useSettings().accounts.filter((a) => a.active);
  const [account, setAccount] = useState(
    accountId ?? accounts.find((a) => a.kind === "cash")?.id ?? accounts[0]?.id ?? "",
  );
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [reference, setReference] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const value = parseEuros(amount);
  const errors = {
    date: date ? undefined : "Indica la fecha.",
    amount: value === null || value === 0 ? "Introduce un importe distinto de cero." : undefined,
    concept: concept.trim() ? undefined : "Describe el movimiento.",
  };
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);

  const save = () => {
    setSubmitted(true);
    if (!account || errors.date || errors.amount || errors.concept) return;
    treasuryStore.addMovements([
      {
        accountId: account,
        date,
        amount: value!,
        concept: concept.trim(),
        reference: reference.trim(),
        balance: null,
        source: "manual",
      },
    ]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Nuevo movimiento manual</DialogTitle>
        <DialogDescription>
          Para la caja o para un movimiento que no venga en el extracto. Usa un importe positivo para una entrada y
          negativo para una salida.
        </DialogDescription>
        {accounts.length === 0 ? (
          <NoAccounts />
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <AccountPicker accounts={accounts} value={account} onChange={setAccount} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha" required error={show("date")}>
                {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
              </Field>
              <Field label="Importe" required error={show("amount")} help="Positivo si entra dinero, negativo si sale.">
                {(p) => (
                  <Input
                    {...p}
                    inputMode="decimal"
                    placeholder="-25,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-right amount"
                  />
                )}
              </Field>
            </div>
            <Field label="Concepto" required error={show("concept")}>
              {(p) => <Textarea {...p} rows={2} value={concept} onChange={(e) => setConcept(e.target.value)} />}
            </Field>
            <Field label="Referencia" help="Un número de recibo o justificante, si lo tiene.">
              {(p) => <Input {...p} value={reference} onChange={(e) => setReference(e.target.value)} />}
            </Field>
            <div className="flex justify-end gap-2.5 pt-1">
              <DialogClose asChild>
                <Button variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit">Guardar movimiento</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────── Statement import ─────────────────────────────── */

const TEMPLATE = [
  "Fecha;Concepto;Importe;Saldo;Referencia",
  "01/10/2026;TRANSFERENCIA DE CLIENTE EJEMPLO S.L.;1.210,00;5.420,35;2026-0047",
  "05/10/2026;RECIBO TGSS CUOTA AUTONOMOS;-294,00;5.126,35;",
].join("\n");

function downloadTemplate() {
  const blob = new Blob([`﻿${TEMPLATE}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: "plantilla-movimientos.csv" }).click();
  URL.revokeObjectURL(url);
}

interface Preview extends StatementParse {
  fileName: string;
  /** Lines already in the account, which the import skips. */
  duplicates: number;
}

export function ImportDialog({
  open,
  onOpenChange,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
}) {
  const accounts = useSettings().accounts.filter((a) => a.active && a.kind !== "cash");
  const [account, setAccount] = useState(accountId ?? accounts[0]?.id ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dragging, setDragging] = useState(false);

  const existing = () => treasuryStore.get().movements.filter((m) => m.accountId === account);
  const fresh = preview ? preview.lines.filter((l) => !isDuplicateMovement(l, existing())) : [];

  const read = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseBankStatement(await file.text());
    const duplicates = parsed.lines.filter((l) => isDuplicateMovement(l, existing())).length;
    setPreview({ ...parsed, fileName: file.name, duplicates });
  };

  const pick = () => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: ".csv,.txt,text/csv" });
    input.onchange = () => void read(input.files?.[0]);
    input.click();
  };

  const confirm = () => {
    treasuryStore.addMovements(fresh.map((l) => ({ ...l, accountId: account, source: "import" as const })));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Importar movimientos</DialogTitle>
        <DialogDescription>
          Descarga el extracto desde la web de tu banco en formato CSV y súbelo aquí. Reconocemos las columnas Fecha,
          Concepto e Importe (o Debe y Haber), y también Saldo y Referencia si vienen.
        </DialogDescription>
        {accounts.length === 0 ? (
          <NoAccounts />
        ) : (
          <>
            <AccountPicker
              accounts={accounts}
              value={account}
              onChange={(id) => {
                setAccount(id);
                setPreview(null);
              }}
            />
            <button
              type="button"
              onClick={pick}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void read(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed bg-transparent px-4 py-7 text-center text-foreground transition-colors duration-150 hover:bg-accent",
                dragging ? "border-primary bg-primary-soft" : "border-input",
              )}
            >
              <FileUp className="size-6 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
              <span className="font-medium">
                {preview ? preview.fileName : "Arrastra aquí el extracto o haz clic para buscarlo"}
              </span>
              <span className="text-sm text-muted-foreground">
                {preview ? "Haz clic para elegir otro archivo" : "Archivo .csv exportado de tu banco"}
              </span>
            </button>

            {preview && <ImportPreview preview={preview} fresh={fresh} />}

            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <Button variant="ghost" size="md" onClick={downloadTemplate}>
                <FileDown strokeWidth={1.8} aria-hidden="true" />
                Descargar plantilla
              </Button>
              <div className="flex gap-2.5">
                <DialogClose asChild>
                  <Button variant="secondary">Cancelar</Button>
                </DialogClose>
                <Button disabled={fresh.length === 0} onClick={confirm}>
                  {fresh.length > 0
                    ? `Importar ${fresh.length} ${fresh.length === 1 ? "movimiento" : "movimientos"}`
                    : "Importar"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportPreview({ preview, fresh }: { preview: Preview; fresh: StatementLine[] }) {
  const shown = fresh.slice(0, 6);
  return (
    <div className="flex animate-fade-in flex-col gap-3">
      <p className="m-0 text-sm">
        <strong>{fresh.length}</strong> {fresh.length === 1 ? "movimiento nuevo" : "movimientos nuevos"}
        {preview.duplicates > 0 && (
          <span className="text-muted-foreground">
            {" "}
            · {preview.duplicates} ya {preview.duplicates === 1 ? "estaba importado" : "estaban importados"} y se omiten
          </span>
        )}
      </p>
      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={table.headRow}>
                <th className={table.th}>Fecha</th>
                <th className={table.th}>Concepto</th>
                <th className={cn(table.th, "text-right")}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l, i) => (
                <tr key={i} className={table.row}>
                  <td className={cn(table.td, "whitespace-nowrap text-muted-foreground")}>{formatDate(l.date)}</td>
                  <td className={cn(table.td, "max-w-72 truncate")}>{l.concept || "—"}</td>
                  <td className={cn(table.td, "text-right")}>
                    <SignedAmount value={l.amount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {fresh.length > shown.length && (
            <p className="m-0 border-t border-border px-4 py-2 text-xs text-muted-foreground">
              y {fresh.length - shown.length} más…
            </p>
          )}
        </div>
      )}
      {preview.errors.length > 0 && (
        <div className="flex gap-2.5 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {preview.errors.slice(0, 4).map((e) => (
              <li key={e.line}>
                {preview.lines.length > 0 || e.line > 1 ? `Línea ${e.line}: ` : ""}
                {e.message}
              </li>
            ))}
            {preview.errors.length > 4 && <li>y {preview.errors.length - 4} errores más.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── Manual payment ─────────────────────────────── */

export interface ManualPaymentDraft {
  amount: Cents;
  date: string;
  description: string;
  paymentMethodId: string;
}

export function ManualPaymentDialog({
  open,
  onOpenChange,
  initial,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled from a movement being reconciled. */
  initial?: Partial<ManualPaymentDraft>;
  onCreated?: (key: string) => void;
}) {
  const [amount, setAmount] = useState(initial?.amount !== undefined ? formatEurosInput(initial.amount) : "");
  const [date, setDate] = useState(initial?.date ?? toIsoDate(new Date()));
  const [methodId, setMethodId] = useState(initial?.paymentMethodId || defaultPaymentMethodId());
  const [description, setDescription] = useState(initial?.description ?? "");
  const [submitted, setSubmitted] = useState(false);

  const value = parseEuros(amount);
  const errors = {
    amount: value === null || value === 0 ? "Introduce un importe distinto de cero." : undefined,
    date: date ? undefined : "Indica la fecha.",
    method: methodId ? undefined : "Elige el método de cobro o pago.",
    description: description.trim() ? undefined : "Describe el cobro o pago.",
  };
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const key = treasuryStore.addManualPayment({
      amount: value!,
      date,
      paymentMethodId: methodId,
      description: description.trim(),
    });
    onCreated?.(key);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Nuevo cobro / pago manual</DialogTitle>
        <DialogDescription>
          Para dinero que entra o sale sin factura ni gasto detrás: un préstamo, un traspaso entre cuentas, un ajuste
          para cuadrar la conciliación… Positivo para cobros y negativo para pagos.
        </DialogDescription>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cantidad cobrada o pagada" required error={show("amount")}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  placeholder="-1.500,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-right amount"
                />
              )}
            </Field>
            <Field label="Fecha" required error={show("date")}>
              {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
            </Field>
          </div>
          <Field label="Método de cobro / pago" required error={show("method")}>
            {(p) => (
              <GroupedSelect
                {...p}
                value={methodId}
                onChange={setMethodId}
                groups={[{ options: paymentMethodOptions(methodId) }]}
              />
            )}
          </Field>
          <Field label="Descripción" required error={show("description")}>
            {(p) => <Textarea {...p} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit">{onCreated ? "Guardar y conciliar" : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
