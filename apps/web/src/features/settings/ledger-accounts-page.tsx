import { useState, type CSSProperties, type ReactNode } from "react";
import {
  MAX_ACCOUNT_DIGITS,
  MIN_ACCOUNT_DIGITS,
  accountCodeLength,
  codeError,
  ledgerAccountNumber,
  prefixError,
} from "@cuentalibre/core";
import type { ContactRole, LedgerAccountKey, LedgerAccountSettings, PaymentMethodType } from "@cuentalibre/contracts";
import { Input, SearchField } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { table } from "@cuentalibre/ui/lib/table";
import { useContacts } from "@/features/contacts/contacts-store";
import { Field, GroupedSelect, Section } from "@/features/sales/form-fields";
import { ledgerAccountsStore, useLedgerAccounts } from "./ledger-accounts-store";
import { methodTypeLabel, usePaymentMethods } from "./settings-model";
import { SaveButton, SettingsHeader, useDraft } from "./settings-parts";
import { Page } from "@/components/page";

interface AccountRow {
  key: LedgerAccountKey;
  /** Label in the prefixes table. */
  prefix: string;
  /** Label in the default accounts table. */
  account: string;
}

const GROUPS: { title: string; rows: AccountRow[] }[] = [
  {
    title: "Ventas",
    rows: [
      { key: "customers", prefix: "Clientes", account: "Clientes varios" },
      { key: "sales", prefix: "Ventas", account: "Ventas" },
      { key: "outputVat", prefix: "IVA repercutido", account: "IVA repercutido" },
      { key: "salesWithholding", prefix: "Retenciones", account: "Retenciones" },
    ],
  },
  {
    title: "Compras",
    rows: [
      { key: "suppliers", prefix: "Proveedores", account: "Proveedores varios" },
      { key: "assetSuppliers", prefix: "Proveedores inmovilizado", account: "Proveedores inmovilizado varios" },
      { key: "creditors", prefix: "Acreedores", account: "Acreedores varios" },
      { key: "purchases", prefix: "Compras / gastos", account: "Compras" },
      { key: "inputVat", prefix: "IVA soportado", account: "IVA soportado" },
      { key: "purchasesWithholding", prefix: "Retenciones", account: "Retenciones" },
    ],
  },
  {
    title: "Métodos de pago",
    rows: [
      { key: "cash", prefix: "Efectivo (caja)", account: "Efectivo" },
      {
        key: "bank",
        prefix: "Bancos (ingresos, transferencias, pagarés, PayPal…)",
        account: "Bancos",
      },
    ],
  },
  { title: "Cuenta no deducible", rows: [{ key: "nonDeductible", prefix: "No deducible", account: "No deducible" }] },
];

/** Accounts that otros programas needs set as tax-deductible income or expenses. */
const A3_ACCOUNTS: { title: string; accounts: [string, string][] }[] = [
  {
    title: "Ventas",
    accounts: [
      ["7098", "Otras prestaciones de servicios."],
      ["7099", "Otras ventas de mercaderías."],
    ],
  },
  {
    title: "Compras",
    accounts: [
      ["602", "Otros aprovisionamientos."],
      ["6231", "Servicios de profesionales sin alta en actividades económicas (cursos, conferencias…)."],
      ["6291", "Comunicaciones (internet, móvil…)."],
      ["6292", "Viajes, estancias y desplazamientos."],
      ["6293", "Material de oficina."],
      ["6294", "Material informático."],
      ["6295", "Gastos de manutención del autónomo pagados electrónicamente."],
    ],
  },
];

const DIGIT_OPTIONS = Array.from({ length: MAX_ACCOUNT_DIGITS - MIN_ACCOUNT_DIGITS + 1 }, (_, i) => {
  const n = String(MIN_ACCOUNT_DIGITS + i);
  return { value: n, label: n };
});

const contactCodeKey = (role: ContactRole, id: string) => `${role}:${id}`;

