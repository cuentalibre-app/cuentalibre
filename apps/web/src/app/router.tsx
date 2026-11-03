import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import type { ContactRole, SalesKind } from "@cuentalibre/contracts";
import { AppLayout } from "@/components/layout/app-layout";
import { allNavLeaves, createActions } from "@/components/layout/nav";
import { CatalogExportPage } from "@/features/catalog/catalog-export-page";
import { CatalogImportPage } from "@/features/catalog/catalog-import-page";
import { CatalogListPage } from "@/features/catalog/catalog-list-page";
import {
  CATALOG_EXPORT_PATH,
  CATALOG_IMPORT_PATH,
  CATALOG_SETTINGS_PATH,
  NEW_PRODUCT_PATH,
  PRODUCTS_PATH,
  STOCK_PATH,
} from "@/features/catalog/catalog-model";
import { CatalogSettingsPage } from "@/features/catalog/catalog-settings-page";
import { ProductFormPage } from "@/features/catalog/product-form-page";
import { StockPage } from "@/features/catalog/stock-page";
import { ForgotPasswordPage } from "@/features/auth/forgot-password-page";
import { OnboardingPage } from "@/features/auth/onboarding-page";
import { ResetPasswordPage } from "@/features/auth/reset-password-page";
import { GuestOnly, RequireSession } from "@/features/auth/session-gate";
import {
  FORGOT_PASSWORD_PATH,
  ONBOARDING_PATH,
  RESET_PASSWORD_PATH,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  routerBasename,
} from "@/features/auth/session";
import { SignInPage } from "@/features/auth/sign-in-page";
import { SignUpPage } from "@/features/auth/sign-up-page";
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
import { ASSETS_PATH, NEW_ASSET_PATH, NEW_PURCHASE_PATH, PURCHASES_PATH } from "@/features/purchases/purchases-model";
import { CompanyReportsPage } from "@/features/reports/company-reports-page";
import { ProfitLossPage } from "@/features/reports/profit-loss-page";
import { COMPANY_REPORTS_PATH, PNL_PATH, REPORTS_PATH } from "@/features/reports/reports-model";
import { ReportsSummaryPage } from "@/features/reports/reports-summary-page";
import { InvoiceSettingsPage } from "@/features/sales/invoice-settings-page";
import { SalesFormPage } from "@/features/sales/sales-form-page";
import { SalesListPage } from "@/features/sales/sales-list-page";
import { KINDS } from "@/features/sales/sales-model";
import { DocumentSettingsPage } from "@/features/sales/document-settings-page";
import { AccessPage } from "@/features/settings/access-page";
import { BillingPage } from "@/features/settings/billing-page";
import { RequireWritable } from "@/features/settings/read-only-gate";
import { BusinessPage } from "@/features/settings/business-page";
import { ContactSettingsPage } from "@/features/settings/contact-settings-page";
import { ApiKeysPage } from "@/features/settings/api-keys-page";
import { EmailTemplatesPage } from "@/features/settings/email-templates-page";
import { LedgerAccountsPage } from "@/features/settings/ledger-accounts-page";
import { PaymentMethodsPage } from "@/features/settings/payment-methods-page";
import { PreferencesPage } from "@/features/settings/preferences-page";
import { ProfilePage } from "@/features/settings/profile-page";
import {
  ACCESS_PATH,
  BILLING_PATH,
  BUSINESS_PATH,
  CONTACT_SETTINGS_PATH,
  DELIVERY_NOTE_SETTINGS_PATH,
  DRAFT_SETTINGS_PATH,
  EMAIL_TEMPLATES_PATH,
  API_KEYS_PATH,
  INVOICE_SETTINGS_PATH,
  LEDGER_ACCOUNTS_PATH,
  OLD_PAYMENT_METHODS_PATHS,
  PAYMENT_METHODS_PATH,
  PREFERENCES_PATH,
  PROFILE_PATH,
  QUOTE_SETTINGS_PATH,
  SETTINGS_PATH,
  TAGS_PATH,
  TAX_SETTINGS_PATH,
  USERS_PATH,
} from "@/features/settings/settings-model";
import { SettingsPage } from "@/features/settings/settings-page";
import { TagsPage } from "@/features/settings/tags-page";
import { TaxSettingsPage } from "@/features/settings/tax-settings-page";
import { UsersPage } from "@/features/settings/users-page";

