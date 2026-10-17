import type { CSSProperties } from "react";
import { Link } from "react-router";
import {
  Building2,
  ChevronRight,
  CreditCard,
  FileSignature,
  Landmark,
  Package,
  Percent,
  ReceiptText,
  ShieldCheck,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { CATALOG_SETTINGS_PATH } from "@/features/catalog/catalog-model";
import {
  ACCOUNTS_PATH,
  BUSINESS_PATH,
  businessName,
  incomeTaxMethodLabel,
  INVOICE_SETTINGS_PATH,
  PAYMENT_METHODS_PATH,
  TAX_SETTINGS_PATH,
  vatRegimeLabel,
} from "./settings-model";
import { useSettings } from "./settings-store";

interface Entry {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  /** What's set now, so the hub doubles as a summary. */
  summary?: string;
}

interface Soon {
  title: string;
  description: string;
  icon: LucideIcon;
}

const SOON: Soon[] = [
  { title: "Sistema VERI*FACTU", description: "Firma y envío de las facturas a la AEAT.", icon: ShieldCheck },
  {
    title: "Certificados digitales",
    description: "Tu certificado para presentar modelos y firmar.",
    icon: FileSignature,
  },
  { title: "Gestión de etiquetas", description: "Etiquetas para clasificar facturas y gastos.", icon: Tags },
  { title: "Usuarios", description: "Da acceso a tu gestor o a tu equipo.", icon: Users },
];

function EntryCard({ entry, index }: { entry: Entry; index: number }) {
  return (
    <Link
      to={entry.to}
      className="group flex min-w-0 animate-rise-in items-start gap-3.5 rounded-xl border border-border bg-card p-4 text-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-accent active:scale-[0.99]"
      style={{ "--i": index } as CSSProperties}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <entry.icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">{entry.title}</span>
        <span className="text-sm text-muted-foreground">{entry.description}</span>
        {entry.summary && <span className="mt-1.5 truncate text-sm">{entry.summary}</span>}
      </span>
      <ChevronRight
        className="mt-2.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

export function SettingsPage() {
  const { profile, tax, accounts, paymentMethods } = useSettings();
  const activeAccounts = accounts.filter((a) => a.active).length;
  const activeMethods = paymentMethods.filter((m) => m.active).length;
  const main = tax.activities[0];

  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: "Tu negocio",
      entries: [
        {
          title: "Datos de la empresa",
          description: "NIF, nombre y dirección fiscal que aparecen en tus facturas.",
          to: BUSINESS_PATH,
          icon: Building2,
          summary: `${businessName(profile)} · ${profile.taxId}`,
        },
        {
          title: "Impuestos",
          description: "Régimen de IVA e IRPF, actividades del IAE y valores por defecto.",
          to: TAX_SETTINGS_PATH,
          icon: Percent,
          summary: [
            incomeTaxMethodLabel(tax.incomeTaxMethod),
            vatRegimeLabel(tax.vatRegime),
            main?.code && `Epígrafe ${main.code}`,
            `RETA ${formatEUR(tax.socialSecurityFee)}/mes`,
          ]
            .filter(Boolean)
            .join(" · "),
        },
      ],
    },
    {
      title: "Facturación y cobros",
      entries: [
        {
          title: "Facturas",
          description: "Series de numeración, plantilla del PDF, logotipo y textos.",
          to: INVOICE_SETTINGS_PATH,
          icon: ReceiptText,
        },
        {
          title: "Catálogo",
          description: "Campos personalizados, productos en las facturas y control de stock.",
          to: CATALOG_SETTINGS_PATH,
          icon: Package,
        },
        {
          title: "Métodos de pago y cobro",
          description: "Transferencia, tarjeta, efectivo… y la cuenta de cada uno.",
          to: PAYMENT_METHODS_PATH,
          icon: CreditCard,
          summary: `${activeMethods} ${activeMethods === 1 ? "método activo" : "métodos activos"}`,
        },
        {
          title: "Cuentas bancarias y de tesorería",
          description: "Tus cuentas, la caja, PayPal y tarjetas.",
          to: ACCOUNTS_PATH,
          icon: Landmark,
          summary: `${activeAccounts} ${activeAccounts === 1 ? "cuenta activa" : "cuentas activas"}`,
        },
      ],
    },
  ];

  let index = 0;
  return (
    <div className="flex flex-col gap-6 px-5 pt-6 pb-8 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">Configuración</h1>
        <p className="m-0 text-sm text-muted-foreground">Los datos de tu negocio y cómo trabaja Fiscalia con ellos.</p>
      </header>

      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="flex flex-col gap-3">
          <h2 className="m-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.title}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.entries.map((entry) => (
              <EntryCard key={entry.to} entry={entry} index={index++} />
            ))}
          </div>
        </section>
      ))}

      <section aria-label="Próximamente" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">Más ajustes</h2>
          <span className="text-xs text-muted-foreground">Disponibles próximamente</span>
        </div>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {SOON.map((s) => (
            <li key={s.title} className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4">
              <s.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{s.title}</span>
                <span className="text-sm text-muted-foreground">{s.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
