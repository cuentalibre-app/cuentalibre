import type { BusinessKind } from "@cuentalibre/contracts";
import {
  Armchair,
  Building,
  CalendarCheck,
  Camera,
  ChartColumn,
  ClipboardList,
  FileText,
  Layers,
  Menu,
  Package,
  Receipt,
  Landmark,
  Settings,
  LayoutGrid,
  Percent,
  ReceiptText,
  ShoppingBag,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import es from "../../i18n/locales/es.json";

export type BadgeKey = "drafts" | "filingsSoon";

type LabelName = keyof typeof es.navigation.labels;

interface NavLabel {
  label: string;
  labelKey: `navigation.labels.${LabelName}`;
}

function navLabel(name: LabelName): NavLabel {
  return { label: es.navigation.labels[name], labelKey: `navigation.labels.${name}` };
}

export interface NavLeaf extends NavLabel {
  to: string;
  badge?: BadgeKey;
  /** Draws a divider above the leaf, splitting a group's records from its tools. */
  separator?: boolean;
  /** Spreadsheet tools that need a computer; left out of the phone's "Más" sheet. */
  desktopOnly?: boolean;
  /** Only for self-employed workers: left out for a company. */
  selfEmployedOnly?: boolean;
}

export interface NavItem extends NavLeaf {
  icon: LucideIcon;
  /** Items with children render as a collapsible group; `to` is then the group's base path. */
  children?: NavLeaf[];
}

/** Export and import cover sales and purchases alike, so both groups list them. */
const transferLeaves: NavLeaf[] = [
  { ...navLabel("export"), to: "/exportar", separator: true, desktopOnly: true },
  { ...navLabel("import"), to: "/importar", desktopOnly: true },
];

export const mainNav: NavItem[] = [
  { ...navLabel("home"), to: "/", icon: LayoutGrid },
  {
    ...navLabel("sales"),
    to: "/ventas",
    icon: ReceiptText,
    children: [
      { ...navLabel("issuedInvoices"), to: "/ventas/facturas" },
      { ...navLabel("drafts"), to: "/ventas/borradores", badge: "drafts" },
      { ...navLabel("deliveryNotes"), to: "/ventas/albaranes" },
      { ...navLabel("quotes"), to: "/ventas/presupuestos" },
      ...transferLeaves,
    ],
  },
  {
    ...navLabel("purchases"),
    to: "/compras",
    icon: ShoppingBag,
    children: [
      { ...navLabel("receivedInvoices"), to: "/compras/facturas" },
      { ...navLabel("assets"), to: "/compras/bienes-de-inversion" },
      { ...navLabel("expenses"), to: "/compras/gastos" },
      ...transferLeaves,
    ],
  },
  {
    ...navLabel("taxes"),
    to: "/impuestos",
    icon: Percent,
    badge: "filingsSoon",
    children: [
      { ...navLabel("summary"), to: "/impuestos" },
      { ...navLabel("taxCalendar"), to: "/impuestos/calendario" },
      { ...navLabel("vat"), to: "/impuestos/iva" },
      { ...navLabel("incomeTax"), to: "/impuestos/irpf", selfEmployedOnly: true },
      { ...navLabel("withholding"), to: "/impuestos/retenciones" },
      { ...navLabel("rent"), to: "/impuestos/alquileres" },
      { ...navLabel("thirdParties"), to: "/impuestos/terceras-personas" },
      { ...navLabel("intraCommunity"), to: "/impuestos/intracomunitarias" },
    ],
  },
  { ...navLabel("banks"), to: "/bancos", icon: Landmark },
  {
    ...navLabel("contacts"),
    to: "/contactos",
    icon: UserRound,
    children: [
      { ...navLabel("clients"), to: "/contactos/clientes" },
      { ...navLabel("suppliers"), to: "/contactos/proveedores" },
    ],
  },
  {
    ...navLabel("catalog"),
    to: "/catalogo",
    icon: Package,
    children: [
      { ...navLabel("products"), to: "/catalogo/productos" },
      { ...navLabel("adjustStock"), to: "/catalogo/regularizar-stock" },
      { ...navLabel("import"), to: "/catalogo/importar", separator: true, desktopOnly: true },
      { ...navLabel("export"), to: "/catalogo/exportar", desktopOnly: true },
    ],
  },
  {
    ...navLabel("reports"),
    to: "/informes",
    icon: ChartColumn,
    children: [
      { ...navLabel("summary"), to: "/informes" },
      { ...navLabel("profitAndLoss"), to: "/informes/perdidas-y-ganancias" },
    ],
  },
];

/** The main navigation for a kind of business. */
export function mainNavFor(kind: BusinessKind): NavItem[] {
  if (kind === "selfEmployed") return mainNav;
  return mainNav.map((item) =>
    item.children ? { ...item, children: item.children.filter((leaf) => !leaf.selfEmployedOnly) } : item,
  );
}

export const secondaryNav: NavItem[] = [
  { ...navLabel("quarterClosing"), to: "/cierre-trimestre", icon: CalendarCheck },
  { ...navLabel("settings"), to: "/configuracion", icon: Settings },
];

export type PhoneTab = NavLabel &
  (
    | { kind: "link"; to: string; icon: LucideIcon; tour: string }
    | { kind: "create"; icon: LucideIcon; tour: string }
    | { kind: "more"; icon: LucideIcon; tour: string }
  );

/** The phone's tab bar, left to right as drawn: three sections, the shortcuts menu and "Más". */
export const phoneTabs: PhoneTab[] = [
  { kind: "link", ...navLabel("home"), to: "/", icon: LayoutGrid, tour: "/" },
  { kind: "link", ...navLabel("sales"), to: "/ventas", icon: ReceiptText, tour: "/ventas" },
  { kind: "create", ...navLabel("shortcuts"), icon: Layers, tour: "/compras" },
  { kind: "link", ...navLabel("taxes"), to: "/impuestos", icon: Percent, tour: "/impuestos" },
  { kind: "more", ...navLabel("more"), icon: Menu, tour: "/mas" },
];

/** Paths with a tab of their own in the mobile tab bar. */
export const tabPaths = phoneTabs.flatMap((tab) => (tab.kind === "link" ? [tab.to] : []));

export type MoreEntry =
  | { kind: "link"; item: NavItem }
  | { kind: "group"; to: string; title: string; titleKey: NavLabel["labelKey"]; icon: LucideIcon; links: NavLeaf[] };

/**
 * Sections that don't fit in the mobile tab bar, in sidebar order, listed under "Más": a section with
 * pages of its own is a titled group, a single page is a plain row.
 */
export const moreNav: MoreEntry[] = [
  ...mainNav.flatMap((item): MoreEntry[] => {
    // Sales has a tab, but it opens the issued invoices; the other sales lists live here
    if (item.to === "/ventas")
      return [
        {
          kind: "group",
          to: item.to,
          title: item.label,
          titleKey: item.labelKey,
          icon: item.icon,
          links: (item.children ?? []).filter((leaf) => !leaf.desktopOnly && leaf.to !== "/ventas/facturas"),
        },
      ];
    // Taxes has a tab, but its summary leaves the calendar and settings out on phones; they live here
    if (item.to === "/impuestos")
      return [
        {
          kind: "group",
          to: item.to,
          title: item.label,
          titleKey: item.labelKey,
          icon: item.icon,
          links: [
            { ...navLabel("taxCalendar"), to: "/impuestos/calendario" },
            { ...navLabel("taxSettings"), to: "/configuracion/impuestos" },
          ],
        },
      ];
    if (tabPaths.includes(item.to)) return [];
    return [
      item.children
        ? {
            kind: "group",
            to: item.to,
            title: item.label,
            titleKey: item.labelKey,
            icon: item.icon,
            links: item.children.filter((leaf) => !leaf.desktopOnly),
          }
        : { kind: "link", item },
    ];
  }),
  ...secondaryNav.map((item): MoreEntry => ({ kind: "link", item })),
];

/** Every leaf route, used to register placeholder pages. */
export const allNavLeaves: NavLeaf[] = [
  ...new Map(
    [...mainNav.flatMap((item) => item.children ?? [item]), ...secondaryNav].map((leaf) => [leaf.to, leaf]),
  ).values(),
];

export interface CreateAction extends NavLabel {
  to: string;
  icon: LucideIcon;
}

/** Shortcuts in the "Crear" menu, split into documents and records. */
export const createActions: CreateAction[][] = [
  [
    { ...navLabel("issuedInvoice"), to: "/ventas/facturas/nueva", icon: ReceiptText },
    { ...navLabel("receivedInvoice"), to: "/compras/facturas/nueva", icon: Receipt },
    { ...navLabel("expense"), to: "/compras/gastos/nuevo", icon: Camera },
    { ...navLabel("asset"), to: "/compras/bienes-de-inversion/nuevo", icon: Armchair },
    { ...navLabel("deliveryNote"), to: "/ventas/albaranes/nuevo", icon: ClipboardList },
    { ...navLabel("quote"), to: "/ventas/presupuestos/nuevo", icon: FileText },
  ],
  [
    { ...navLabel("client"), to: "/contactos/clientes/nuevo", icon: UserRound },
    { ...navLabel("supplier"), to: "/contactos/proveedores/nuevo", icon: Building },
    { ...navLabel("product"), to: "/catalogo/productos/nuevo", icon: Package },
  ],
];

/**
 * The phone tab bar's middle menu: the everyday lists, one tap away. Each list has its own
 * "Nuevo" button, so the menu opens records rather than creating them. The issued invoices
 * already have their own tab, Ventas.
 */
export const phoneShortcuts: CreateAction[] = [
  { ...navLabel("receivedInvoices"), to: "/compras/facturas", icon: Receipt },
  { ...navLabel("expenses"), to: "/compras/gastos", icon: Camera },
  { ...navLabel("clients"), to: "/contactos/clientes", icon: UserRound },
];
