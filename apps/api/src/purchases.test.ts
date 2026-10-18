import type { Expense, PurchaseInvoice } from "@fiscalia/contracts";
import type { Cents } from "@fiscalia/core";
import { newId } from "@fiscalia/core";
import { describe, expect, it } from "vitest";
import { changes, client, errorCode, member, send, workspace } from "./test/sync";

const invoice = (supplierId: string, fields: Partial<PurchaseInvoice> = {}): PurchaseInvoice => ({
  id: newId(),
  supplierId,
  number: "F-2026-118",
  issuedOn: "2026-10-02",
  bookedOn: "2026-10-03",
  dueOn: "2026-11-02",
  expenseType: "629",
  imputation: 100,
  vatImputation: null,
  withholding: "none",
  operationType: "national",
  operationOn: null,
  cashBasis: false,
  rental: false,
  lines: [{ id: newId(), concept: "Hosting anual", unitPrice: 120.5, quantity: 1, discount: 0, vatRate: 0.21 }],
  payments: [],
  privateNotes: "",
  ...fields,
});

const expense = (fields: Partial<Expense> = {}): Expense => ({
  id: newId(),
  date: "2026-10-07",
  number: "",
  concept: "Parking",
  amount: 1250 as Cents,
  expenseType: "629",
  imputation: 100,
  supplierId: null,
  otherPayee: { name: "Aparcamiento Centro", taxId: "" },
  payment: { date: "2026-10-07", paymentMethodId: "card" },
  rental: false,
  privateNotes: "",
  ...fields,
});

/** A member with one supplier. */
async function buyer() {
  const ana = await member();
  const brisa = client({ name: "Hosting Brisa S.L.", taxId: "B87654323" });
  expect((await send(ana, [{ type: "create", entity: "suppliers", data: brisa }])).status).toBe(200);
  return Object.assign(ana, { brisa });
}

describe("received invoices", () => {
  it("creates, updates and deletes them with their lines and payments", async () => {
    const ana = await buyer();
    const bill = invoice(ana.brisa.id, { asset: undefined, tags: ["t1"] });
    expect((await send(ana, [{ type: "create", entity: "purchaseInvoices", data: bill }])).status).toBe(200);
    expect((await workspace(ana)).purchaseInvoices).toEqual([bill]);

    const payments = [{ id: newId(), date: "2026-10-10", amount: 14581 as Cents, paymentMethodId: "bank1" }];
    const asset = {
      category: "itEquipment" as const,
      condition: "new" as const,
      method: "rate" as const,
      value: 25,
    };
    const response = await send(ana, [
      { type: "update", entity: "purchaseInvoices", id: bill.id, changes: { payments, asset, dueOn: null } },
    ]);
    expect(response.status).toBe(200);
    expect((await workspace(ana)).purchaseInvoices).toEqual([{ ...bill, payments, asset, dueOn: null }]);

    expect((await send(ana, [{ type: "delete", entity: "purchaseInvoices", id: bill.id }])).status).toBe(200);
    expect((await workspace(ana)).purchaseInvoices).toEqual([]);
    const feed = await changes(ana, 0);
    expect(feed.changes.at(-1)).toEqual({ op: "delete", entity: "purchaseInvoices", id: bill.id });
  });

  it("needs a supplier of the organization", async () => {
    const ana = await buyer();
    const norte = client();
    await send(ana, [{ type: "create", entity: "clients", data: norte }]);
    for (const supplierId of [newId(), norte.id]) {
      const response = await send(ana, [{ type: "create", entity: "purchaseInvoices", data: invoice(supplierId) }]);
      expect(response.status).toBe(400);
      expect(await errorCode(response)).toBe("invalid_invoice");
    }
  });

  it("checks that a credit note corrects an invoice of the organization", async () => {
    const ana = await buyer();
    const other = await buyer();
    const original = invoice(other.brisa.id);
    await send(other, [{ type: "create", entity: "purchaseInvoices", data: original }]);
    const credit = invoice(ana.brisa.id, { rectifiesId: original.id, number: "A-1" });
    const response = await send(ana, [{ type: "create", entity: "purchaseInvoices", data: credit }]);
    expect(response.status).toBe(400);
  });

  it("only takes payments, tags, attachments and notes while their quarter is closed", async () => {
    const ana = await buyer();
    const bill = invoice(ana.brisa.id);
    await send(ana, [
      { type: "create", entity: "purchaseInvoices", data: bill },
      { type: "closeQuarter", period: "2026-T4", closedOn: "2026-12-31" },
    ]);

    const payments = [{ id: newId(), date: "2027-01-10", amount: 14581 as Cents, paymentMethodId: "bank1" }];
    const allowed = await send(ana, [
      { type: "update", entity: "purchaseInvoices", id: bill.id, changes: { payments, privateNotes: "Pagada" } },
    ]);
    expect(allowed.status).toBe(200);

    for (const command of [
      { type: "update", entity: "purchaseInvoices", id: bill.id, changes: { imputation: 50 } },
      { type: "update", entity: "purchaseInvoices", id: bill.id, changes: { bookedOn: "2027-01-05" } },
      { type: "delete", entity: "purchaseInvoices", id: bill.id },
      { type: "create", entity: "purchaseInvoices", data: invoice(ana.brisa.id) },
    ] as const) {
      const response = await send(ana, [command]);
      expect(response.status).toBe(409);
      expect(await errorCode(response)).toBe("quarter_closed");
    }

    // Booking a later invoice into an open quarter, or sending a field unchanged, is fine
    const later = invoice(ana.brisa.id, { bookedOn: "2027-01-05" });
    expect((await send(ana, [{ type: "create", entity: "purchaseInvoices", data: later }])).status).toBe(200);
    const same = await send(ana, [
      { type: "update", entity: "purchaseInvoices", id: bill.id, changes: { imputation: 100 } },
    ]);
    expect(same.status).toBe(200);

    // Nor can an open one move into the closed quarter
    const moved = await send(ana, [
      { type: "update", entity: "purchaseInvoices", id: later.id, changes: { bookedOn: "2026-12-30" } },
    ]);
    expect(await errorCode(moved)).toBe("quarter_closed");
  });

  it("can't be read or changed from another organization", async () => {
    const ana = await buyer();
    const bill = invoice(ana.brisa.id);
    await send(ana, [{ type: "create", entity: "purchaseInvoices", data: bill }]);
    const eve = await buyer();
    expect((await workspace(eve)).purchaseInvoices).toEqual([]);
    const response = await send(eve, [{ type: "delete", entity: "purchaseInvoices", id: bill.id }]);
    expect(response.status).toBe(404);
  });
});

