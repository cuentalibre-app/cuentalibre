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
import {
  ASSETS_PATH,
  NEW_ASSET_PATH,
  NEW_PURCHASE_PATH,
  PURCHASES_PATH,
} from "@/features/purchases/purchases-model";
import { CompanyReportsPage } from "@/features/reports/company-reports-page";
import { ProfitLossPage } from "@/features/reports/profit-loss-page";
import { COMPANY_REPORTS_PATH, PNL_PATH, REPORTS_PATH } from "@/features/reports/reports-model";
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
import { IntraEuPage } from "@/features/taxes/intra-eu-page";
import { RentalsPage } from "@/features/taxes/rentals-page";
import {
  CALENDAR_PATH,
  INCOME_TAX_PATH,
  INTRA_EU_PATH,
  RENTALS_PATH,
  TAXES_PATH,
  THIRD_PARTIES_PATH,
  VAT_PATH,
  WITHHOLDINGS_PATH,
} from "@/features/taxes/taxes-model";
import { ThirdPartiesPage } from "@/features/taxes/third-parties-page";
import { VatPage } from "@/features/taxes/vat-page";
import { WithholdingsPage } from "@/features/taxes/withholdings-page";
import { MovementsPage } from "@/features/treasury/movements-page";
import { PaymentsPage } from "@/features/treasury/payments-page";
import { ReconciliationPage } from "@/features/treasury/reconciliation-page";
import { TreasurySummaryPage } from "@/features/treasury/treasury-summary-page";
import { MOVEMENTS_PATH, PAYMENTS_PATH, RECONCILIATION_PATH, TREASURY_PATH } from "@/features/treasury/treasury-model";
import { ExportAdvancedPage } from "@/features/transfer/export-advanced-page";
import { ExportBooksPage } from "@/features/transfer/export-books-page";
import { ExportPage } from "@/features/transfer/export-page";
import { ImportPage } from "@/features/transfer/import-page";
import { EXPORT_ADVANCED_PATH, EXPORT_BOOKS_PATH, EXPORT_PATH, IMPORT_PATH } from "@/features/transfer/transfer-model";
import { WorkedHoursPage } from "@/features/working-hours/worked-hours-page";
import { WORKED_HOURS_PATH, WORKING_HOURS_PATH } from "@/features/working-hours/working-hours-model";
import { WorkingHoursPage } from "@/features/working-hours/working-hours-page";
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
  { path: PURCHASES_PATH.slice(1), element: <PurchasesListPage key="invoice" /> },
  { path: NEW_PURCHASE_PATH.slice(1), element: <PurchaseFormPage key="invoice" /> },
  { path: `${PURCHASES_PATH.slice(1)}/:id`, element: <PurchaseFormPage key="invoice" /> },
  { path: ASSETS_PATH.slice(1), element: <PurchasesListPage key="asset" kind="asset" /> },
  { path: NEW_ASSET_PATH.slice(1), element: <PurchaseFormPage key="asset" kind="asset" /> },
  { path: `${ASSETS_PATH.slice(1)}/:id`, element: <PurchaseFormPage key="asset" kind="asset" /> },
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
  { path: WITHHOLDINGS_PATH.slice(1), element: <WithholdingsPage /> },
  { path: RENTALS_PATH.slice(1), element: <RentalsPage /> },
  { path: THIRD_PARTIES_PATH.slice(1), element: <ThirdPartiesPage /> },
  { path: INTRA_EU_PATH.slice(1), element: <IntraEuPage /> },
];

const treasuryRoutes = [
  { path: TREASURY_PATH.slice(1), element: <TreasurySummaryPage /> },
  { path: MOVEMENTS_PATH.slice(1), element: <MovementsPage /> },
  { path: RECONCILIATION_PATH.slice(1), element: <ReconciliationPage /> },
  { path: PAYMENTS_PATH.slice(1), element: <PaymentsPage /> },
];

const closingRoute = { path: CLOSING_PATH.slice(1), element: <QuarterClosePage /> };

const reportRoutes = [
  { path: REPORTS_PATH.slice(1), element: <ReportsSummaryPage /> },
  { path: PNL_PATH.slice(1), element: <ProfitLossPage /> },
  { path: COMPANY_REPORTS_PATH.slice(1), element: <CompanyReportsPage /> },
  { path: WORKED_HOURS_PATH.slice(1), element: <WorkedHoursPage /> },
];

const workingHoursRoute = { path: WORKING_HOURS_PATH.slice(1), element: <WorkingHoursPage /> };

const settingsRoutes = [
  { path: SETTINGS_PATH.slice(1), element: <SettingsPage /> },
  { path: BUSINESS_PATH.slice(1), element: <BusinessPage /> },
  { path: TAX_SETTINGS_PATH.slice(1), element: <TaxSettingsPage /> },
  { path: ACCOUNTS_PATH.slice(1), element: <AccountsPage /> },
  { path: PAYMENT_METHODS_PATH.slice(1), element: <PaymentMethodsPage /> },
  { path: INVOICE_SETTINGS_PATH.slice(1), element: <InvoiceSettingsPage /> },
];

const transferRoutes = [
  { path: EXPORT_PATH.slice(1), element: <ExportPage /> },
  { path: EXPORT_BOOKS_PATH.slice(1), element: <ExportBooksPage /> },
  { path: EXPORT_ADVANCED_PATH.slice(1), element: <ExportAdvancedPage /> },
  { path: IMPORT_PATH.slice(1), element: <ImportPage /> },
];

const builtPaths = new Set(
  [
    ...salesRoutes,
    ...purchaseRoutes,
    ...contactRoutes,
    ...taxRoutes,
    ...treasuryRoutes,
    closingRoute,
    ...reportRoutes,
    workingHoursRoute,
    ...settingsRoutes,
    ...transferRoutes,
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
      ...treasuryRoutes,
      closingRoute,
      ...reportRoutes,
      workingHoursRoute,
      ...settingsRoutes,
      ...transferRoutes,
      ...placeholders.map((p) => ({ path: p.to.slice(1), element: <PlaceholderPage title={p.label} /> })),
      { path: "*", element: <PlaceholderPage title="Página no encontrada" /> },
    ],
  },
  // Design system reference, outside the app shell
  { path: "sistema-visual", element: <DesignSystemPage /> },
]);
