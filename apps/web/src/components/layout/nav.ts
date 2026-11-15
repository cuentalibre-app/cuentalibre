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

export type BadgeKey = "drafts" | "filingsSoon";

export interface NavLeaf {
  label: string;
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
  { label: "Exportar", to: "/exportar", separator: true, desktopOnly: true },
  { label: "Importar", to: "/importar", desktopOnly: true },
];

export const mainNav: NavItem[] = [
  { label: "Inicio", to: "/", icon: LayoutGrid },
  {
    label: "Ventas",
    to: "/ventas",
    icon: ReceiptText,
    children: [
      { label: "Facturas emitidas", to: "/ventas/facturas" },
      { label: "Borradores", to: "/ventas/borradores", badge: "drafts" },
      { label: "Albaranes", to: "/ventas/albaranes" },
      { label: "Presupuestos", to: "/ventas/presupuestos" },
      ...transferLeaves,
    ],
  },
  {
    label: "Compras",
    to: "/compras",
    icon: ShoppingBag,
    children: [
      { label: "Facturas recibidas", to: "/compras/facturas" },
      { label: "Bienes de inversión", to: "/compras/bienes-de-inversion" },
      { label: "Gastos", to: "/compras/gastos" },
      ...transferLeaves,
    ],
  },
  {
    label: "Impuestos",
    to: "/impuestos",
    icon: Percent,
    badge: "filingsSoon",
    children: [
      { label: "Resumen", to: "/impuestos" },
      { label: "Calendario fiscal", to: "/impuestos/calendario" },
      { label: "IVA (303, 390)", to: "/impuestos/iva" },
      { label: "IRPF (130, 100)", to: "/impuestos/irpf", selfEmployedOnly: true },
      { label: "Retenciones (111, 190)", to: "/impuestos/retenciones" },
      { label: "Alquileres (115, 180)", to: "/impuestos/alquileres" },
      { label: "Terceras personas (347)", to: "/impuestos/terceras-personas" },
      { label: "Intracomunitarias (349)", to: "/impuestos/intracomunitarias" },
    ],
  },
  { label: "Bancos", to: "/bancos", icon: Landmark },
  {
    label: "Contactos",
    to: "/contactos",
    icon: UserRound,
    children: [
      { label: "Clientes", to: "/contactos/clientes" },
      { label: "Proveedores", to: "/contactos/proveedores" },
    ],
  },
  {
    label: "Catálogo",
    to: "/catalogo",
    icon: Package,
    children: [
      { label: "Productos", to: "/catalogo/productos" },
      { label: "Regularizar stock", to: "/catalogo/regularizar-stock" },
      { label: "Importar", to: "/catalogo/importar", separator: true, desktopOnly: true },
      { label: "Exportar", to: "/catalogo/exportar", desktopOnly: true },
    ],
  },
  {
    label: "Informes",
    to: "/informes",
    icon: ChartColumn,
    children: [
      { label: "Resumen", to: "/informes" },
      { label: "Pérdidas y ganancias", to: "/informes/perdidas-y-ganancias" },
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
  { label: "Cierre de trimestres", to: "/cierre-trimestre", icon: CalendarCheck },
  { label: "Configuración", to: "/configuracion", icon: Settings },
];

export type PhoneTab =
  | { kind: "link"; label: string; to: string; icon: LucideIcon; tour: string }
  | { kind: "create"; label: string; icon: LucideIcon; tour: string }
  | { kind: "more"; label: string; icon: LucideIcon; tour: string };

/** The phone's tab bar, left to right as drawn: three sections, the shortcuts menu and "Más". */
export const phoneTabs: PhoneTab[] = [
  { kind: "link", label: "Inicio", to: "/", icon: LayoutGrid, tour: "/" },
  { kind: "link", label: "Ventas", to: "/ventas", icon: ReceiptText, tour: "/ventas" },
  { kind: "create", label: "Accesos rápidos", icon: Layers, tour: "/compras" },
  { kind: "link", label: "Impuestos", to: "/impuestos", icon: Percent, tour: "/impuestos" },
  { kind: "more", label: "Más", icon: Menu, tour: "/mas" },
];

/** Paths with a tab of their own in the mobile tab bar. */
export const tabPaths = phoneTabs.flatMap((tab) => (tab.kind === "link" ? [tab.to] : []));

export type MoreEntry =
  { kind: "link"; item: NavItem } | { kind: "group"; to: string; title: string; icon: LucideIcon; links: NavLeaf[] };

/**
 * Sections that don't fit in the mobile tab bar, in sidebar order, listed under "Más": a section with
 * pages of its own is a titled group, a single page is a plain row.
 */
export const moreNav: MoreEntry[] = [
  ...mainNav.flatMap((item): MoreEntry[] => {
    // Taxes has a tab, but its summary leaves the calendar and settings out on phones; they live here
    if (item.to === "/impuestos")
      return [
        {
          kind: "group",
          to: item.to,
          title: item.label,
          icon: item.icon,
          links: [
            { label: "Calendario fiscal", to: "/impuestos/calendario" },
            { label: "Configurar impuestos", to: "/configuracion/impuestos" },
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

export interface CreateAction {
  label: string;
  to: string;
  icon: LucideIcon;
}

/** Shortcuts in the "Crear" menu, split into documents and records. */
export const createActions: CreateAction[][] = [
  [
    { label: "Factura emitida", to: "/ventas/facturas/nueva", icon: ReceiptText },
    { label: "Factura recibida", to: "/compras/facturas/nueva", icon: Receipt },
    { label: "Gasto", to: "/compras/gastos/nuevo", icon: Camera },
    { label: "Bien de inversión", to: "/compras/bienes-de-inversion/nuevo", icon: Armchair },
    { label: "Albarán", to: "/ventas/albaranes/nuevo", icon: ClipboardList },
    { label: "Presupuesto", to: "/ventas/presupuestos/nuevo", icon: FileText },
  ],
  [
    { label: "Cliente", to: "/contactos/clientes/nuevo", icon: UserRound },
    { label: "Proveedor", to: "/contactos/proveedores/nuevo", icon: Building },
    { label: "Producto", to: "/catalogo/productos/nuevo", icon: Package },
  ],
];

/**
 * The phone tab bar's middle menu: the everyday lists, one tap away. Each list has its own
 * "Nuevo" button, so the menu opens records rather than creating them. The issued invoices
 * already have their own tab, Ventas.
 */
export const phoneShortcuts: CreateAction[] = [
  { label: "Facturas recibidas", to: "/compras/facturas", icon: Receipt },
  { label: "Gastos", to: "/compras/gastos", icon: Camera },
  { label: "Clientes", to: "/contactos/clientes", icon: UserRound },
];
