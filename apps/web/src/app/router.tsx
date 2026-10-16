import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "@/components/layout/app-layout";
import { allNavLeaves, createActions } from "@/components/layout/nav";
import { ContactDetailPage } from "@/features/contacts/contact-detail-page";
import { ContactFormPage } from "@/features/contacts/contact-form-page";
import { ContactsListPage } from "@/features/contacts/contacts-list-page";
import { ROLES } from "@/features/contacts/contacts-model";
import { HomePage } from "@/features/home/home-page";
import { ExpenseFormPage } from "@/features/purchases/expense-form-page";
import { ExpensesListPage } from "@/features/purchases/expenses-list-page";
import { EXPENSES_PATH, NEW_EXPENSE_PATH } from "@/features/purchases/expenses-model";
import { PurchaseFormPage } from "@/features/purchases/purchase-form-page";
import { PurchasesListPage } from "@/features/purchases/purchases-list-page";
import { NEW_PURCHASE_PATH, PURCHASES_PATH } from "@/features/purchases/purchases-model";
import { InvoiceSettingsPage } from "@/features/sales/invoice-settings-page";
import { SalesFormPage } from "@/features/sales/sales-form-page";
import { SalesListPage } from "@/features/sales/sales-list-page";
import { KINDS } from "@/features/sales/sales-model";
import type { ContactRole } from "@/mocks/contacts";
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
  { path: EXPENSES_PATH.slice(1), element: <ExpensesListPage /> },
  { path: NEW_EXPENSE_PATH.slice(1), element: <ExpenseFormPage /> },
  { path: `${EXPENSES_PATH.slice(1)}/:id`, element: <ExpenseFormPage /> },
];

const contactRoutes = (Object.keys(ROLES) as ContactRole[]).flatMap((role) => {
  const { path, newPath } = ROLES[role];
  return [
    { path: path.slice(1), element: <ContactsListPage key={role} role={role} /> },
    { path: newPath.slice(1), element: <ContactFormPage key={role} role={role} /> },
    { path: `${path.slice(1)}/:id`, element: <ContactDetailPage key={role} role={role} /> },
    { path: `${path.slice(1)}/:id/editar`, element: <ContactFormPage key={role} role={role} /> },
  ];
});

const builtPaths = new Set([...salesRoutes, ...purchaseRoutes, ...contactRoutes].map((r) => `/${r.path}`));

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
      ...contactRoutes,
      { path: "configuracion/facturas", element: <InvoiceSettingsPage /> },
      ...placeholders.map((p) => ({ path: p.to.slice(1), element: <PlaceholderPage title={p.label} /> })),
      { path: "*", element: <PlaceholderPage title="Página no encontrada" /> },
    ],
  },
  // Design system reference, outside the app shell
  { path: "sistema-visual", element: <DesignSystemPage /> },
]);
