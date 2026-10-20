import type { OperationType } from "./invoices";
import { isInPeriod } from "./ledger";
import { applyRate, cents, sumBy, sumCents, type Cents } from "./money";
import { periodKey, periodMonths, type Quarter } from "./period";
import type { PurchaseOperationType } from "./purchases";
import { GENERAL_VAT_RATE, IRPF_INSTALLMENT_RATE } from "./taxes";

/*
 * Tax returns of a self-employed worker under the general VAT regime and
 * simplified direct estimation, box by box, from the issued and received
 * invoices and the expenses without an invoice.
 *
 * Scope, as in Contasimple: one activity, accrual basis, no proration, no
 * equivalence surcharge detail, no supplementary returns. Boxes the books
 * can't fill (territorial splits…) are left at zero or taken as an input.
 * Returns already filed are taken as filed: later quarters start from their
 * boxes, not from what the books say now.
 */

/**
 * Box number (as printed on the form, "01", "0171"…) to its value: an amount in cents for money
 * boxes, a percentage for rate boxes and a count for the boxes that count people. The callers know
 * which is which, so the map stays a plain number record.
 */
export type Boxes = Record<string, number>;

export interface RateAmounts {
  /** VAT rate as a fraction: 0.21 is 21%. */
  rate: number;
  base: Cents;
  vat: Cents;
}

/** An issued invoice, as the returns see it. */
export interface TaxableSale {
  id: string;
  /** ISO date that decides the period. */
  date: string;
  operation: OperationType;
  /** Rectifying invoices go to the "modification of bases" boxes instead of their rate. */
  rectifying: boolean;
  /** Base and VAT per rate. */
  vatBreakdown: RateAmounts[];
  /** IRPF withheld by the client. */
  withholding: Cents;
  /** Property rental: its withholding goes to its own box in form 100. */
  rental: boolean;
  /** Income account (PGC group 7), for the profit and loss report: 705, or 752 for rentals, when missing. */
  account?: string;
}

/** A received invoice, as the returns see it. */
export interface TaxablePurchase {
  id: string;
  /** Booking date, which decides the period. */
  date: string;
  operation: PurchaseOperationType;
  creditNote: boolean;
  /** Goods rather than services: form 390 reports intra-EU acquisitions of each apart. */
  goods: boolean;
  /** Investment good: its VAT is deducted in the boxes for investment goods. */
  investment?: boolean;
  /**
   * Base and VAT per rate as invoiced. In intra-EU and reverse-charge purchases the supplier
   * charges no VAT and the buyer self-assesses it; lines at 0 % are taken at the general rate.
   */
  vatBreakdown: RateAmounts[];
  /** Share (0–1) of the VAT that can be deducted. */
  vatShare: number;
  /** Part of the base that counts as an expense for income tax. */
  expense: Cents;
  /** Expense account (PGC group 6), which decides its box in form 100. */
  account: string;
}

/** An expense without an invoice: it only counts for income tax. */
export interface TaxableExpense {
  id: string;
  date: string;
  /** Deductible amount. */
  expense: Cents;
  account: string;
}

export interface TaxBooks {
  sales: TaxableSale[];
  purchases: TaxablePurchase[];
  expenses: TaxableExpense[];
  /** Boxes of the returns already filed, which later quarters start from. */
  filed?: FiledReturns;
}

/** Forms whose filed boxes carry into later quarters. */
export type FiledForm = "303" | "130";

/** Boxes of filed returns by form and period key ("2026-T1"). */
export type FiledReturns = Partial<Record<FiledForm, Record<string, Boxes>>>;

/** Filed returns as boxes by form and period. `returns` go oldest first: a later version replaces an earlier one. */
export function filedReturnsOf(returns: readonly { form: FiledForm; period: string; boxes: Boxes }[]): FiledReturns {
  const filed: FiledReturns = {};
  for (const r of returns) filed[r.form] = { ...filed[r.form], [r.period]: r.boxes };
  return filed;
}

