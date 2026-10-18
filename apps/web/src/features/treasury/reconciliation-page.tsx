import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router";
import { CircleCheck, HandCoins, Search, Sparkles, Unlink, X } from "lucide-react";
import {
  autoReconcile,
  cents,
  rankCandidates,
  reconciliationStatus,
  sumBy,
  type Cents,
  type ReconciliationStatus,
} from "@fiscalia/core";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { Checkbox } from "@fiscalia/ui/components/input";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { GroupedSelect } from "@/features/sales/form-fields";
import { EmptyState } from "@/features/sales/list-parts";
import { useSettings } from "@/features/settings/settings-store";
import { formatDate } from "@/lib/format";
import type { BankMovement } from "@/mocks/treasury";
import { ManualPaymentDialog, PageHeader, ReconciliationBadge, SignedAmount } from "./treasury-parts";
import {
  PAYMENT_SOURCES,
  accountName,
  matchedAmount,
  methodForAccount,
  type PaymentSource,
  type PendingDocument,
  type TreasuryPayment,
} from "./treasury-model";
import { treasuryStore, usePayments, usePendingDocuments, useTreasury } from "./treasury-store";

const ALL = "all";
const OPEN = "open";

/** Something a movement can be reconciled with: a recorded payment, or a document still pending. */
interface Candidate {
  id: string;
  date: string;
  amount: Cents;
  source: PaymentSource;
  reference: string;
  counterparty: string;
  href: string | null;
  payment?: TreasuryPayment;
  pending?: PendingDocument;
}

interface Row {
  movement: BankMovement;
  status: ReconciliationStatus;
  /** What is still unexplained: the movement's amount minus the linked payments. */
  remaining: Cents;
  linked: TreasuryPayment[];
}

function reconcileWith(movementId: string, candidates: Candidate[]) {
  treasuryStore.reconcile(
    movementId,
    candidates.filter((c) => c.payment).map((c) => c.id),
    candidates.filter((c) => c.pending).map((c) => c.pending!),
  );
}

