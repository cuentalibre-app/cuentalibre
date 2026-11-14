import { useMemo } from "react";
import { cents, partyKey, SPAIN, sumBy, WITHHOLDING_RATES, type PartyOperation } from "@cuentalibre/core";
import type { Contact, Expense, PurchaseInvoice, SalesDocument } from "@cuentalibre/contracts";
import { useContacts } from "@/features/contacts/contacts-store";
import { useExpenses } from "@/features/purchases/expenses-store";
import { PURCHASES_PATH, purchaseTotals } from "@/features/purchases/purchases-model";
import { EXPENSES_PATH } from "@/features/purchases/expenses-model";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { documentTotals, KINDS } from "@/features/sales/sales-model";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { useSettings } from "@/features/settings/settings-store";

/** Purchases of goods rather than services, as in the VAT returns. */
const GOODS_PURCHASES = new Set(["600", "602"]);
/** Sales of goods (merchandise and products) rather than services. */
const GOODS_SALES = new Set(["700"]);

/** Where a document of the withholding and third-party forms comes from, to list and link it. */
export interface PartyDocument {
  id: string;
  to: string;
  date: string;
  number: string;
  /** "Factura emitida", "Factura recibida", "Gasto". */
  kind: string;
  contactId: string;
  /** Name shown when the payee is not a saved contact. */
  payee?: string;
}

export interface PartyBooks {
  ops: PartyOperation[];
  documents: Map<string, PartyDocument>;
  contacts: Map<string, Contact>;
  /** "Clientes varios", as a party key: it and every contact with its tax ID are left out of form 347. */
  excludedFrom347: Set<string>;
}

const isAbroad = (contact: Contact | undefined) => Boolean(contact) && (contact!.country || SPAIN) !== SPAIN;

/** The contact's tax ID and country, which identify the party in forms 111 to 349. */
const identity = (contact: Contact | undefined) => ({ taxId: contact?.taxId, country: contact?.country });

function fromSale(doc: SalesDocument, contacts: Map<string, Contact>, cash: Set<string>): PartyOperation {
  const totals = documentTotals(doc);
  const total = cents(totals.base + totals.vat + totals.surcharge);
  return {
    id: doc.id,
    date: doc.issuedOn,
    side: "sale",
    contactId: doc.clientId,
    abroad: isAbroad(contacts.get(doc.clientId)),
    operation: doc.operationType,
    goods: GOODS_SALES.has(doc.incomeType),
    base: totals.base,
    total,
    withholding: totals.withholding,
    withholdingRate: WITHHOLDING_RATES[doc.withholding],
    rental: doc.rental,
    account: doc.incomeType,
    cadastralRef: doc.cadastralRef,
    rentalLocation: doc.rentalLocation,
    cash: sumBy(
      (doc.payments ?? []).filter((p) => cash.has(p.paymentMethodId)),
      (p) => p.amount,
    ),
    ...identity(contacts.get(doc.clientId)),
    rectifiesId: doc.rectifiesId,
  };
}

function fromPurchase(doc: PurchaseInvoice, contacts: Map<string, Contact>, cash: Set<string>): PartyOperation {
  const totals = purchaseTotals(doc);
  return {
    id: doc.id,
    date: doc.bookedOn,
    side: "purchase",
    contactId: doc.supplierId,
    abroad: isAbroad(contacts.get(doc.supplierId)),
    operation: doc.operationType,
    goods: GOODS_PURCHASES.has(doc.expenseType),
    base: totals.base,
    total: cents(totals.base + totals.vat + totals.surcharge),
    withholding: totals.withholding,
    withholdingRate: WITHHOLDING_RATES[doc.withholding],
    rental: doc.rental,
    account: doc.expenseType,
    cadastralRef: doc.cadastralRef,
    rentalLocation: doc.rentalLocation,
    cash: sumBy(
      doc.payments.filter((p) => cash.has(p.paymentMethodId)),
      (p) => p.amount,
    ),
    ...identity(contacts.get(doc.supplierId)),
    rectifiesId: doc.rectifiesId,
  };
}

/** Expenses carry no VAT nor withholding: they only count in form 347 and as rentals to check. */
function fromExpense(expense: Expense, contacts: Map<string, Contact>, cash: Set<string>): PartyOperation {
  return {
    id: expense.id,
    date: expense.date,
    side: "purchase",
    contactId: expense.supplierId ?? "",
    abroad: isAbroad(contacts.get(expense.supplierId ?? "")),
    operation: "national",
    goods: GOODS_PURCHASES.has(expense.expenseType),
    base: expense.amount,
    total: expense.amount,
    withholding: cents(0),
    withholdingRate: 0,
    rental: expense.rental,
    account: expense.expenseType,
    cadastralRef: expense.cadastralRef,
    rentalLocation: expense.rentalLocation,
    cash: cash.has(expense.payment?.paymentMethodId ?? "") ? expense.amount : cents(0),
    ...identity(contacts.get(expense.supplierId ?? "")),
  };
}

/** Issued invoices, received invoices and expenses with their contacts, for forms 111 to 349. */
export function usePartyBooks(): PartyBooks {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const clients = useContacts("client");
  const suppliers = useContacts("supplier");
  const { tax, paymentMethods } = useSettings();

  return useMemo(() => {
    const contacts = new Map([...clients, ...suppliers].map((c) => [c.id, c]));
    const cash = new Set(paymentMethods.filter((m) => m.type === "cash").map((m) => m.id));
    const issued = documents.filter((d) => d.kind === "invoice");
    const ops = [
      ...issued.map((d) => fromSale(d, contacts, cash)),
      ...purchases.map((p) => fromPurchase(p, contacts, cash)),
      ...expenses.map((e) => fromExpense(e, contacts, cash)),
    ];
    const index = new Map<string, PartyDocument>();
    for (const d of issued) {
      index.set(d.id, {
        id: d.id,
        to: `${KINDS.invoice.path}/${d.id}`,
        date: d.issuedOn,
        number: d.number ?? "",
        kind: "Factura emitida",
        contactId: d.clientId,
      });
    }
    for (const p of purchases) {
      index.set(p.id, {
        id: p.id,
        to: `${PURCHASES_PATH}/${p.id}`,
        date: p.bookedOn,
        number: p.number,
        kind: "Factura recibida",
        contactId: p.supplierId,
      });
    }
    for (const e of expenses) {
      index.set(e.id, {
        id: e.id,
        to: `${EXPENSES_PATH}/${e.id}`,
        date: e.date,
        number: e.number,
        kind: "Gasto",
        contactId: e.supplierId ?? "",
        payee: e.otherPayee?.name || e.concept,
      });
    }
    return {
      ops,
      documents: index,
      contacts,
      excludedFrom347: new Set(
        tax.variousClientsId ? [partyKey(tax.variousClientsId, contacts.get(tax.variousClientsId)?.taxId)] : [],
      ),
    };
  }, [documents, purchases, expenses, clients, suppliers, tax.variousClientsId, paymentMethods]);
}

/** Name of a contact, or of the payee of an expense paid to someone not saved. */
export function contactName(books: PartyBooks, contactId: string, fallback = "Sin contacto"): string {
  return books.contacts.get(contactId)?.name ?? fallback;
}