import { FiscalCalendarPage } from "@/features/taxes/fiscal-calendar-page";
import { IncomeTaxPage } from "@/features/taxes/income-tax-page";
import { TaxesSummaryPage } from "@/features/taxes/taxes-summary-page";
import { IntraEuPage } from "@/features/taxes/intra-eu-page";
import { RentalsPage } from "@/features/taxes/rentals-page";
import { TaxModulePage } from "@/features/taxes/tax-intro";
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
import { PaymentsPage } from "@/features/treasury/payments-page";
import { OLD_PAYMENTS_PATH, TREASURY_PATH } from "@/features/treasury/treasury-model";
import { ExportAdvancedPage } from "@/features/transfer/export-advanced-page";
import { ExportBooksPage } from "@/features/transfer/export-books-page";
import { ExportPage } from "@/features/transfer/export-page";
import { ImportPage } from "@/features/transfer/import-page";
import { EXPORT_ADVANCED_PATH, EXPORT_BOOKS_PATH, EXPORT_PATH, IMPORT_PATH } from "@/features/transfer/transfer-model";
import { DesignSystemPage } from "@/pages/design-system";
import { MorePage } from "@/pages/more-page";
import { PlaceholderPage } from "@/pages/placeholder-page";

/** Pages that only create something: read-only companies see why they can't instead of the form. */
const writable = (page: ReactNode) => <RequireWritable>{page}</RequireWritable>;

const salesRoutes = (Object.keys(KINDS) as SalesKind[]).flatMap((kind) => {
  const { path, newPath } = KINDS[kind];
  return [
    { path: path.slice(1), element: <SalesListPage key={kind} kind={kind} /> },
    { path: newPath.slice(1), element: writable(<SalesFormPage key={kind} kind={kind} />) },
    { path: `${path.slice(1)}/:id`, element: <SalesFormPage key={kind} kind={kind} /> },
  ];
});

const purchaseRoutes = [
  { path: PURCHASES_PATH.slice(1), element: <PurchasesListPage key="invoice" /> },
  { path: NEW_PURCHASE_PATH.slice(1), element: writable(<PurchaseFormPage key="invoice" />) },
  { path: `${PURCHASES_PATH.slice(1)}/:id`, element: <PurchaseFormPage key="invoice" /> },
  { path: ASSETS_PATH.slice(1), element: <PurchasesListPage key="asset" kind="asset" /> },
  { path: NEW_ASSET_PATH.slice(1), element: writable(<PurchaseFormPage key="asset" kind="asset" />) },
  { path: `${ASSETS_PATH.slice(1)}/:id`, element: <PurchaseFormPage key="asset" kind="asset" /> },
  { path: EXPENSES_PATH.slice(1), element: <ExpensesListPage /> },
  { path: NEW_EXPENSE_PATH.slice(1), element: writable(<ExpenseFormPage />) },
  { path: `${EXPENSES_PATH.slice(1)}/:id`, element: <ExpenseFormPage /> },
];

const contactRoutes = (Object.keys(ROLES) as ContactRole[]).flatMap((role) => {
  const { path, newPath } = ROLES[role];
  return [
    { path: path.slice(1), element: <ContactsListPage key={role} role={role} /> },
    { path: newPath.slice(1), element: writable(<ContactFormPage key={role} role={role} />) },
    { path: `${path.slice(1)}/:id`, element: <ContactDetailPage key={role} role={role} /> },
    { path: `${path.slice(1)}/:id/editar`, element: <ContactFormPage key={role} role={role} /> },
  ];
});

