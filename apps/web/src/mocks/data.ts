import { initialExpenses } from "./expenses";
import { initialPurchaseInvoices } from "./purchases";
import { initialSalesDocuments } from "./sales";

/** Years with sample documents, newest first. */
export const availableYears = [
  ...new Set(
    [
      ...initialSalesDocuments.map((d) => d.issuedOn),
      ...initialPurchaseInvoices.map((p) => p.bookedOn),
      ...initialExpenses.map((e) => e.date),
    ].map((d) => Number(d.slice(0, 4))),
  ),
].sort((a, b) => b - a);

export const currentUser = {
  name: "Lucía Martín",
  initials: "LM",
  taxId: "50123456Q",
  address: "Calle del Pez 12, 3º B · 28004 Madrid",
  taxRegime: "Estimación directa simplificada",
  /** Monthly RETA fee. */
  socialSecurityFee: 294,
};