/** The boxes filed for a quarter, if its return was filed. */
export function filedBoxes(filed: FiledReturns | undefined, form: FiledForm, year: number, quarter: Quarter) {
  return filed?.[form]?.[periodKey({ year, quarter })];
}

const SELF_ASSESSED: PurchaseOperationType[] = ["intraEu", "reverseCharge"];

/** Integer key for a rate, so 0.1 and 0.10000000001 match. */
const rateKey = (rate: number) => Math.round(rate * 10_000);

function selfAssessed(purchase: TaxablePurchase): RateAmounts[] {
  if (!SELF_ASSESSED.includes(purchase.operation)) return purchase.vatBreakdown;
  return purchase.vatBreakdown.map((r) =>
    r.rate === 0 ? { rate: GENERAL_VAT_RATE, base: r.base, vat: applyRate(r.base, GENERAL_VAT_RATE) } : r,
  );
}

/** The deductible part of a purchase's VAT, per rate. Lines without VAT have nothing to deduct. */
function deductiblePart(purchase: TaxablePurchase): RateAmounts[] {
  return selfAssessed(purchase)
    .filter((r) => r.rate > 0)
    .map((r) => ({
      rate: r.rate,
      base: applyRate(r.base, purchase.vatShare),
      vat: applyRate(r.vat, purchase.vatShare),
    }));
}

const sumBases = (rates: RateAmounts[]) => sumBy(rates, (r) => r.base);
const sumVat = (rates: RateAmounts[]) => sumBy(rates, (r) => r.vat);

const inQuarter = (date: string, year: number, quarter: Quarter) => isInPeriod(date, { year, quarter });
const inYear = (date: string, year: number) => isInPeriod(date, { year, quarter: null });

function boxes() {
  const values: Boxes = {};
  const add = (box: string, amount: number) => {
    values[box] = (values[box] ?? 0) + amount;
  };
  /** Sum of money boxes. */
  const get = (...keys: string[]) => cents(keys.reduce((acc, k) => acc + (values[k] ?? 0), 0));
  return { values, add, get };
}

/* ───────────────────────── Form 303: quarterly VAT ───────────────────────── */

/** Output VAT boxes per rate (base, rate, VAT). Rates outside the form are reported as unmapped. */
const OUTPUT_303: Record<number, [string, string, string]> = {
  [rateKey(0)]: ["150", "151", "152"],
  [rateKey(0.04)]: ["01", "02", "03"],
  [rateKey(0.1)]: ["04", "05", "06"],
  [rateKey(0.21)]: ["07", "08", "09"],
};

/**
 * Rates the form prints on its equivalence surcharge rows (in percent). The books don't break the
 * surcharge down, so their amounts stay at zero; the rates withdrawn in 2025 (boxes 166 and 154,
 * and box 17 of the surcharge) print as zero too.
 */
const SURCHARGE_RATES_303: Record<string, number> = { "157": 1.75, "169": 0.5, "20": 1.4, "23": 5.2 };

export interface Model303 {
  year: number;
  quarter: Quarter;
  boxes: Boxes;
  /** Box 71: positive to pay, negative to offset (or refund in Q4). */
  result: Cents;
  /** Taxable base charged at rates the form no longer has (2 %, 5 %, historical ones). */
  unmappedBase: Cents;
  /** Whether any document fell in the quarter. */
  hasActivity: boolean;
}

/**
 * Form 303 for one quarter. `carry` is box 110: negative results of previous quarters still
 * pending to offset. It is applied up to the positive result of the quarter.
 */