const catalogRoutes = [
  { path: PRODUCTS_PATH.slice(1), element: <CatalogListPage /> },
  { path: NEW_PRODUCT_PATH.slice(1), element: writable(<ProductFormPage />) },
  { path: `${PRODUCTS_PATH.slice(1)}/:id`, element: <ProductFormPage /> },
  { path: STOCK_PATH.slice(1), element: <StockPage /> },
  { path: CATALOG_IMPORT_PATH.slice(1), element: writable(<CatalogImportPage />) },
  { path: CATALOG_EXPORT_PATH.slice(1), element: <CatalogExportPage /> },
];

const taxRoutes = [
  { path: TAXES_PATH.slice(1), element: <TaxesSummaryPage /> },
  { path: CALENDAR_PATH.slice(1), element: <FiscalCalendarPage /> },
  {
    path: VAT_PATH.slice(1),
    element: (
      <TaxModulePage module="vat">
        <VatPage />
      </TaxModulePage>
    ),
  },
  {
    path: INCOME_TAX_PATH.slice(1),
    element: (
      <TaxModulePage module="incomeTax">
        <IncomeTaxPage />
      </TaxModulePage>
    ),
  },
  {
    path: WITHHOLDINGS_PATH.slice(1),
    element: (
      <TaxModulePage module="withholdings">
        <WithholdingsPage />
      </TaxModulePage>
    ),
  },
  {
    path: RENTALS_PATH.slice(1),
    element: (
      <TaxModulePage module="rentals">
        <RentalsPage />
      </TaxModulePage>
    ),
  },
  {
    path: THIRD_PARTIES_PATH.slice(1),
    element: (
      <TaxModulePage module="thirdParties">
        <ThirdPartiesPage />
      </TaxModulePage>
    ),
  },
  {
    path: INTRA_EU_PATH.slice(1),
    element: (
      <TaxModulePage module="intraEu">
        <IntraEuPage />
      </TaxModulePage>
    ),
  },
];

const treasuryRoutes = [
  { path: TREASURY_PATH.slice(1), element: <PaymentsPage /> },
  // Old links to the bank movements and reconciliation pages, which are gone
  { path: "bancos/movimientos", element: <Navigate to={TREASURY_PATH} replace /> },
  { path: "bancos/conciliacion", element: <Navigate to={TREASURY_PATH} replace /> },
  { path: OLD_PAYMENTS_PATH.slice(1), element: <Navigate to={TREASURY_PATH} replace /> },
];

const closingRoute = { path: CLOSING_PATH.slice(1), element: <QuarterClosePage /> };

const reportRoutes = [
  { path: REPORTS_PATH.slice(1), element: <ReportsSummaryPage /> },
  { path: PNL_PATH.slice(1), element: <ProfitLossPage /> },
  { path: COMPANY_REPORTS_PATH.slice(1), element: <CompanyReportsPage /> },
];

const settingsRoutes = [
  { path: SETTINGS_PATH.slice(1), element: <SettingsPage /> },
  { path: BUSINESS_PATH.slice(1), element: <BusinessPage /> },
  { path: TAX_SETTINGS_PATH.slice(1), element: <TaxSettingsPage /> },
  { path: PAYMENT_METHODS_PATH.slice(1), element: <PaymentMethodsPage /> },
  ...OLD_PAYMENT_METHODS_PATHS.map((path) => ({
    path: path.slice(1),
    element: <Navigate to={PAYMENT_METHODS_PATH} replace />,
  })),
  { path: INVOICE_SETTINGS_PATH.slice(1), element: <InvoiceSettingsPage /> },
  { path: CATALOG_SETTINGS_PATH.slice(1), element: <CatalogSettingsPage /> },
  { path: PROFILE_PATH.slice(1), element: <ProfilePage /> },
  { path: ACCESS_PATH.slice(1), element: <AccessPage /> },

  { path: DRAFT_SETTINGS_PATH.slice(1), element: <DocumentSettingsPage key="draft" kind="draft" /> },
  { path: QUOTE_SETTINGS_PATH.slice(1), element: <DocumentSettingsPage key="quote" kind="quote" /> },
  {
    path: DELIVERY_NOTE_SETTINGS_PATH.slice(1),
    element: <DocumentSettingsPage key="deliveryNote" kind="deliveryNote" />,
  },
  { path: LEDGER_ACCOUNTS_PATH.slice(1), element: <LedgerAccountsPage /> },
  { path: CONTACT_SETTINGS_PATH.slice(1), element: <ContactSettingsPage /> },
  { path: USERS_PATH.slice(1), element: <UsersPage /> },
  { path: TAGS_PATH.slice(1), element: <TagsPage /> },
  { path: PREFERENCES_PATH.slice(1), element: <PreferencesPage /> },
  { path: EMAIL_TEMPLATES_PATH.slice(1), element: <EmailTemplatesPage /> },
  { path: API_KEYS_PATH.slice(1), element: <ApiKeysPage /> },
  { path: BILLING_PATH.slice(1), element: <BillingPage /> },
];

