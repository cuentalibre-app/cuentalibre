import { useEffect, useState, type ReactNode } from "react";
import { Badge, type BadgeProps } from "@fiscalia/ui/components/badge";
import { Button } from "@fiscalia/ui/components/button";
import { Card, CardTitle } from "@fiscalia/ui/components/card";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { table } from "@fiscalia/ui/lib/table";

const colorGroups: { title: string; tokens: string[] }[] = [
  { title: "Superficies", tokens: ["background", "card", "popover", "sidebar", "muted", "muted-strong", "accent"] },
  { title: "Texto", tokens: ["foreground", "muted-foreground"] },
  { title: "Marca", tokens: ["primary", "primary-hover", "primary-soft", "ring"] },
  { title: "Bordes", tokens: ["border", "input", "divider"] },
  {
    title: "Estados",
    tokens: ["success", "success-soft", "warning", "warning-soft", "destructive", "destructive-soft"],
  },
  {
    title: "Gráficas",
    tokens: ["chart-income", "chart-expense", "chart-tax", "chart-grid", "chart-axis", "chart-highlight"],
  },
];

const typeScale: { token: string; className: string; sample: string }[] = [
  { token: "text-4xl · 30px", className: "text-4xl amount font-medium", sample: formatEUR(9476.4) },
  { token: "text-3xl · 28px", className: "text-3xl font-semibold tracking-tight", sample: "Inicio" },
  { token: "text-2xl · 26px", className: "text-2xl amount font-medium", sample: formatEUR(21550) },
  { token: "text-xl · 18px", className: "text-xl font-semibold", sample: "20 OCT" },
  { token: "text-lg · 16px", className: "text-lg font-semibold", sample: "Últimas facturas emitidas" },
  { token: "text-md · 15px", className: "text-md", sample: "Cuerpo en móvil" },
  { token: "text-base · 14px", className: "text-base", sample: "Cuerpo en escritorio · Estudio Norte S.L." },
  { token: "text-sm · 13px", className: "text-sm text-muted-foreground", sample: "Pendiente de cobro" },
  { token: "text-xs · 12px", className: "text-xs text-muted-foreground uppercase tracking-wide", sample: "Cliente" },
  { token: "text-2xs · 11px", className: "text-2xs text-muted-foreground", sample: "ENE  FEB  MAR" },
];

// Full class names so Tailwind can detect them
const radii = [
  ["xs", "rounded-xs"],
  ["sm", "rounded-sm"],
  ["md", "rounded-md"],
  ["lg", "rounded-lg"],
  ["xl", "rounded-xl"],
  ["2xl", "rounded-2xl"],
] as const;

const invoices: { n: string; c: string; d: string; t: number; s: string; tone: BadgeProps["tone"] }[] = [
  { n: "2026-0047", c: "Estudio Norte S.L.", d: "28 sep 2026", t: 4876, s: "Pendiente", tone: "neutral" },
  { n: "2026-0046", c: "Agencia Brisa", d: "15 sep 2026", t: 2120, s: "Cobrada", tone: "success" },
  { n: "2026-0045", c: "Talleres Ruiz S.C.", d: "02 sep 2026", t: 1060, s: "Vencida", tone: "danger" },
];

function useThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return [dark, setDark] as const;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ token }: { token: string }) {
  const [value, setValue] = useState("");
  useEffect(() => {
    // Re-read the resolved value whenever the theme changes
    const read = () => setValue(getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim());
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [token]);

  return (
    <li className="flex items-center gap-3">
      <span
        className="size-10 shrink-0 rounded-lg border border-border"
        style={{ background: `var(--${token})` }}
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{token}</span>
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </span>
    </li>
  );
}

export function DesignSystemPage() {
  const [dark, setDark] = useThemeToggle();
  const ingresos = 18030;
  const gastos = 2900;
  const irpf = 0.2 * (ingresos - gastos);
  const neto = ingresos - gastos - irpf;
  const parts = [
    { label: "Neto", value: neto, className: "bg-chart-income" },
    { label: "IRPF estimado", value: irpf, className: "bg-chart-tax" },
    { label: "Gastos", value: gastos, className: "bg-chart-expense" },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-8 sm:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-3xl font-semibold tracking-tight">Sistema visual</h1>
          <p className="m-0 text-sm text-muted-foreground">Tokens de Fiscalia · propuesta A · Claro</p>
        </div>
        <Button variant="secondary" aria-pressed={dark} onClick={() => setDark((d) => !d)}>
          {dark ? "Modo claro" : "Modo oscuro (provisional)"}
        </Button>
      </header>

      <Section title="Color">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {colorGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-3">
              <h3 className="m-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.title}</h3>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {group.tokens.map((token) => (
                  <Swatch key={token} token={token} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía">
        <p className="m-0 text-sm text-muted-foreground">
          Geist para la interfaz, Geist Mono con cifras tabulares para importes (clase <code>amount</code>).
        </p>
        <ul className="m-0 flex list-none flex-col p-0">
          {typeScale.map((row) => (
            <li
              key={row.token}
              className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-divider py-3 last:border-b-0"
            >
              <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">{row.token}</span>
              <span className={row.className}>{row.sample}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Radios">
        <div className="flex flex-wrap gap-6">
          {radii.map(([name, className]) => (
            <div key={name} className="flex flex-col items-center gap-2">
              <div className={cn("size-16 border border-input bg-muted", className)} />
              <span className="font-mono text-xs text-muted-foreground">{className}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Botones">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <PlusIcon />
            Nueva factura
          </Button>
          <Button variant="secondary">Subir gasto</Button>
          <Button variant="ghost">Ver todas</Button>
          <Button variant="destructive">Eliminar</Button>
          <Button disabled>Desactivado</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary">
            sm · 36
          </Button>
          <Button size="md" variant="secondary">
            md · 40
          </Button>
          <Button size="lg" variant="secondary">
            lg · 44
          </Button>
          <Button size="xl">
            <PlusIcon />
            xl · 52 (móvil)
          </Button>
          <Button size="icon" variant="ghost" aria-label="Avisos">
            <BellIcon />
          </Button>
        </div>
      </Section>

      <Section title="Estados">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="success">Cobrada</Badge>
          <Badge tone="neutral">Pendiente</Badge>
          <Badge tone="danger">Vencida</Badge>
          <Badge tone="warning">Borrador</Badge>
          <Badge tone="primary">Recurrente</Badge>
          <Badge tone="solidWarning">2</Badge>
        </div>
        <div className="flex flex-wrap gap-6 text-xs font-semibold">
          <span className="text-success">↑ 12 % vs. T2</span>
          <span className="text-destructive">↓ 8 % vs. T2</span>
          <span className="text-warning">Quedan 5 días</span>
        </div>
      </Section>

      <Section title="Composición">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4">
          {[
            { label: "Ingresos", value: ingresos, delta: "↑ 12 % vs. T2", tone: "text-success" },
            { label: "Gastos", value: gastos, delta: "↓ 4 % vs. T2", tone: "text-muted-foreground" },
            { label: "Beneficio", value: ingresos - gastos, delta: "↑ 15 % vs. T2", tone: "text-success" },
          ].map((k) => (
            <Card key={k.label} className="gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{k.label}</span>
                <span className={cn("text-xs font-semibold", k.tone)}>{k.delta}</span>
              </div>
              <span className="amount text-2xl font-medium">{formatEUR(k.value)}</span>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-5">
          <Card className="min-w-0 flex-[2_1_520px] gap-0 overflow-hidden p-0">
            <div className="flex items-center justify-between gap-2 px-5 py-4">
              <CardTitle>Últimas facturas emitidas</CardTitle>
              <a href="#" className="font-medium text-primary no-underline hover:text-primary-hover">
                Ver todas
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className={table.headRow}>
                    {["Nº", "Cliente", "Fecha", "Total", "Estado"].map((h) => (
                      <th
                        key={h}
                        className={cn(table.th, h === "Total" && "text-right")}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.n} className={table.row}>
                      <td className={cn(table.td, "font-mono text-sm")}>{inv.n}</td>
                      <td className={cn(table.td, "font-medium")}>{inv.c}</td>
                      <td className={cn(table.td, "text-muted-foreground")}>{inv.d}</td>
                      <td className={cn(table.td, "amount text-right")}>{formatEUR(inv.t)}</td>
                      <td className={table.td}>
                        <Badge tone={inv.tone}>{inv.s}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="min-w-0 flex-[1_1_300px]">
            <div className="flex flex-col gap-1">
              <CardTitle>Neto después de impuestos</CardTitle>
              <span className="text-sm text-muted-foreground">De {formatEUR(ingresos)} facturados sin IVA</span>
            </div>
            <span className="amount text-4xl font-medium">{formatEUR(neto)}</span>
            <div
              role="img"
              aria-label={parts.map((p) => `${p.label} ${formatEUR(p.value)}`).join(", ")}
              className="flex h-3.5 gap-0.5 overflow-hidden rounded-xs"
            >
              {parts.map((p) => (
                <div key={p.label} className={p.className} style={{ width: `${(p.value / ingresos) * 100}%` }} />
              ))}
            </div>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {parts.map((p) => (
                <li key={p.label} className="flex items-center gap-2.5">
                  <span className={cn("size-2.5 rounded-xs", p.className)} aria-hidden="true" />
                  <span className="flex-1">{p.label}</span>
                  <span className="amount">{formatEUR(p.value)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
    </svg>
  );
}
