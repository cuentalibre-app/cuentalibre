import { initialPurchaseInvoices } from "./purchases";
import { initialSalesDocuments } from "./sales";

/** Years with sample documents, newest first. */
export const availableYears = [
  ...new Set(
    [...initialSalesDocuments.map((d) => d.issuedOn), ...initialPurchaseInvoices.map((p) => p.bookedOn)].map((d) =>
      Number(d.slice(0, 4)),
    ),
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

export const quarterClose = { quarter: 3, year: 2026, stepsDone: 3, stepsTotal: 5 } as const;