export function model303(
  books: Pick<TaxBooks, "sales" | "purchases">,
  year: number,
  quarter: Quarter,
  carry = cents(0),
): Model303 {
  const b = boxes();
  let unmappedBase = cents(0);
  const sales = books.sales.filter((s) => inQuarter(s.date, year, quarter));
  const purchases = books.purchases.filter((p) => inQuarter(p.date, year, quarter));

  for (const [rate, [, rateBox]] of Object.entries(OUTPUT_303)) b.add(rateBox, Number(rate) / 100);
  for (const [box, rate] of Object.entries(SURCHARGE_RATES_303)) b.add(box, rate);

  for (const sale of sales) {
    const base = sumBases(sale.vatBreakdown);
    switch (sale.operation) {
      case "national":
        if (sale.rectifying) {
          b.add("14", base);
          b.add("15", sumVat(sale.vatBreakdown));
          break;
        }
        for (const r of sale.vatBreakdown) {
          const target = OUTPUT_303[rateKey(r.rate)];
          if (!target) {
            unmappedBase = cents(unmappedBase + r.base);
            continue;
          }
          b.add(target[0], r.base);
          b.add(target[2], r.vat);
        }
        break;
      case "intraEu":
        b.add("59", base);
        break;
      case "export":
        b.add("60", base);
        break;
      case "notSubject":
        b.add("120", base);
        break;
      case "reverseCharge":
        b.add("122", base);
        break;
      case "exempt":
        // Exempt operations without the right to deduct are only reported in form 390
        break;
    }
  }

  for (const purchase of purchases) {
    const charged = selfAssessed(purchase);
    const deductible = deductiblePart(purchase);
    const deduct = (baseBox: string, vatBox: string) => {
      b.add(baseBox, sumBases(deductible));
      b.add(vatBox, sumVat(deductible));
    };
    // Investment goods have their own deduction boxes, right after current goods and services
    const investment = Boolean(purchase.investment);
    switch (purchase.operation) {
      case "intraEu":
        b.add("10", sumBases(charged));
        b.add("11", sumVat(charged));
        if (investment) deduct("38", "39");
        else deduct("36", "37");
        break;
      case "reverseCharge":
        b.add("12", sumBases(charged));
        b.add("13", sumVat(charged));
        if (investment) deduct("30", "31");
        else deduct("28", "29");
        break;
      case "import":
        if (investment) deduct("34", "35");
        else deduct("32", "33");
        break;
      case "national":
        if (purchase.creditNote) deduct("40", "41");
        else if (investment) deduct("30", "31");
        else deduct("28", "29");
        break;
      case "exempt":
      case "notSubject":
        break;
    }
  }

  const accrued = b.get("152", "03", "06", "09", "11", "13", "15");
  const deductible = b.get("29", "31", "33", "35", "37", "39", "41");
  const result46 = cents(accrued - deductible);
  const pending = cents(Math.max(0, carry));
  const offset = cents(Math.min(pending, Math.max(0, result46)));
  const result = cents(result46 - offset);
  const v = b.values;
  v["27"] = accrued;
  v["45"] = deductible;
  v["46"] = result46;
  v["64"] = result46;
  v["65"] = 100;
  v["66"] = result46;
  v["110"] = pending;
  v["78"] = offset;
  v["87"] = cents(pending - offset);
  v["69"] = result;
  v["71"] = result;

  return {
    year,
    quarter,
    boxes: v,
    result,
    unmappedBase,
    hasActivity: sales.length > 0 || purchases.length > 0,
  };
}

function firstYear(books: Pick<TaxBooks, "sales" | "purchases">, fallback: number): number {
  const years = [...books.sales, ...books.purchases].map((d) => Number(d.date.slice(0, 4)));
  return Math.min(fallback, ...years);
}

/**
 * The four 303 returns of a year, chaining what is pending to offset from quarter to quarter
 * (and from earlier years, since the first one with documents). A negative Q4 is assumed to be
 * carried forward, which is what the form proposes by default. A quarter already filed passes
 * on what its filed return left pending.
 */
