import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "@/components/layout/app-layout";
import { allNavLeaves, createActions } from "@/components/layout/nav";
import { HomePage } from "@/features/home/home-page";
import { DesignSystemPage } from "@/pages/design-system";
import { MorePage } from "@/pages/more-page";
import { PlaceholderPage } from "@/pages/placeholder-page";

const placeholders = [
  ...allNavLeaves.filter((leaf) => leaf.to !== "/"),
  ...createActions.flat().map((action) => ({ label: `Crear ${action.label.toLowerCase()}`, to: action.to })),
];

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "ventas", element: <Navigate to="/ventas/facturas" replace /> },
      { path: "compras", element: <Navigate to="/compras/facturas" replace /> },
      { path: "contactos", element: <Navigate to="/contactos/clientes" replace /> },
      { path: "mas", element: <MorePage /> },
      ...placeholders.map((p) => ({ path: p.to.slice(1), element: <PlaceholderPage title={p.label} /> })),
      { path: "*", element: <PlaceholderPage title="Página no encontrada" /> },
    ],
  },
  // Design system reference, outside the app shell
  { path: "sistema-visual", element: <DesignSystemPage /> },
]);
