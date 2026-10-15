import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "@/components/layout/app-layout";
import { allNavLeaves, createActions } from "@/components/layout/nav";
import { HomePage } from "@/features/home/home-page";
import { PurchaseFormPage } from "@/features/purchases/purchase-form-page";
import { PurchasesListPage } from "@/features/purchases/purchases-list-page";
import { NEW_PURCHASE_PATH, PURCHASES_PATH } from "@/features/purchases/purchases-model";
import { InvoiceSettingsPage } from "@/features/sales/invoice-settings-page";
import { SalesFormPage } from "@/features/sales/sales-form-page";
import { SalesListPage } from "@/features/sales/sales-list-page";
import { KINDS } from "@/features/sales/sales-model";
import type { SalesKind } from "@/mocks/sales";
import { DesignSystemPage } from "@/pages/design-system";
import { MorePage } from "@/pages/more-page";
import { PlaceholderPage } from "@/pages/placeholder-page";

const salesRoutes = (Object.keys(KINDS) as SalesKind[]).flatMap((kind) => {
  const { path, newPath } = KINDS[kind];
  return [
    { path: path.slice(1), element: <SalesListPage key={kind} kind={kind} /> },
    { path: newPath.slice(1), element: <SalesFormPage key={kind} kind={kind} /> },
    { path: `${path.slice(1)}/:id`, element: <SalesFormPage key={kind} kind={kind} /> },
  ];
});

const purchaseRoutes = [
  { path: PURCHASES_PATH.slice(1), element: <PurchasesListPage /> },
  { path: NEW_PURCHASE_PATH.slice(1), element: <PurchaseFormPage /> },
  { path: `${PURCHASES_PATH.slice(1)}/:id`, element: <PurchaseFormPage /> },
];

const builtPaths = new Set([...salesRoutes, ...purchaseRoutes].map((r) => `/${r.path}`));

const placeholders = [
  ...allNavLeaves.filter((leaf) => leaf.to !== "/"),
  { label: "Ayuda", to: "/ayuda" },
  { label: "Métodos de pago y cobro", to: "/configuracion/metodos-de-pago" },
  ...createActions.flat().map((action) => ({ label: `Crear ${action.label.toLowerCase()}`, to: action.to })),
].filter((p) => !builtPaths.has(p.to));

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "ventas", element: <Navigate to="/ventas/facturas" replace /> },
      { path: "compras", element: <Navigate to="/compras/facturas" replace /> },
      { path: "contactos", element: <Navigate to="/contactos/clientes" replace /> },
      { path: "mas", element: <MorePage /> },
      ...salesRoutes,
      ...purchaseRoutes,
      { path: "configuracion/facturas", element: <InvoiceSettingsPage /> },
      ...placeholders.map((p) => ({ path: p.to.slice(1), element: <PlaceholderPage title={p.label} /> })),
      { path: "*", element: <PlaceholderPage title="Página no encontrada" /> },
    ],
  },
  // Design system reference, outside the app shell
  { path: "sistema-visual", element: <DesignSystemPage /> },
]);