export function vatReturns(books: Pick<TaxBooks, "sales" | "purchases" | "filed">, year: number): Model303[] {
  const result: Model303[] = [];
  let carry = cents(0);
  for (let y = firstYear(books, year); y <= year; y++) {
    for (const quarter of [1, 2, 3, 4] as const) {
      const r = model303(books, y, quarter, carry);
      const boxes = filedBoxes(books.filed, "303", y, quarter) ?? r.boxes;
      carry = cents((boxes["87"] ?? 0) + Math.max(0, -(boxes["71"] ?? 0)));
      if (y === year) result.push(r);
    }
  }
  return result;
}

/** Box 110 of a quarter: what earlier returns left pending to offset. */
export function vatCarryInto(
  books: Pick<TaxBooks, "sales" | "purchases" | "filed">,
  year: number,
  quarter: Quarter,
): Cents {
  return cents(vatReturns(books, year)[quarter - 1]!.boxes["110"]!);
}

/* ───────────────────────── Form 390: yearly VAT summary ───────────────────────── */

type RateBoxes = Record<number, [base: string, vat: string]>;

const rates = (
  zero: [string, string] | null,
  four: [string, string],
  ten: [string, string],
  general: [string, string],
): RateBoxes => ({
  ...(zero && { [rateKey(0)]: zero }),
  [rateKey(0.04)]: four,
  [rateKey(0.1)]: ten,
  [rateKey(0.21)]: general,
});

const OUTPUT_390 = rates(["700", "701"], ["01", "02"], ["03", "04"], ["05", "06"]);
const INTRA_GOODS_390 = rates(["716", "717"], ["21", "22"], ["23", "24"], ["25", "26"]);
const INTRA_SERVICES_390 = rates(["720", "721"], ["545", "546"], ["547", "548"], ["551", "552"]);
const DEDUCT_DOMESTIC_390 = rates(null, ["190", "191"], ["603", "604"], ["605", "606"]);
const DEDUCT_IMPORTS_390 = rates(null, ["202", "203"], ["619", "620"], ["621", "622"]);
const DEDUCT_INTRA_GOODS_390 = rates(null, ["214", "215"], ["627", "628"], ["629", "630"]);
const DEDUCT_INTRA_SERVICES_390 = rates(null, ["587", "588"], ["635", "636"], ["637", "638"]);
const DEDUCT_DOMESTIC_INVESTMENT_390 = rates(null, ["196", "197"], ["611", "612"], ["613", "614"]);
const DEDUCT_IMPORTS_INVESTMENT_390 = rates(null, ["208", "209"], ["623", "624"], ["625", "626"]);
const DEDUCT_INTRA_INVESTMENT_390 = rates(null, ["220", "221"], ["631", "632"], ["633", "634"]);

/** Rate printed next to each pair of boxes of form 390, for display. */
export const RATE_BOXES_390 = {
  output: OUTPUT_390,
  intraGoods: INTRA_GOODS_390,
  intraServices: INTRA_SERVICES_390,
  deductDomestic: DEDUCT_DOMESTIC_390,
  deductImports: DEDUCT_IMPORTS_390,
  deductIntraGoods: DEDUCT_INTRA_GOODS_390,
  deductIntraServices: DEDUCT_INTRA_SERVICES_390,
  deductDomesticInvestment: DEDUCT_DOMESTIC_INVESTMENT_390,
  deductImportsInvestment: DEDUCT_IMPORTS_INVESTMENT_390,
  deductIntraInvestment: DEDUCT_INTRA_INVESTMENT_390,
};

export interface Model390 {
  year: number;
  boxes: Boxes;
  /** Box 86: yearly result. Informative: what is paid are the quarterly 303s. */
  result: Cents;
  /** Results (box 71) of the year's four 303 returns. */
  quarters: [Cents, Cents, Cents, Cents];
  unmappedBase: Cents;
  hasActivity: boolean;
}