/** Whether every prefix and code fits the number of digits. */
function isValid(s: LedgerAccountSettings, methodKey: (id: string) => LedgerAccountKey): boolean {
  const keys = Object.keys(s.prefixes) as LedgerAccountKey[];
  if (keys.some((k) => prefixError(s.prefixes[k], s.digits) || codeError(s.prefixes[k], s.defaults[k], s.digits)))
    return false;
  const fits = (prefix: string, codes: Record<string, string>) =>
    Object.values(codes).every((c) => !codeError(prefix, c, s.digits));
  return (
    fits(s.prefixes.customers, pick(s.contactCodes, "client")) &&
    fits(s.prefixes.suppliers, pick(s.contactCodes, "supplier")) &&
    Object.entries(s.methodCodes).every(([id, c]) => !codeError(s.prefixes[methodKey(id)], c, s.digits))
  );
}

const pick = (codes: Record<string, string>, role: ContactRole) =>
  Object.fromEntries(Object.entries(codes).filter(([k]) => k.startsWith(`${role}:`)));

/** Ledger account numbers used when the books are exported to accounting software. */
export function LedgerAccountsPage() {
  const saved = useLedgerAccounts();
  const { draft, set, dirty, justSaved, markSaved } = useDraft<LedgerAccountSettings>(saved);
  const methods = usePaymentMethods();
  const valid = isValid(draft, (id) => methodAccount(methods.find((m) => m.id === id)?.type ?? "transfer"));

  const save = () => {
    if (!valid) return;
    ledgerAccountsStore.update(draft);
    markSaved();
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <SettingsHeader
          title="Cuentas contables"
          description="Los números de cuenta con los que se exporta tu contabilidad."
        >
          {dirty && !valid && <span className="text-sm text-destructive">Revisa los números marcados.</span>}
          <SaveButton dirty={dirty && valid} justSaved={justSaved} onSave={save} />
        </SettingsHeader>

        <Section title="Configuración de la exportación" index={0}>
          <p className="m-0 max-w-3xl text-muted-foreground">
            Configura los números de cuenta contable que se usan al exportar la información de cuentalibre, para que tu
            gestoría pueda importarla en programas de contabilidad como otros programas o otros programas.
          </p>
          <div className="flex max-w-3xl flex-col gap-3 rounded-xl bg-warning-soft px-3.5 py-3 text-sm">
            <p className="m-0">
              <strong className="font-semibold">Importante:</strong> para que otros programas y otros programas
              recojan bien todas las facturas para impuestos, configura estas cuentas como ingresos o gastos fiscalmente
              deducibles en la pantalla Tablas › Conceptos/Plan contable de otros programas:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {A3_ACCOUNTS.map((g) => (
                <div key={g.title} className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">{g.title}</span>
                  <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                    {g.accounts.map(([n, label]) => (
                      <li key={n}>
                        <span className="font-medium tabular-nums">{n}</span> {label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="m-0">
              Asegúrate también de que la cuenta configurada aquí como no deducible lo está igualmente en otros programas | eco
              | con y otros programas.
            </p>
          </div>
        </Section>

        <Section title="Información de empresa" index={1}>
          <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
            <Field label="Código de empresa" hint="El código de la empresa a usar en el traspaso de contabilidad.">
              {(p) => (
                <Input
                  {...p}
                  value={draft.companyCode}
                  maxLength={10}
                  spellCheck={false}
                  onChange={(e) => set("companyCode", e.target.value)}
                  className="tabular-nums"
                />
              )}
            </Field>
            <Field label="Número de dígitos" hint="Los dígitos que tendrán todos los números de cuenta.">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={String(draft.digits)}
                  onChange={(v) => set("digits", Number(v))}
                  groups={[{ options: DIGIT_OPTIONS }]}
                />
              )}
            </Field>
          </div>
        </Section>

        <Section title="Prefijos" index={2}>
          <p className="m-0 max-w-3xl text-muted-foreground">
            Los prefijos construyen los números de cuenta de cada elemento y sirven para agrupar las cuentas
            relacionadas.
          </p>
          <AccountGroups
            render={(row) => (
              <CodeInput
                label={`Prefijo de ${row.prefix.toLowerCase()}`}
                value={draft.prefixes[row.key]}
                error={prefixError(draft.prefixes[row.key], draft.digits)}
                onChange={(v) => set("prefixes", { ...draft.prefixes, [row.key]: v })}
              />
            )}
            label={(row) => row.prefix}
            inline
          />
        </Section>

        <Section title="Cuentas por defecto" index={3}>
          <p className="m-0 max-w-3xl text-muted-foreground">
            Los números de cuenta que se usan por defecto. Más abajo puedes dar un número propio a cada cliente,
            proveedor o método de pago.
          </p>
          <AccountGroups
            label={(row) => (
              <>
                {row.account} <span className="text-muted-foreground tabular-nums">({draft.prefixes[row.key]})</span>
              </>
            )}
            render={(row) => {
              const prefix = draft.prefixes[row.key];
              return (
                <span className="flex items-center gap-3">
                  <CodeInput
                    label={`Cuenta de ${row.account.toLowerCase()}`}
                    value={draft.defaults[row.key]}
                    error={codeError(prefix, draft.defaults[row.key], draft.digits)}
                    maxLength={accountCodeLength(prefix, draft.digits)}
                    onChange={(v) => set("defaults", { ...draft.defaults, [row.key]: v })}
                  />
                  <Resulting number={ledgerAccountNumber(prefix, draft.defaults[row.key], draft.digits)} />
                </span>
              );
            }}
          />
        </Section>

        <ContactCodes draft={draft} onChange={(contactCodes) => set("contactCodes", contactCodes)} />
        <MethodCodes draft={draft} onChange={(methodCodes) => set("methodCodes", methodCodes)} />
      </Page>
    </TooltipProvider>
  );
}

function AccountGroups({
  label,
  render,
  inline = false,
}: {
  label: (row: AccountRow) => ReactNode;
  render: (row: AccountRow) => ReactNode;
  /** Label and field on one row on phones too, for narrow fields. */
  inline?: boolean;
}) {
  return (
    <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-semibold">{g.title}</legend>
          {g.rows.map((row) => (
            <div
              key={row.key}
              className={cn(
                "sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4",
                inline ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3" : "flex flex-col gap-1.5",
              )}
            >
              <span className="text-sm">{label(row)}</span>
              {render(row)}
            </div>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function CodeInput({
  label,
  value,
  error,
  placeholder,
  maxLength = MAX_ACCOUNT_DIGITS,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  placeholder?: string;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <span className="flex flex-col gap-1">
      <Input
        aria-label={label}
        aria-invalid={error ? true : undefined}
        title={error}
        value={value}
        placeholder={placeholder}
        inputMode="numeric"
        maxLength={Math.max(maxLength, value.length)}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value.replace(/\s+/g, ""))}
        className="h-9 w-28 tabular-nums"
      />
      {error && <span className="max-w-40 text-xs text-destructive">{error}</span>}
    </span>
  );
}

function Resulting({ number }: { number: string | null }) {
  return (
    <span className="w-28 text-sm tabular-nums" aria-label="Cuenta resultante">
      {number ?? <span className="text-muted-foreground">—</span>}
    </span>
  );
}

/** Cash methods book into the cash account; the rest go through the bank. */
const methodAccount = (type: PaymentMethodType): LedgerAccountKey => (type === "cash" ? "cash" : "bank");

const ROLE_LABEL: Record<ContactRole, string> = { client: "Cliente", supplier: "Proveedor" };

function ContactCodes({
  draft,
  onChange,
}: {
  draft: LedgerAccountSettings;
  onChange: (codes: Record<string, string>) => void;
}) {
  const clients = useContacts("client");
  const suppliers = useContacts("supplier");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = [
    ...clients.map((c) => ({ role: "client" as const, contact: c })),
    ...suppliers.map((c) => ({ role: "supplier" as const, contact: c })),
  ]
    .filter(({ contact }) => !q || contact.name.toLowerCase().includes(q) || contact.taxId.toLowerCase().includes(q))
    .sort((a, b) => a.contact.name.localeCompare(b.contact.name, "es"));

  const prefixOf = (role: ContactRole) => draft.prefixes[role === "client" ? "customers" : "suppliers"];
  const defaultOf = (role: ContactRole) => draft.defaults[role === "client" ? "customers" : "suppliers"];

  return (
    <Section title="Clientes y proveedores" index={4}>
      <p className="m-0 max-w-3xl text-muted-foreground">
        Da un número de cuenta propio a los clientes o proveedores que quieras; no hace falta configurarlo para todos.
        Los que no tengan uno usan la cuenta por defecto de clientes o de proveedores.
      </p>
      <SearchField
        className="w-full sm:w-72"
        aria-label="Buscar por nombre o NIF"
        placeholder="Buscar por nombre o NIF"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <CodesTable
        heads={["Nombre", "Tipo", "Código", "Cuenta"]}
        empty={q ? "Ningún contacto coincide con la búsqueda." : "Todavía no tienes clientes ni proveedores."}
        rows={rows.map(({ role, contact }) => {
          const key = contactCodeKey(role, contact.id);
          const code = draft.contactCodes[key] ?? "";
          const prefix = prefixOf(role);
          return {
            id: key,
            cells: [
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{contact.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{contact.taxId}</span>
              </span>,
              <span className="text-sm">{ROLE_LABEL[role]}</span>,
              <CodeInput
                label={`Código de ${contact.name}`}
                value={code}
                placeholder={defaultOf(role)}
                error={codeError(prefix, code, draft.digits)}
                maxLength={accountCodeLength(prefix, draft.digits)}
                onChange={(v) => onChange(withCode(draft.contactCodes, key, v))}
              />,
              <Resulting number={ledgerAccountNumber(prefix, code || defaultOf(role), draft.digits)} />,
            ],
          };
        })}
      />
    </Section>
  );
}

function MethodCodes({
  draft,
  onChange,
}: {
  draft: LedgerAccountSettings;
  onChange: (codes: Record<string, string>) => void;
}) {
  const methods = usePaymentMethods();
  return (
    <Section title="Métodos de pago" index={5}>
      <p className="m-0 max-w-3xl text-muted-foreground">
        Da un número de cuenta propio a cada método de pago si lo necesitas; no hace falta configurarlo para todos. Los
        que no tengan uno usan la cuenta por defecto de efectivo o de bancos.
      </p>
      <CodesTable
        heads={["Método", "Tipo", "Código", "Cuenta"]}
        empty="Todavía no tienes métodos de pago."
        rows={methods.map((m) => {
          const key = methodAccount(m.type);
          const prefix = draft.prefixes[key];
          const code = draft.methodCodes[m.id] ?? "";
          return {
            id: m.id,
            cells: [
              <span className={cn("font-medium", !m.active && "text-muted-foreground")}>
                {m.name}
                {!m.active && " (inactivo)"}
              </span>,
              <span className="text-sm">{methodTypeLabel(m.type)}</span>,
              <CodeInput
                label={`Código de ${m.name}`}
                value={code}
                placeholder={draft.defaults[key]}
                error={codeError(prefix, code, draft.digits)}
                maxLength={accountCodeLength(prefix, draft.digits)}
                onChange={(v) => onChange(withCode(draft.methodCodes, m.id, v))}
              />,
              <Resulting number={ledgerAccountNumber(prefix, code || draft.defaults[key], draft.digits)} />,
            ],
          };
        })}
      />
    </Section>
  );
}

/** Sets or clears one code; an empty code means "use the default". */
function withCode(codes: Record<string, string>, key: string, value: string): Record<string, string> {
  const { [key]: _, ...rest } = codes;
  return value ? { ...rest, [key]: value } : rest;
}

function CodesTable({
  heads,
  rows,
  empty,
}: {
  heads: string[];
  rows: { id: string; cells: ReactNode[] }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="m-0 text-sm text-muted-foreground">{empty}</p>;
  return (
    <>
      {/* Phones: name and type above, code and resulting account below */}
      <ul className="m-0 flex max-h-[28rem] list-none flex-col overflow-y-auto rounded-lg border border-border px-3 py-0 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 border-t border-divider py-2.5 first:border-t-0">
            <span className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="min-w-0">{r.cells[0]}</span>
              <span className="shrink-0 text-muted-foreground">{r.cells[1]}</span>
            </span>
            <span className="flex items-center gap-3">
              {r.cells[2]}
              {r.cells[3]}
            </span>
          </li>
        ))}
      </ul>
      <div className="relative max-h-[28rem] overflow-auto rounded-lg border border-border max-md:hidden">
        <table className="w-full min-w-[34rem] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className={table.headRow}>
              {heads.map((h) => (
                <th key={h} scope="col" className={table.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={cn(table.row, "animate-row-in")}
                style={{ "--i": Math.min(i, 12) } as CSSProperties}
              >
                {r.cells.map((cell, j) => (
                  <td key={j} className={cn(table.td, "align-middle")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