export function ReconciliationPage() {
  const [params] = useSearchParams();
  const focusId = params.get("movimiento");
  const { accounts, paymentMethods, defaultPaymentMethodId } = useSettings();
  const { movements } = useTreasury();
  const payments = usePayments();
  const pending = usePendingDocuments();
  const [account, setAccount] = useState(ALL);
  const [direction, setDirection] = useState(ALL);
  const [status, setStatus] = useState(OPEN);
  const [notice, setNotice] = useState<string | null>(null);
  const [searching, setSearching] = useState<Row | null>(null);
  const [registering, setRegistering] = useState<Row | null>(null);

  const byKey = useMemo(() => new Map(payments.map((p) => [p.key, p])), [payments]);
  const linkedKeys = useMemo(() => new Set(movements.flatMap((m) => m.paymentKeys)), [movements]);

  const allRows = useMemo(
    () =>
      movements.map((movement): Row => {
        const matched = matchedAmount(movement, byKey);
        return {
          movement,
          status: reconciliationStatus(movement.amount, matched),
          remaining: cents(movement.amount - matched),
          linked: movement.paymentKeys.map((k) => byKey.get(k)).filter((p) => p !== undefined),
        };
      }),
    [movements, byKey],
  );

  /** Unlinked payments of the movement's account (or of none), and every pending document. */
  const candidatesFor = (movement: BankMovement): Candidate[] => [
    ...payments
      .filter((p) => !linkedKeys.has(p.key) && (p.accountId === movement.accountId || p.accountId === null))
      .map((p) => ({ ...p, id: p.key, payment: p })),
    ...pending.map((d) => ({ ...d, id: d.key, pending: d })),
  ];

  const rows = allRows
    .filter(
      (r) =>
        (account === ALL || r.movement.accountId === account) &&
        (direction === ALL || (direction === "in" ? r.movement.amount > 0 : r.movement.amount < 0)) &&
        (status === ALL || (status === OPEN ? r.status !== "full" : r.status === status)),
    )
    .sort((a, b) =>
      a.movement.id === focusId ? -1 : b.movement.id === focusId ? 1 : b.movement.date.localeCompare(a.movement.date),
    );
  const open = allRows.filter((r) => r.status !== "full");

  const runAuto = () => {
    const used = new Set<string>();
    let count = 0;
    for (const acc of new Set(open.map((r) => r.movement.accountId))) {
      const own = open.filter((r) => r.movement.accountId === acc && r.status === "none");
      if (own.length === 0) continue;
      const pool = candidatesFor(own[0]!.movement).filter((c) => !used.has(c.id));
      const pairs = autoReconcile(
        own.map((r) => ({ id: r.movement.id, date: r.movement.date, amount: r.remaining })),
        pool,
      );
      for (const pair of pairs) {
        used.add(pair.candidateId);
        reconcileWith(pair.movementId, [pool.find((c) => c.id === pair.candidateId)!]);
      }
      count += pairs.length;
    }
    setNotice(
      count > 0
        ? `Se ${count === 1 ? "ha conciliado 1 movimiento" : `han conciliado ${count} movimientos`} con documentos del mismo importe.`
        : "No hay coincidencias exactas e inequívocas. Revisa las sugerencias de cada movimiento.",
    );
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8">
        <PageHeader
          title="Conciliación"
          description="Revisa tus movimientos bancarios y cásalos con tus facturas, gastos y cobros o pagos registrados."
        >
          <Button onClick={runAuto} disabled={open.length === 0}>
            <Sparkles strokeWidth={2} aria-hidden="true" />
            Conciliación automática
          </Button>
        </PageHeader>

        {notice && (
          <div
            role="status"
            className="flex animate-fade-in items-start gap-2.5 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary"
          >
            <CircleCheck className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setNotice(null)}
              className="flex cursor-pointer border-0 bg-transparent p-0 text-primary"
            >
              <X className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <GroupedSelect
            id="rec-account"
            aria-label="Cuenta"
            value={account}
            onChange={setAccount}
            groups={[
              {
                options: [
                  { value: ALL, label: "Todas las cuentas" },
                  ...accounts.map((a) => ({ value: a.id, label: a.name })),
                ],
              },
            ]}
            className="w-auto min-w-44 font-medium"
          />
          <GroupedSelect
            id="rec-direction"
            aria-label="Tipo"
            value={direction}
            onChange={setDirection}
            groups={[
              {
                options: [
                  { value: ALL, label: "Cobros y pagos" },
                  { value: "in", label: "Solo cobros" },
                  { value: "out", label: "Solo pagos" },
                ],
              },
            ]}
            className="w-auto min-w-40 font-medium"
          />
          <GroupedSelect
            id="rec-status"
            aria-label="Estado de la conciliación"
            value={status}
            onChange={setStatus}
            groups={[
              {
                options: [
                  { value: OPEN, label: "Sin conciliar o parcial" },
                  { value: "none", label: "Sin conciliar" },
                  { value: "partial", label: "Parcialmente conciliados" },
                  { value: "full", label: "Conciliados" },
                  { value: ALL, label: "Todos" },
                ],
              },
            ]}
            className="w-auto min-w-52 font-medium"
          />
          <span className="ml-auto text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "movimiento" : "movimientos"}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-border">
            <EmptyState
              message={status === OPEN ? "Todo conciliado" : "Ningún movimiento con estos filtros"}
              hint={
                status === OPEN
                  ? "Cada movimiento de tus cuentas cuadra con un documento. Importa un extracto nuevo cuando quieras."
                  : "Prueba con otro filtro."
              }
            />
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {rows.map((r, i) => (
              <MovementCard
                key={r.movement.id}
                row={r}
                index={i}
                focused={r.movement.id === focusId}
                account={accountName(r.movement.accountId, accounts)}
                candidates={r.status === "full" ? [] : candidatesFor(r.movement)}
                onSearch={() => setSearching(r)}
                onRegister={() => setRegistering(r)}
              />
            ))}
          </ul>
        )}

        {searching && (
          <MatchDialog
            row={searching}
            candidates={candidatesFor(searching.movement)}
            onOpenChange={(o) => !o && setSearching(null)}
          />
        )}
        {registering && (
          <ManualPaymentDialog
            open
            onOpenChange={(o) => !o && setRegistering(null)}
            initial={{
              amount: registering.remaining,
              date: registering.movement.date,
              description: registering.movement.concept,
              paymentMethodId:
                methodForAccount(registering.movement.accountId, paymentMethods, defaultPaymentMethodId) ?? undefined,
            }}
            onCreated={(key) => treasuryStore.reconcile(registering.movement.id, [key])}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

function MovementCard({
  row,
  index,
  focused,
  account,
  candidates,
  onSearch,
  onRegister,
}: {
  row: Row;
  index: number;
  focused: boolean;
  account: string;
  candidates: Candidate[];
  onSearch: () => void;
  onRegister: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "center" });
  }, [focused]);

  const { movement } = row;
  // Only exact amounts: a smaller document is rarely the answer, and grouped ones are picked in the search
  const suggestions = rankCandidates({ date: movement.date, amount: row.remaining }, candidates)
    .filter((r) => r.exact)
    .slice(0, 3);

  return (
    <li
      ref={ref}
      className={cn(
        "grid animate-rise-in overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
        focused ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}
      style={{ "--i": Math.min(index, 10) } as CSSProperties}
    >
      <div className="flex flex-col gap-2 border-b border-border p-4 lg:border-r lg:border-b-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">
              {formatDate(movement.date)} · {account}
            </span>
            <span className="font-semibold break-words">{movement.concept}</span>
            {movement.reference && (
              <span className="font-mono text-xs text-muted-foreground">{movement.reference}</span>
            )}
          </div>
          <SignedAmount value={movement.amount} className="text-lg font-semibold" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReconciliationBadge status={row.status} />
          {row.status === "partial" && (
            <span className="text-xs text-muted-foreground">
              Falta <span className="amount text-foreground">{formatEUR(row.remaining)}</span>
            </span>
          )}
        </div>
        {row.linked.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {row.linked.map((p) => (
              <li key={p.key} className="flex items-center gap-2">
                <CircleCheck className="size-3.5 shrink-0 text-success" strokeWidth={2} aria-hidden="true" />
                <DocLink candidate={p} />
                <span className="ml-auto amount text-muted-foreground">{formatEUR(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        {row.linked.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => treasuryStore.unreconcile(movement.id)}
          >
            <Unlink strokeWidth={1.8} aria-hidden="true" />
            Deshacer conciliación
          </Button>
        )}
      </div>

      {row.status !== "full" && (
        <div className="flex flex-col gap-2 bg-muted/40 p-4">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {suggestions.length > 0 ? "Sugerencias" : "Sin sugerencias"}
          </span>
          {suggestions.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">
              Ningún documento tiene este importe en torno a esta fecha. Búscalo a mano (puedes marcar varios si el
              movimiento los agrupa) o, si no tiene documento detrás, regístralo como cobro o pago manual.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {suggestions.map(({ candidate, days }) => (
                <li
                  key={candidate.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <CandidateSummary candidate={candidate} />
                  <span className="text-xs text-muted-foreground">
                    {days === 0 ? "mismo día" : `${days} ${days === 1 ? "día" : "días"}`}
                  </span>
                  <span className="ml-auto amount text-sm font-semibold">{formatEUR(candidate.amount)}</span>
                  <Button size="sm" onClick={() => reconcileWith(movement.id, [candidate])}>
                    Conciliar
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onSearch}>
              <Search strokeWidth={1.8} aria-hidden="true" />
              Buscar documento
            </Button>
            <Button variant="ghost" size="sm" onClick={onRegister}>
              <HandCoins strokeWidth={1.8} aria-hidden="true" />
              Registrar {movement.amount > 0 ? "cobro" : "pago"} manual
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function DocLink({ candidate }: { candidate: Pick<Candidate, "reference" | "href" | "source"> }) {
  const label = candidate.reference || PAYMENT_SOURCES[candidate.source].label;
  return candidate.href ? (
    <Link
      to={candidate.href}
      className="min-w-0 truncate font-medium text-foreground underline-offset-2 hover:text-primary"
    >
      {label}
    </Link>
  ) : (
    <span className="min-w-0 truncate font-medium">{label}</span>
  );
}

function CandidateSummary({ candidate }: { candidate: Candidate }) {
  const { icon: Icon, label } = PAYMENT_SOURCES[candidate.source];
  return (
    <span className="flex min-w-0 flex-1 basis-48 items-center gap-2.5">
      <span
        title={label}
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        <Icon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5 text-sm">
          <DocLink candidate={candidate} />
          {candidate.pending && (
            <span className="shrink-0 text-xs text-warning">
              {candidate.amount > 0 ? "pendiente de cobro" : "pendiente de pago"}
            </span>
          )}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {[candidate.counterparty, `${candidate.pending ? "vence" : "registrado"} ${formatDate(candidate.date)}`]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </span>
  );
}

/** Every candidate of the same direction, to pick one or several that add up to the movement. */
function MatchDialog({
  row,
  candidates,
  onOpenChange,
}: {
  row: Row;
  candidates: Candidate[];
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const sign = Math.sign(row.remaining);
  const q = query.trim().toLowerCase();
  const shown = candidates
    .filter((c) => Math.sign(c.amount) === sign)
    .filter((c) => !q || [c.reference, c.counterparty, formatEUR(c.amount)].some((v) => v.toLowerCase().includes(q)))
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.date) - Date.parse(row.movement.date)) -
        Math.abs(Date.parse(b.date) - Date.parse(row.movement.date)),
    );
  const picked = candidates.filter((c) => selected.has(c.id));
  const total = sumBy(picked, (c) => c.amount);
  const diff = cents(row.remaining - total);
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Buscar documento</DialogTitle>
        <DialogDescription>
          «{row.movement.concept}» · {formatDate(row.movement.date)} ·{" "}
          <span className="amount text-foreground">{formatEUR(row.remaining)}</span> por conciliar. Puedes marcar varios
          documentos si el movimiento los agrupa.
        </DialogDescription>
        <div className="flex h-10 items-center gap-2 rounded-lg border border-input px-3 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
          <Search className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Número, cliente, proveedor o importe"
            aria-label="Buscar documento"
            className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul className="m-0 flex max-h-80 list-none flex-col overflow-y-auto rounded-lg border border-border p-0">
          {shown.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No hay {sign > 0 ? "cobros ni facturas por cobrar" : "pagos ni documentos por pagar"} que coincidan.
            </li>
          )}
          {shown.map((c) => (
            <li key={c.id} className="border-b border-border last:border-b-0">
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-accent">
                <Checkbox checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <CandidateSummary candidate={c} />
                <span className="amount text-sm font-semibold">{formatEUR(c.amount)}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm text-muted-foreground">
            Seleccionado <span className="amount font-semibold text-foreground">{formatEUR(total)}</span>
            {picked.length > 0 &&
              (diff === 0 ? (
                <span className="text-success"> · cuadra exacto</span>
              ) : Math.sign(diff) === sign ? (
                <span> · quedará {formatEUR(diff)} sin conciliar</span>
              ) : (
                <span className="text-warning"> · supera el movimiento en {formatEUR(cents(-diff))}</span>
              ))}
          </p>
          <div className="flex gap-2.5">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button
              disabled={picked.length === 0}
              onClick={() => {
                reconcileWith(row.movement.id, picked);
                onOpenChange(false);
              }}
            >
              Conciliar{picked.length > 1 ? ` ${picked.length}` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
