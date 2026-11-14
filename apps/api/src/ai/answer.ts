import type { ExpenseType, ExtractedPurchase } from "@cuentalibre/contracts";
import { COUNTRY_CODES, eurosToCents, storedTaxId } from "@cuentalibre/core";
import { z } from "zod";

/*
 * What the model is asked to answer, and how its answer becomes a draft. The model
 * copies what is printed: euros with decimals, rates as percentages, ISO dates.
 * Turning that into cents and fractions is left to code, which doesn't misplace a
 * decimal. Every field is required and nullable, as OpenAI's strict structured
 * outputs require; a field the document lacks is null.
 */

/**
 * The expense accounts (PGC group 6) a received document can be booked to, as the
 * model is told about them. Payroll and amortization never come from a supplier's
 * document, so they aren't offered.
 */
const EXPENSE_ACCOUNTS = {
  "600": "goods bought to resell or raw materials",
  "602": "other supplies consumed by the business (packaging, spare parts)",
  "607": "work subcontracted to other companies",
  "621": "rent and leases (premises, coworking, equipment rental)",
  "622": "repairs and maintenance",
  "623": "independent professionals (accountant, lawyer, freelancers, notary)",
  "624": "transport (fuel, transport passes, courier)",
  "625": "insurance premiums",
  "626": "bank and payment fees",
  "627": "advertising, marketing and business meals with clients",
  "628": "utilities (electricity, water, gas)",
  "629": "other services, including software subscriptions and hosting",
  "6291": "communications (internet, phone)",
  "6292": "travel, hotels, parking, taxis and tolls",
  "6293": "office supplies",
  "6294": "computer equipment and peripherals",
  "6295": "the worker's own meals on a working day",
  "6297": "memberships, professional associations, magazines",
  "631": "taxes and fees (IBI, waste collection, administrative fees)",
  "6422": "the worker's own social security contribution (cuota de autónomos) or mutual fund",
  "660": "loan interest and fees",
} satisfies Partial<Record<ExpenseType, string>>;

const expenseAccounts = Object.keys(EXPENSE_ACCOUNTS) as [
  keyof typeof EXPENSE_ACCOUNTS,
  ...(keyof typeof EXPENSE_ACCOUNTS)[],
];

export const modelAnswerSchema = z.object({
  documentType: z
    .enum(["invoice", "simplifiedInvoice"])
    .describe("invoice: a full invoice naming both parties. simplifiedInvoice: a ticket or simplified invoice."),
  supplier: z
    .object({
      name: z.string().nullable(),
      taxId: z.string().nullable().describe("NIF, CIF or VAT number, as printed"),
      address: z.string().nullable().describe("Street and number"),
      postalCode: z.string().nullable(),
      city: z.string().nullable(),
      countryCode: z.string().nullable().describe("ISO 3166-1 alpha-2, e.g. ES"),
    })
    .describe("Who issued the document and is paid, never its recipient"),
  number: z.string().nullable().describe("The invoice or ticket number"),
  issueDate: z.string().nullable().describe("YYYY-MM-DD"),
  dueDate: z.string().nullable().describe("YYYY-MM-DD"),
  concept: z.string().nullable().describe("What was bought, in a few words of Spanish"),
  currency: z.string().nullable().describe("ISO 4217, e.g. EUR"),
  vatLines: z
    .array(
      z.object({
        ratePercent: z.number().describe("VAT (IVA) rate, e.g. 21"),
        base: z.number().describe("Taxable base at that rate, in euros"),
        vat: z.number().describe("VAT at that rate, in euros"),
        surchargePercent: z.number().nullable().describe("Equivalence surcharge (recargo de equivalencia) rate"),
        surcharge: z.number().nullable().describe("Equivalence surcharge amount, in euros"),
      }),
    )
    .describe("One entry per VAT rate printed; empty when the document shows no breakdown"),
  withholding: z
    .object({
      ratePercent: z.number().describe("IRPF withholding (retención) rate, e.g. 15"),
      amount: z.number().describe("Withheld amount in euros, positive"),
    })
    .nullable(),
  total: z.number().nullable().describe("Total to pay, in euros"),
  expenseAccount: z
    .enum(expenseAccounts)
    .nullable()
    .describe("The expense account for what was bought; null when none fits clearly"),
});
export type ModelAnswer = z.infer<typeof modelAnswerSchema>;

