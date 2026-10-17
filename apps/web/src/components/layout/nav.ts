import {
  Armchair,
  Building,
  CalendarCheck,
  Camera,
  ChartColumn,
  ClipboardList,
  Clock,
  FileText,
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

export type BadgeKey = "drafts" | "filingsSoon" | "unreconciled";

export interface NavLeaf {
  label: string;
  to: string;
  badge?: BadgeKey;
  /** Draws a divider above the leaf, splitting a group's records from its tools. */
  separator?: boolean;
}

export interface NavItem extends NavLeaf {
  icon: LucideIcon;
  /** Items with children render as a collapsible group; `to` is then the group's base path. */
  children?: NavLeaf[];
}

/** Export and import cover sales and purchases alike, so both groups list them, as in the reference app. */
const transferLeaves: NavLeaf[] = [
  { label: "Exportar", to: "/exportar", separator: true },
  { label: "Importar", to: "/importar" },
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
      { label: "IRPF (130, 100)", to: "/impuestos/irpf" },
      { label: "Retenciones (111, 190)", to: "/impuestos/retenciones" },
      { label: "Alquileres (115, 180)", to: "/impuestos/alquileres" },
      { label: "Terceras personas (347)", to: "/impuestos/terceras-personas" },
      { label: "Intracomunitarias (349)", to: "/impuestos/intracomunitarias" },
    ],
  },
  {
    label: "Bancos",
    to: "/bancos",
    icon: Landmark,
    badge: "unreconciled",
    children: [
      { label: "Resumen", to: "/bancos" },
      { label: "Movimientos", to: "/bancos/movimientos" },
      { label: "Conciliación", to: "/bancos/conciliacion", badge: "unreconciled" },
      { label: "Cobros y pagos", to: "/bancos/cobros-y-pagos" },
    ],
  },
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
    label: "Informes",
    to: "/informes",
    icon: ChartColumn,
    children: [
      { label: "Resumen", to: "/informes" },
      { label: "Pérdidas y ganancias", to: "/informes/perdidas-y-ganancias" },
      { label: "Informes de empresas", to: "/informes/empresas" },
      { label: "Horas trabajadas", to: "/informes/horas-trabajadas" },
    ],
  },
];

export const secondaryNav: NavItem[] = [
  { label: "Cierre de trimestres", to: "/cierre-trimestre", icon: CalendarCheck },
  { label: "Jornada laboral", to: "/jornada", icon: Clock },
  { label: "Configuración", to: "/configuracion", icon: Settings },
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
    { label: "Producto", to: "/productos/nuevo", icon: Package },
  ],
];