/**
 * Form 390 for a year. Box 85 is what was pending to offset when the year started, and the
 * results of section 9 come from the chained 303 returns.
 */
export function model390(books: Pick<TaxBooks, "sales" | "purchases">, year: number): Model390 {
  const b = boxes();
  let unmappedBase = cents(0);
  const sales = books.sales.filter((s) => inYear(s.date, year));
  const purchases = books.purchases.filter((p) => inYear(p.date, year));

  const byRate = (table: RateBoxes, amounts: RateAmounts[]) => {
    for (const r of amounts) {
      const target = table[rateKey(r.rate)];
      if (!target) {
        unmappedBase = cents(unmappedBase + r.base);
        continue;
      }
      b.add(target[0], r.base);
      b.add(target[1], r.vat);
    }
  };

  for (const sale of sales) {
    const base = sumBases(sale.vatBreakdown);
    switch (sale.operation) {
      case "national":
        b.add("99", base);
        if (sale.rectifying) {
          b.add("29", base);
          b.add("30", sumVat(sale.vatBreakdown));
        } else byRate(OUTPUT_390, sale.vatBreakdown);
        break;
      case "intraEu":
        b.add("103", base);
        break;
      case "export":
        b.add("104", base);
        break;
      case "exempt":
        b.add("105", base);
        break;
      case "notSubject":
        b.add("110", base);
        break;
      case "reverseCharge":
        b.add("125", base);
        break;
    }
  }

  for (const purchase of purchases) {
    const charged = selfAssessed(purchase);
    const deductible = deductiblePart(purchase);
    const investment = Boolean(purchase.investment);
    const domestic = investment ? DEDUCT_DOMESTIC_INVESTMENT_390 : DEDUCT_DOMESTIC_390;
    switch (purchase.operation) {
      case "intraEu":
        byRate(purchase.goods ? INTRA_GOODS_390 : INTRA_SERVICES_390, charged);
        byRate(
          investment
            ? DEDUCT_INTRA_INVESTMENT_390
            : purchase.goods
              ? DEDUCT_INTRA_GOODS_390
              : DEDUCT_INTRA_SERVICES_390,
          deductible,
        );
        break;
      case "reverseCharge":
        b.add("27", sumBases(charged));
        b.add("28", sumVat(charged));
        byRate(domestic, deductible);
        break;
      case "import":
        byRate(investment ? DEDUCT_IMPORTS_INVESTMENT_390 : DEDUCT_IMPORTS_390, deductible);
        break;
      case "national":
        if (purchase.creditNote) {
          b.add("639", sumBases(deductible));
          b.add("62", sumVat(deductible));
        } else byRate(domestic, deductible);
        break;
      case "exempt":
      case "notSubject":
        break;
    }
  }

  const pairs = (table: RateBoxes) => Object.values(table);
  const outputPairs = [
    ...pairs(OUTPUT_390),
    ...pairs(INTRA_GOODS_390),
    ...pairs(INTRA_SERVICES_390),
    ["27", "28"],
    ["29", "30"],
  ];
  const deductPairs = [
    ...pairs(DEDUCT_DOMESTIC_390),
    ...pairs(DEDUCT_IMPORTS_390),
    ...pairs(DEDUCT_INTRA_GOODS_390),
    ...pairs(DEDUCT_INTRA_SERVICES_390),
    ...pairs(DEDUCT_DOMESTIC_INVESTMENT_390),
    ...pairs(DEDUCT_IMPORTS_INVESTMENT_390),
    ...pairs(DEDUCT_INTRA_INVESTMENT_390),
    ["639", "62"],
  ];
  const outputVat = b.get(...outputPairs.map((p) => p[1]!));
  const deductibleVat = b.get(...deductPairs.map((p) => p[1]!));
  const result84 = cents(outputVat - deductibleVat);
  const quarterly = vatReturns(books, year);
  const pendingAtStart = cents(quarterly[0]!.boxes["110"]!);
  const result = cents(result84 - pendingAtStart);
  const quarters = quarterly.map((q) => q.result) as Model390["quarters"];

  const v = b.values;
  v["33"] = b.get(...outputPairs.map((p) => p[0]!));
  v["34"] = outputVat;
  v["47"] = outputVat;
  v["64"] = deductibleVat;
  v["65"] = result84;
  v["84"] = result84;
  v["85"] = pendingAtStart;
  v["86"] = result;
  v["95"] = sumCents(quarters.filter((r) => r > 0));
  v["97"] = cents(Math.max(0, -quarters[3]));
  v["108"] = b.get("99", "653", "103", "104", "105", "110", "125");

  return {
    year,
    boxes: v,
    result,
    quarters,
    unmappedBase,
    hasActivity: sales.length > 0 || purchases.length > 0,
  };
}