const transferRoutes = [
  { path: EXPORT_PATH.slice(1), element: <ExportPage /> },
  { path: EXPORT_BOOKS_PATH.slice(1), element: <ExportBooksPage /> },
  { path: EXPORT_ADVANCED_PATH.slice(1), element: <ExportAdvancedPage /> },
  { path: IMPORT_PATH.slice(1), element: writable(<ImportPage />) },
];

const builtPaths = new Set(
  [
    ...salesRoutes,
    ...purchaseRoutes,
    ...contactRoutes,
    ...catalogRoutes,
    ...taxRoutes,
    ...treasuryRoutes,
    closingRoute,
    ...reportRoutes,
    ...settingsRoutes,
    ...transferRoutes,
  ].map((r) => `/${r.path}`),
);

const placeholders = [
  ...allNavLeaves.filter((leaf) => leaf.to !== "/"),
  ...createActions.flat().map((action) => ({ label: `Crear ${action.label.toLowerCase()}`, to: action.to })),
].filter((p) => !builtPaths.has(p.to));

export const router = createBrowserRouter(
  [
    {
      element: (
        <RequireSession>
          <AppLayout />
        </RequireSession>
      ),
      children: [
        { index: true, element: <HomePage /> },
        { path: "ventas", element: <Navigate to="/ventas/facturas" replace /> },
        { path: "compras", element: <Navigate to="/compras/facturas" replace /> },
        { path: "contactos", element: <Navigate to="/contactos/clientes" replace /> },
        { path: "catalogo", element: <Navigate to={PRODUCTS_PATH} replace /> },
        { path: "mas", element: <MorePage /> },
        ...salesRoutes,
        ...purchaseRoutes,
        ...contactRoutes,
        ...catalogRoutes,
        ...taxRoutes,
        ...treasuryRoutes,
        closingRoute,
        ...reportRoutes,
        ...settingsRoutes,
        ...transferRoutes,
        ...placeholders.map((p) => ({ path: p.to.slice(1), element: <PlaceholderPage title={p.label} /> })),
        { path: "*", element: <PlaceholderPage title="Página no encontrada" /> },
      ],
    },
    {
      path: SIGN_IN_PATH.slice(1),
      element: (
        <GuestOnly>
          <SignInPage />
        </GuestOnly>
      ),
    },
    {
      path: SIGN_UP_PATH.slice(1),
      element: (
        <GuestOnly>
          <SignUpPage />
        </GuestOnly>
      ),
    },
    {
      path: FORGOT_PASSWORD_PATH.slice(1),
      element: (
        <GuestOnly>
          <ForgotPasswordPage />
        </GuestOnly>
      ),
    },
    // Not guest-only: the emailed link works in a tab that is still signed in
    { path: RESET_PASSWORD_PATH.slice(1), element: <ResetPasswordPage /> },
    { path: ONBOARDING_PATH.slice(1), element: <OnboardingPage /> },
    // Design system reference, outside the app shell
    { path: "sistema-visual", element: <DesignSystemPage /> },
  ],
  { basename: routerBasename() },
);