/** The answer's JSON Schema, for the providers' structured outputs. */
export const modelAnswerJsonSchema = (() => {
  const { $schema: _, ...schema } = z.toJSONSchema(modelAnswerSchema);
  return schema as Record<string, unknown>;
})();

export const EXTRACTION_PROMPT = `You read received invoices and receipts for the bookkeeping of a self-employed worker in Spain.
Answer with the fields of the document exactly as printed. Never compute, guess or complete a value: if the document doesn't show it, use null.
- The supplier is whoever issued the document and gets paid, not its recipient (the worker's business).
- Amounts in euros as plain numbers with a dot for decimals: "1.234,56 €" is 1234.56. Keep the minus sign of credit notes (facturas rectificativas, abonos).
- Dates as YYYY-MM-DD. Spanish documents print them day first: 07/10/2026 is 2026-10-07.
- Rates as percentages: 21 for 21 %.
- vatLines: one entry per VAT rate in the breakdown. A ticket that only says "IVA incluido" without a base and a VAT amount has none.
- withholding: only an IRPF withholding (retención) printed on the document.
- concept: a short Spanish description of what was bought, such as "Fibra y móvil octubre" or "Comida de trabajo".
- expenseAccount: the one account of the Spanish chart of accounts that fits what was bought, judged from the supplier and the items. Use null rather than a loose fit.
${Object.entries(EXPENSE_ACCOUNTS)
  .map(([code, meaning]) => `  ${code}: ${meaning}`)
  .join("\n")}`;

const CODE_COUNTRIES = new Map(Object.entries(COUNTRY_CODES).map(([country, code]) => [code, country]));

/** Trimmed text without control characters, which a model may copy from a broken text layer and Postgres refuses. */
const text = (value: string | null) => value?.replace(/[\u0000-\u001F\u007F]/g, "").trim() ?? "";

/** An ISO date that exists, or null: models sometimes answer 2026-02-30 or the printed format. */
function isoDateOrNull(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : null;
}

/** 21 → 0.21, kept within 0–100 % so a misread rate stays a rate (the checks flag it). */
const percentToFraction = (percent: number | null) =>
  Math.min(1, Math.max(0, Math.round((percent ?? 0) * 100) / 10_000));

/** The model's answer as a draft for the purchase form. */
export function toDraft(answer: ModelAnswer): ExtractedPurchase {
  const countryCode = text(answer.supplier.countryCode).toUpperCase();
  const country = CODE_COUNTRIES.get(countryCode) ?? "";
  const withholding = answer.withholding;
  // Withholding is printed as a positive deduction; on a credit note it is refunded, like the base
  const sign = answer.vatLines.reduce((sum, line) => sum + line.base, 0) < 0 ? -1 : 1;
  return {
    kind: answer.documentType === "invoice" ? "invoice" : "ticket",
    supplier: {
      name: text(answer.supplier.name),
      taxId: storedTaxId(text(answer.supplier.taxId), country),
      address: text(answer.supplier.address),
      postalCode: text(answer.supplier.postalCode),
      city: text(answer.supplier.city),
      country,
    },
    number: text(answer.number),
    issuedOn: isoDateOrNull(answer.issueDate),
    dueOn: isoDateOrNull(answer.dueDate),
    concept: text(answer.concept),
    currency: text(answer.currency).toUpperCase() || "EUR",
    vatBreakdown: answer.vatLines.map((line) => ({
      rate: percentToFraction(line.ratePercent),
      base: eurosToCents(line.base),
      vat: eurosToCents(line.vat),
      surchargeRate: percentToFraction(line.surchargePercent),
      surcharge: eurosToCents(line.surcharge ?? 0),
    })),
    withholding:
      withholding && (withholding.ratePercent || withholding.amount)
        ? {
            rate: percentToFraction(withholding.ratePercent),
            amount: eurosToCents(sign * Math.abs(withholding.amount)),
          }
        : null,
    total: answer.total === null ? null : eurosToCents(answer.total),
    expenseType: answer.expenseAccount,
  };
}