/* ───────────────────────── Income tax: forms 130 and 100 ───────────────────────── */

/** Annual cap of the hard-to-justify expenses in simplified direct estimation: 2.000 €. */
export const HARD_TO_JUSTIFY_CAP = cents(200_000);

/** Share of the net income deductible as hard-to-justify expenses: 7 % in 2023, 5 % otherwise. */
export function hardToJustifyRate(year: number): number {
  return year === 2023 ? 0.07 : 0.05;
}

/** Hard-to-justify expenses on a net income before them; nothing when it isn't positive. */
export function hardToJustify(netBefore: Cents, year: number): Cents {
  return cents(Math.min(HARD_TO_JUSTIFY_CAP, applyRate(cents(Math.max(0, netBefore)), hardToJustifyRate(year))));
}

/**
 * Quarterly reduction of form 130 (art. 110.3.c RIRPF) for low incomes, from the previous
 * year's net income from the activity: 100 € up to 9.000 €, then 25 € less per 1.000 €.
 */
export function installmentReduction(previousYearNetIncome: Cents | null): Cents {
  if (previousYearNetIncome === null) return cents(0);
  if (previousYearNetIncome <= 900_000) return cents(10_000);
  if (previousYearNetIncome <= 1_000_000) return cents(7_500);
  if (previousYearNetIncome <= 1_100_000) return cents(5_000);
  if (previousYearNetIncome <= 1_200_000) return cents(2_500);
  return cents(0);
}

export interface IncomeTaxOptions {
  /** Simplified direct estimation: adds the hard-to-justify expenses. */
  simplified: boolean;
}

interface IncomeTotals {
  income: Cents;
  expenses: Cents;
  withholdings: Cents;
  rentalWithholdings: Cents;
}

function incomeTotals(books: TaxBooks, matches: (date: string) => boolean): IncomeTotals {
  const sales = books.sales.filter((s) => matches(s.date));
  return {
    income: sumBy(sales, (s) => sumBases(s.vatBreakdown)),
    expenses: cents(
      sumBy(
        books.purchases.filter((p) => matches(p.date)),
        (p) => p.expense,
      ) +
        sumBy(
          books.expenses.filter((e) => matches(e.date)),
          (e) => e.expense,
        ),
    ),
    withholdings: sumBy(
      sales.filter((s) => !s.rental),
      (s) => s.withholding,
    ),
    rentalWithholdings: sumBy(
      sales.filter((s) => s.rental),
      (s) => s.withholding,
    ),
  };
}

export interface Model130 {
  year: number;
  quarter: Quarter;
  boxes: Boxes;
  /** Box 19: positive to pay; zero or negative is a "negative" return with nothing to pay. */
  result: Cents;
  /** Hard-to-justify expenses included in box 02. */
  hardToJustify: Cents;
  hasActivity: boolean;
}

export interface Model130Inputs {
  /** Box 13: reduction for low incomes. Defaults to none. */
  reduction?: Cents;
  /** Box 15: negative results of earlier quarters of the year still to deduct. */
  negativeCarry?: Cents;
  /** Box 16: deduction for the mortgage of the main home (only old loans). */
  mortgage?: Cents;
}

