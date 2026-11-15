import type { CSSProperties } from "react";
import { Link } from "react-router";
import {
  ArrowDownWideNarrow,
  Bot,
  Building2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FilePen,
  FileText,
  FileUp,
  FolderOpen,
  KeyRound,
  Landmark,
  MailPlus,
  Package,
  Percent,
  ReceiptText,
  Tags,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@cuentalibre/ui/components/badge";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { CATALOG_SETTINGS_PATH } from "@/features/catalog/catalog-model";
import { IMPORT_PATH } from "@/features/transfer/transfer-model";
import { LegalLinks } from "@/components/legal-links";
import type { Billing } from "@cuentalibre/contracts";
import { formatDate } from "@/lib/format";
import { localDate, periodOf, planHeadline, planState, type PlanState } from "./billing-model";
import { useBilling } from "./billing-store";
import {
  ACCESS_PATH,
  API_KEYS_PATH,
  BILLING_PATH,
  BUSINESS_PATH,
  businessName,
  CONTACT_SETTINGS_PATH,
  DELIVERY_NOTE_SETTINGS_PATH,
  DRAFT_SETTINGS_PATH,
  EMAIL_TEMPLATES_PATH,
  FILES_PATH,
  profitTaxLabel,
  INVOICE_SETTINGS_PATH,
  PAYMENT_METHODS_PATH,
  PREFERENCES_PATH,
  PROFILE_PATH,
  QUOTE_SETTINGS_PATH,
  TAGS_PATH,
  TAX_SETTINGS_PATH,
  USERS_PATH,
  vatRegimeLabel,
} from "./settings-model";
import { useSettings } from "./settings-store";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { HelpTip, Page, PageHeader } from "@/components/page";

interface Entry {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  /** What's set now, so the hub doubles as a summary. */
  summary?: string;
}

function EntryCard({ entry, index }: { entry: Entry; index: number }) {
  return (
    <Link
      to={entry.to}
      className="group flex min-w-0 animate-rise-in items-start gap-3.5 surface p-4 text-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-accent active:scale-[0.99]"
      // Cap the stagger so the last cards of a long hub don't lag
      style={{ "--i": Math.min(index, 6) } as CSSProperties}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
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

/** The plan gets a card of its own: when the trial runs out, nobody should miss it. */
function PlanCard({ billing }: { billing: Billing }) {
  const { title, badge, tone } = planHeadline(billing);
  const { subscription } = billing;
  const period = subscription?.period ? periodOf(subscription.period) : null;
  const periodEnd = subscription?.currentPeriodEnd ? formatDate(localDate(subscription.currentPeriodEnd)) : "";
  const summary: Record<PlanState, string> = {
    trial: "Suscríbete cuando quieras: no perderás nada de lo que hayas hecho.",
    trialEnded: "Tus datos están a salvo. Suscríbete para volver a emitir facturas y registrar gastos.",
    subscriptionEnded: "Tus datos están a salvo. Suscríbete para volver a emitir facturas y registrar gastos.",
    active: period
      ? `Plan ${period.label.toLowerCase()}. Próximo cobro el ${periodEnd}.`
      : `Próximo cobro el ${periodEnd}.`,
    cancelled: `No se renovará: tienes todo cuentalibre hasta el ${periodEnd}.`,
    pastDue: "No hemos podido cobrar el último pago. Revisa tu tarjeta.",
  };
  return (
    <Link
      to={BILLING_PATH}
      className="group flex min-w-0 animate-rise-in flex-col gap-4 rounded-xl border border-primary/30 bg-primary-soft/40 p-5 text-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-primary-soft active:scale-[0.995] sm:flex-row sm:items-center"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <CreditCard className="size-6" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{title}</span>
          <Badge tone={tone}>{badge}</Badge>
        </span>
        <span className="text-sm text-muted-foreground">{summary[planState(billing)]}</span>
      </span>
      <ChevronRight
        className="hidden size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 sm:block"
        aria-hidden="true"
      />
    </Link>
  );
}

export function SettingsPage() {
  const { profile, tax, paymentMethods } = useSettings();
  const activeMethods = paymentMethods.filter((m) => m.active).length;
  const main = tax.activities[0];
  const billing = useBilling();

  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: "Ajustes de usuario",
      entries: [
        {
          title: "Datos personales",
          description: "Tu nombre y tus datos de contacto.",
          to: PROFILE_PATH,
          icon: UserRound,
        },
        {
          title: "Credenciales de acceso",
          description: "Cómo entras en cuentalibre: contraseña y cuentas vinculadas.",
          to: ACCESS_PATH,
          icon: KeyRound,
        },
      ],
    },
    {
      title: "Ajustes de empresa",
      entries: [
        {
          title: "Datos de la empresa",
          description: "NIF, nombre y dirección fiscal que aparecen en tus facturas.",
          to: BUSINESS_PATH,
          icon: Building2,
          summary: `${businessName(profile)} · ${profile.taxId}`,
        },
        {
          title: "Facturas",
          description: "Series de numeración, plantilla del PDF, logotipo y textos.",
          to: INVOICE_SETTINGS_PATH,
          icon: ReceiptText,
        },
        {
          title: "Facturas borrador",
          description: "Plantilla del PDF y textos de las facturas borrador.",
          to: DRAFT_SETTINGS_PATH,
          icon: FilePen,
        },
        {
          title: "Presupuestos",
          description: "Plantilla del PDF y textos de los presupuestos.",
          to: QUOTE_SETTINGS_PATH,
          icon: FileText,
        },
        {
          title: "Albaranes",
          description: "Plantilla del PDF, textos y facturación de los albaranes.",
          to: DELIVERY_NOTE_SETTINGS_PATH,
          icon: ClipboardList,
        },
        {
          title: "Impuestos",
          description: "Régimen de IVA e IRPF, actividades del IAE y valores por defecto.",
          to: TAX_SETTINGS_PATH,
          icon: Percent,
          summary: [
            profitTaxLabel(profile.kind, tax.incomeTaxMethod),
            vatRegimeLabel(tax.vatRegime),
            main?.code && `Epígrafe ${main.code}`,
            `RETA ${formatEUR(tax.socialSecurityFee)}/mes`,
          ]
            .filter(Boolean)
            .join(" · "),
        },
        {
          title: "Usuarios",
          description: "Las personas y gestores con acceso a tu empresa.",
          to: USERS_PATH,
          icon: Users,
        },
        {
          title: "Formas de cobro y pago",
          description: "Tus cuentas bancarias, tarjetas, PayPal y efectivo.",
          to: PAYMENT_METHODS_PATH,
          icon: Landmark,
          summary: `${activeMethods} ${activeMethods === 1 ? "activa" : "activas"}`,
        },
        {
          title: "Clientes y proveedores",
          description: "Los campos personalizados de sus fichas.",
          to: CONTACT_SETTINGS_PATH,
          icon: UsersRound,
        },
        {
          title: "Catálogo",
          description: "Campos personalizados, productos en las facturas y control de stock.",
          to: CATALOG_SETTINGS_PATH,
          icon: Package,
        },
        {
          title: "Etiquetas",
          description: "Etiquetas para clasificar facturas, presupuestos, albaranes y gastos.",
          to: TAGS_PATH,
          icon: Tags,
        },
        {
          title: "Archivos",
          description: "Los documentos que adjuntas y el espacio que ocupan.",
          to: FILES_PATH,
          icon: FolderOpen,
        },
      ],
    },
    {
      title: "Otras opciones",
      entries: [
        {
          title: "Filtros de listados",
          description: "Con qué filtros se abren tus presupuestos y albaranes.",
          to: PREFERENCES_PATH,
          icon: ArrowDownWideNarrow,
        },
        {
          title: "Plantillas de correo",
          description: "El asunto y el mensaje con los que envías tus documentos.",
          to: EMAIL_TEMPLATES_PATH,
          icon: MailPlus,
        },
        {
          title: "API y agentes",
          description: "Claves para que tus scripts y asistentes de IA trabajen con tus datos.",
          to: API_KEYS_PATH,
          icon: Bot,
        },
        {
          title: "Importaciones",
          description: "Importa clientes, proveedores, productos y facturas desde Excel.",
          to: IMPORT_PATH,
          icon: FileUp,
        },
      ],
    },
  ];

  let index = 0;
  return (
    <Page>
      <PageHeader
        title="Configuración"
        inline={
          <TooltipProvider delayDuration={300}>
            <HelpTip side="bottom">Los datos de tu negocio y cómo trabaja cuentalibre con ellos.</HelpTip>
          </TooltipProvider>
        }
      />

      {billing && (
        <section aria-label="Tu plan" className="flex flex-col gap-3">
          <h2 className="m-0 text-lg font-semibold tracking-tight">Tu plan</h2>
          <PlanCard billing={billing} />
        </section>
      )}

      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="flex flex-col gap-3">
          <h2 className="m-0 text-lg font-semibold tracking-tight">{group.title}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.entries.map((entry) => (
              <EntryCard key={entry.to} entry={entry} index={index++} />
            ))}
          </div>
        </section>
      ))}

      <LegalLinks className="pt-2" />
    </Page>
  );
}
