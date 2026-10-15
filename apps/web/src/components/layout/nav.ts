import {
  Building,
  Camera,
  ChartColumn,
  ClipboardList,
  FileText,
  Package,
  Receipt,
  Landmark,
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
}

export interface NavItem extends NavLeaf {
  icon: LucideIcon;
  /** Items with children render as a collapsible group; `to` is then the group's base path. */
  children?: NavLeaf[];
}

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
      { label: "Facturas recurrentes", to: "/ventas/recurrentes" },
    ],
  },
  {
    label: "Compras y gastos",
    to: "/compras",
    icon: ShoppingBag,
    children: [
      { label: "Facturas recibidas", to: "/compras/facturas" },
      { label: "Gastos", to: "/compras/gastos" },
    ],
  },
  { label: "Impuestos", to: "/impuestos", icon: Percent, badge: "filingsSoon" },
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
  { label: "Informes", to: "/informes", icon: ChartColumn },
];

export const secondaryNav: NavLeaf[] = [
  { label: "Exportar", to: "/exportar" },
  { label: "Importar", to: "/importar" },
  { label: "Cierre de trimestres", to: "/cierre-trimestre" },
];

/** Every leaf route, used to register placeholder pages. */
export const allNavLeaves: NavLeaf[] = [
  ...mainNav.flatMap((item) => item.children ?? [item]),
  ...secondaryNav,
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
    { label: "Albarán", to: "/ventas/albaranes/nuevo", icon: ClipboardList },
    { label: "Presupuesto", to: "/ventas/presupuestos/nuevo", icon: FileText },
  ],
  [
    { label: "Cliente", to: "/contactos/clientes/nuevo", icon: UserRound },
    { label: "Proveedor", to: "/contactos/proveedores/nuevo", icon: Building },
    { label: "Producto", to: "/productos/nuevo", icon: Package },
  ],
];