describe("expenses", () => {
  it("creates, updates and deletes them", async () => {
    const ana = await buyer();
    const parking = expense();
    expect((await send(ana, [{ type: "create", entity: "expenses", data: parking }])).status).toBe(200);
    expect((await workspace(ana)).expenses).toEqual([parking]);

    const changesSent = { supplierId: ana.brisa.id, otherPayee: null, payment: null, cadastralRef: "1234" };
    const response = await send(ana, [{ type: "update", entity: "expenses", id: parking.id, changes: changesSent }]);
    expect(response.status).toBe(200);
    const { otherPayee: _, ...rest } = parking;
    expect((await workspace(ana)).expenses).toEqual([
      { ...rest, supplierId: ana.brisa.id, payment: null, cadastralRef: "1234" },
    ]);

    expect((await send(ana, [{ type: "delete", entity: "expenses", id: parking.id }])).status).toBe(200);
    expect((await workspace(ana)).expenses).toEqual([]);
  });

  it("rejects a supplier from elsewhere", async () => {
    const ana = await buyer();
    const eve = await buyer();
    const response = await send(ana, [
      { type: "create", entity: "expenses", data: expense({ supplierId: eve.brisa.id }) },
    ]);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_expense");
  });

  it("only takes its payment, tags, attachments and notes while its quarter is closed", async () => {
    const ana = await buyer();
    const parking = expense({ payment: null });
    await send(ana, [
      { type: "create", entity: "expenses", data: parking },
      { type: "closeQuarter", period: "2026-T4", closedOn: "2026-12-31" },
    ]);
    const paid = await send(ana, [
      {
        type: "update",
        entity: "expenses",
        id: parking.id,
        changes: { payment: { date: "2027-01-02", paymentMethodId: "card" } },
      },
    ]);
    expect(paid.status).toBe(200);
    const changed = await send(ana, [{ type: "update", entity: "expenses", id: parking.id, changes: { amount: 999 } }]);
    expect(await errorCode(changed)).toBe("quarter_closed");
    const deleted = await send(ana, [{ type: "delete", entity: "expenses", id: parking.id }]);
    expect(await errorCode(deleted)).toBe("quarter_closed");
  });
});
