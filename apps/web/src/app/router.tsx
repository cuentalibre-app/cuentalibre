import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "@/components/layout/app-layout";
import { allNavLeaves, createActions } from "@/components/layout/nav";
import { CLOSING_PATH } from "@/features/closing/closing-model";
import { QuarterClosePage } from "@/features/closing/quarter-close-page";
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
import { ProfitLossPage } from "@/features/reports/profit-loss-page";
import { PNL_PATH, REPORTS_PATH } from "@/features/reports/reports-model";
import { ReportsSummaryPage } from "@/features/reports/reports-summary-page";
import { InvoiceSettingsPage } from "@/features/sales/invoice-settings-page";
import { SalesFormPage } from "@/features/sales/sales-form-page";
import { SalesListPage } from "@/features/sales/sales-list-page";
import { KINDS } from "@/features/sales/sales-model";
import { AccountsPage } from "@/features/settings/accounts-page";
import { BusinessPage } from "@/features/settings/business-page";
import { PaymentMethodsPage } from "@/features/settings/payment-methods-page";
import {
  ACCOUNTS_PATH,
  BUSINESS_PATH,
  INVOICE_SETTINGS_PATH,
  PAYMENT_METHODS_PATH,
  SETTINGS_PATH,
  TAX_SETTINGS_PATH,
} from "@/features/settings/settings-model";
import { SettingsPage } from "@/features/settings/settings-page";
import { TaxSettingsPage } from "@/features/settings/tax-settings-page";
import { FiscalCalendarPage } from "@/features/taxes/fiscal-calendar-page";
import { IncomeTaxPage } from "@/features/taxes/income-tax-page";
import { TaxesSummaryPage } from "@/features/taxes/taxes-summary-page";
import { CALENDAR_PATH, INCOME_TAX_PATH, TAXES_PATH, VAT_PATH } from "@/features/taxes/taxes-model";
import { VatPage } from "@/features/taxes/vat-page";
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

const taxRoutes = [
  { path: TAXES_PATH.slice(1), element: <TaxesSummaryPage /> },
  { path: CALENDAR_PATH.slice(1), element: <FiscalCalendarPage /> },
  { path: VAT_PATH.slice(1), element: <VatPage /> },
  { path: INCOME_TAX_PATH.slice(1), element: <IncomeTaxPage /> },
];

const closingRoute = { path: CLOSING_PATH.slice(1), element: <QuarterClosePage /> };

const reportRoutes = [
  { path: REPORTS_PATH.slice(1), element: <ReportsSummaryPage /> },
  { path: PNL_PATH.slice(1), element: <ProfitLossPage /> },
];

const settingsRoutes = [
  { path: SETTINGS_PATH.slice(1), element: <SettingsPage /> },
  { path: BUSINESS_PATH.slice(1), element: <BusinessPage /> },
  { path: TAX_SETTINGS_PATH.slice(1), element: <TaxSettingsPage /> },
  { path: ACCOUNTS_PATH.slice(1), element: <AccountsPage /> },
  { path: PAYMENT_METHODS_PATH.slice(1), element: <PaymentMethodsPage /> },
  { path: INVOICE_SETTINGS_PATH.slice(1), element: <InvoiceSettingsPage /> },
];

const builtPaths = new Set(
  [
    ...salesRoutes,
    ...purchaseRoutes,
    ...contactRoutes,
    ...taxRoutes,
    closingRoute,
    ...reportRoutes,
    ...settingsRoutes,
  ].map((r) => `/${r.path}`),
);

const placeholders = [
  ...allNavLeaves.filter((leaf) => leaf.to !== "/"),
  { label: "Ayuda", to: "/ayuda" },
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
      ...taxRoutes,
      closingRoute,
      ...reportRoutes,
      ...settingsRoutes,
      ...placeholders.map((p) => ({ path: p.to.slice(1), element: <PlaceholderPage title={p.label} /> })),
      { path: "*", element: <PlaceholderPage title="Página no encontrada" /> },
    ],
  },
  // Design system reference, outside the app shell
  { path: "sistema-visual", element: <DesignSystemPage /> },
]);