/**
 * Form 130 for one quarter. Figures accumulate from January; box 05 subtracts the positive
 * installments of the year's earlier quarters (`previous`, box 07 of each). The reduction of
 * box 13 is limited to the positive installment, so it never makes the result negative.
 */
export function model130(
  books: TaxBooks,
  year: number,
  quarter: Quarter,
  options: IncomeTaxOptions,
  previous: Cents[] = [],
  inputs: Model130Inputs = {},
): Model130 {
  const lastMonth = periodMonths({ year, quarter })[2]!;
  const ytd = incomeTotals(books, (date) => inYear(date, year) && Number(date.slice(5, 7)) - 1 <= lastMonth);
  const extra = options.simplified ? hardToJustify(cents(ytd.income - ytd.expenses), year) : cents(0);

  const expenses = cents(ytd.expenses + extra);
  const net = cents(ytd.income - expenses);
  const installment = net > 0 ? applyRate(net, IRPF_INSTALLMENT_RATE) : cents(0);
  const paid = sumCents(previous.filter((p) => p > 0));
  const withheld = cents(ytd.withholdings + ytd.rentalWithholdings);
  const before = cents(installment - paid - withheld);
  const reduction = cents(Math.min(inputs.reduction ?? 0, Math.max(0, before)));
  const afterReduction = cents(before - reduction);
  const negativeCarry = cents(Math.min(inputs.negativeCarry ?? 0, Math.max(0, afterReduction)));
  const mortgage = cents(Math.min(inputs.mortgage ?? 0, Math.max(0, afterReduction - negativeCarry)));
  const result = cents(afterReduction - negativeCarry - mortgage);

  const v: Boxes = {};
  v["01"] = ytd.income;
  v["02"] = expenses;
  v["03"] = net;
  v["04"] = installment;
  v["05"] = paid;
  v["06"] = withheld;
  v["07"] = before;
  v["12"] = before;
  v["13"] = reduction;
  v["14"] = afterReduction;
  v["15"] = negativeCarry;
  v["16"] = mortgage;
  v["17"] = result;
  v["19"] = result;

  const inQ = (d: string) => inQuarter(d, year, quarter);
  return {
    year,
    quarter,
    boxes: v,
    result,
    hardToJustify: extra,
    hasActivity:
      books.sales.some((s) => inQ(s.date)) ||
      books.purchases.some((p) => inQ(p.date)) ||
      books.expenses.some((e) => inQ(e.date)),
  };
}

/**
 * The installments (box 07) of the quarters of the year before `quarter`, which its box 05
 * subtracts: as filed for the quarters already filed, as computed (`returns`) for the rest.
 */
export function earlierInstallments(
  books: Pick<TaxBooks, "filed">,
  returns: Model130[],
  year: number,
  quarter: Quarter,
): Cents[] {
  return returns
    .slice(0, quarter - 1)
    .map((r) => cents((filedBoxes(books.filed, "130", year, r.quarter) ?? r.boxes)["07"] ?? 0));
}

/**
 * The four 130 returns of a year. The reduction of box 13 is optional, so it is left at zero:
 * the taxpayer enters it if they want to pay less in advance.
 */
export function incomeTaxReturns(books: TaxBooks, year: number, options: IncomeTaxOptions): Model130[] {
  const result: Model130[] = [];
  for (const quarter of [1, 2, 3, 4] as const) {
    result.push(model130(books, year, quarter, options, earlierInstallments(books, result, year, quarter)));
  }
  return result;
}

/** Box of section D1 of form 100 for each expense account; anything else is "other external services". */
const EXPENSE_BOX_100: Record<string, string> = {
  "600": "0181",
  "602": "0181",
  "640": "0184",
  "642": "0185",
  "6421": "0185",
  "6422": "0186",
  "641": "0187",
  "649": "0190",
  "6295": "0191",
  "621": "0192",
  "622": "0193",
  "628": "0194",
  "6291": "0194",
  "623": "0199",
  "6231": "0199",
  "625": "0200",
  "660": "0203",
  "662": "0203",
  "663": "0203",
  "631": "0206",
  "681": "0208",
  "682": "0208",
  "680": "0227",
};

/** Expense boxes of section D1, in the order the form lists them. */
export const EXPENSE_BOXES_100 = [
  "0181",
  "0182",
  "0183",
  "0184",
  "0185",
  "0186",
  "0187",
  "0188",
  "0189",
  "0190",
  "0191",
  "0192",
  "0193",
  "0194",
  "0198",
  "0199",
  "0200",
  "0202",
  "0203",
  "0205",
  "0206",
  "0208",
  "0227",
  "0214",
  "0215",
  "0216",
  "0217",
] as const;

export function expenseBox100(account: string): string {
  return EXPENSE_BOX_100[account] ?? "0202";
}

export interface Model100 {
  year: number;
  boxes: Boxes;
  /** Box 0224: net income from the activity. */
  netIncome: Cents;
  hasActivity: boolean;
}

/**
 * The activity section (D1) of the yearly income tax return, plus the withholdings and the
 * installments paid with form 130 (`installments`, the year's box 19 results).
 */
export function model100(
  books: TaxBooks,
  year: number,
  options: IncomeTaxOptions,
  installments: Cents[] = [],
): Model100 {
  const b = boxes();
  const matches = (date: string) => inYear(date, year);
  const totals = incomeTotals(books, matches);

  for (const box of EXPENSE_BOXES_100) b.add(box, 0);
  for (const p of books.purchases.filter((p) => matches(p.date))) b.add(expenseBox100(p.account), p.expense);
  for (const e of books.expenses.filter((e) => matches(e.date))) b.add(expenseBox100(e.account), e.expense);

  const expenses = b.get(...EXPENSE_BOXES_100);
  let deductible = expenses;
  const v = b.values;
  v["0171"] = totals.income;
  v["0180"] = totals.income;
  v["0218"] = expenses;
  if (options.simplified) {
    const netBefore = cents(totals.income - expenses);
    const extra = hardToJustify(netBefore, year);
    deductible = cents(expenses + extra);
    v["0221"] = netBefore;
    v["0222"] = extra;
    v["0223"] = deductible;
  } else {
    v["0219"] = 0;
    v["0220"] = expenses;
  }
  const netIncome = cents(totals.income - deductible);
  v["0224"] = netIncome;
  v["0225"] = 0;
  v["0226"] = netIncome;
  v["0598"] = totals.rentalWithholdings;
  v["0599"] = totals.withholdings;
  v["0604"] = sumCents(installments.filter((i) => i > 0));

  return {
    year,
    boxes: v,
    netIncome,
    hasActivity: [...books.sales, ...books.purchases, ...books.expenses].some((d) => matches(d.date)),
  };
}

/** Whether there are books for a year, to tell "no data" from a real zero. */
export function hasBooks(books: TaxBooks, year: number): boolean {
  return [...books.sales, ...books.purchases, ...books.expenses].some((d) => inYear(d.date, year));
}

/**
 * Income tax returns of a year, with the reduction of box 13 that the previous year's net income
 * would allow, when there are books for it. It is only suggested: the returns leave it at zero.
 */
export function incomeTaxYear(books: TaxBooks, year: number, options: IncomeTaxOptions) {
  const previousNet = hasBooks(books, year - 1) ? model100(books, year - 1, options).netIncome : null;
  const quarters = incomeTaxReturns(books, year, options);
  const annual = model100(
    books,
    year,
    options,
    quarters.map((q) => q.result),
  );
  return { quarters, annual, previousNet, suggestedReduction: installmentReduction(previousNet) };
}
