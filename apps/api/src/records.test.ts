import type { BankMovement, Expense, Product, PurchaseInvoice, SalesDocument } from "@cuentalibre/contracts";
import { newId, type Cents, type StockMovement } from "@cuentalibre/core";
import { describe, expect, it } from "vitest";
import { changes, client, document, errorCode, member, send, workspace } from "./test/sync";

const account = () =>
  ({ id: newId(), kind: "bank", name: "Cuenta principal", number: "ES91…1332", active: true }) as const;

const product = (fields: Partial<Product> = {}): Product => ({
  id: newId(),
  familyId: null,
  name: "Sesión de fotos",
  description: "",
  privateNotes: "",
  unit: null,
  tags: [],
  active: true,
  sku: "FOTO-1",
  supplierRef: "",
  price: 120.5,
  discount: 0,
  vatRate: 0.21,
  surchargeRate: 0,
  cost: null,
  costVatRate: 0.21,
  costSurchargeRate: 0,
  custom: ["", "", "", ""],
  stock: { allowWithoutStock: false, alarm: null },
  ...fields,
});

describe("plain records", () => {
  it("creates, updates and deletes tags", async () => {
    const ana = await member();
    const tag = { id: newId(), name: "Recurrente", color: "#1d4ed8" };
    expect((await send(ana, [{ type: "create", entity: "tags", data: tag }])).status).toBe(200);
    await send(ana, [{ type: "update", entity: "tags", id: tag.id, changes: { color: "#15803d" } }]);
    expect((await workspace(ana)).tags).toEqual([{ ...tag, color: "#15803d" }]);

    const { cursor } = await workspace(ana);
    await send(ana, [{ type: "delete", entity: "tags", id: tag.id }]);
    expect((await workspace(ana)).tags).toEqual([]);
    expect((await changes(ana, cursor)).changes).toEqual([{ op: "delete", entity: "tags", id: tag.id }]);
  });

  it("stores treasury accounts, payment methods, manual payments and bank movements", async () => {
    const ana = await member();
    const main = account();
    const method = {
      id: newId(),
      type: "transfer",
      name: "Transferencia",
      number: "",
      accountId: main.id,
      active: true,
    } as const;
    const payment = {
      id: newId(),
      date: "2026-10-01",
      amount: -50000 as Cents,
      paymentMethodId: method.id,
      description: "Ahorro",
    };
    const movement: BankMovement = {
      id: newId(),
      accountId: main.id,
      date: "2026-10-01",
      concept: "TRANSFERENCIA A AHORRO",
      reference: "",
      amount: -50000 as Cents,
      balance: null,
      source: "import",
      paymentKeys: [`manual:${payment.id}`],
    };
    const response = await send(ana, [
      { type: "create", entity: "treasuryAccounts", data: main },
      { type: "create", entity: "paymentMethods", data: method },
      { type: "create", entity: "manualPayments", data: payment },
      { type: "create", entity: "bankMovements", data: movement },
    ]);
    expect(response.status).toBe(200);
    const stored = await workspace(ana);
    expect(stored.treasuryAccounts).toEqual([main]);
    expect(stored.paymentMethods).toEqual([method]);
    expect(stored.manualPayments).toEqual([payment]);
    expect(stored.bankMovements).toEqual([movement]);

    // An account can't go while a method or a movement still names it
    const blocked = await send(ana, [{ type: "delete", entity: "treasuryAccounts", id: main.id }]);
    expect(blocked.status).toBe(409);
    expect(await errorCode(blocked)).toBe("in_use");
    const used = await send(ana, [{ type: "delete", entity: "paymentMethods", id: method.id }]);
    expect(await errorCode(used)).toBe("in_use");
    await send(ana, [
      { type: "delete", entity: "manualPayments", id: payment.id },
      { type: "delete", entity: "bankMovements", id: movement.id },
    ]);

    // Unlinking a method from its account before deleting the account
    await send(ana, [
      { type: "update", entity: "paymentMethods", id: method.id, changes: { accountId: null } },
      { type: "delete", entity: "treasuryAccounts", id: main.id },
    ]);
    expect((await workspace(ana)).paymentMethods).toEqual([{ ...method, accountId: null }]);
  });

  it("keep a payment method while a contact, an expense, a payment or the settings name it", async () => {
    const ana = await member();
    const method = {
      id: newId(),
      type: "transfer",
      name: "Transferencia",
      number: "",
      accountId: null,
      active: true,
    } as const;
    await send(ana, [{ type: "create", entity: "paymentMethods", data: method }]);
    const blockedBy = async () => {
      const response = await send(ana, [{ type: "delete", entity: "paymentMethods", id: method.id }]);
      expect(response.status).toBe(409);
      return ((await response.json()) as { error: { code: string; message: string } }).error;
    };

    const norte = client({ paymentMethodId: method.id });
    await send(ana, [{ type: "create", entity: "clients", data: norte }]);
    expect(await blockedBy()).toMatchObject({ code: "in_use", message: "Still named by contacts.paymentMethodId." });
    await send(ana, [{ type: "delete", entity: "clients", id: norte.id }]);

    const parking: Expense = {
      id: newId(),
      date: "2026-10-07",
      number: "",
      concept: "Parking",
      amount: 1250 as Cents,
      expenseType: "629",
      imputation: 100,
      supplierId: null,
      otherPayee: { name: "Aparcamiento Centro", taxId: "" },
      payment: { date: "2026-10-07", paymentMethodId: method.id },
      rental: false,
      privateNotes: "",
    };
    await send(ana, [{ type: "create", entity: "expenses", data: parking }]);
    expect((await blockedBy()).message).toBe("Still named by expenses.payment.");
    await send(ana, [{ type: "delete", entity: "expenses", id: parking.id }]);

    const brisa = client({ name: "Hosting Brisa S.L.", taxId: "B87654323" });
    const bill: PurchaseInvoice = {
      id: newId(),
      supplierId: brisa.id,
      number: "F-2026-118",
      issuedOn: "2026-10-02",
      bookedOn: "2026-10-03",
      dueOn: null,
      expenseType: "629",
      imputation: 100,
      vatImputation: null,
      withholding: "none",
      operationType: "national",
      operationOn: null,
      cashBasis: false,
      rental: false,
      lines: [{ id: newId(), concept: "Hosting anual", unitPrice: 100, quantity: 1, discount: 0, vatRate: 0.21 }],
      payments: [{ id: newId(), date: "2026-10-10", amount: 12100 as Cents, paymentMethodId: method.id }],
      privateNotes: "",
    };
    await send(ana, [
      { type: "create", entity: "suppliers", data: brisa },
      { type: "create", entity: "purchaseInvoices", data: bill },
    ]);
    expect((await blockedBy()).message).toBe("Still named by purchaseInvoices.payments.");
    await send(ana, [{ type: "delete", entity: "purchaseInvoices", id: bill.id }]);

    const sur = client({ name: "Sur S.L.", taxId: "B11111118" });
    await send(ana, [{ type: "create", entity: "clients", data: sur }]);
    const issued = await send(ana, [{ type: "issue", data: document(sur.id) }]);
    const { changes: written } = (await issued.json()) as { changes: { data: SalesDocument }[] };
    const invoice = written[0]!.data;
    const collection = { id: newId(), date: "2026-10-20", amount: 100 as Cents, paymentMethodId: method.id };
    await send(ana, [{ type: "update", entity: "salesDocuments", id: invoice.id, changes: { payments: [collection] } }]);
    expect((await blockedBy()).message).toBe("Still named by salesDocuments.payments.");
    await send(ana, [{ type: "update", entity: "salesDocuments", id: invoice.id, changes: { payments: [] } }]);

    await send(ana, [{ type: "saveSettings", section: "defaultPaymentMethod", data: method.id }]);
    expect((await blockedBy()).message).toBe("Still named by settings.defaultPaymentMethod.");
    // Moving the default off it in the same batch frees it
    const freed = await send(ana, [
      { type: "saveSettings", section: "defaultPaymentMethod", data: "" },
      { type: "delete", entity: "paymentMethods", id: method.id },
    ]);
    expect(freed.status).toBe(200);
    expect((await workspace(ana)).paymentMethods).toEqual([]);
  });

  it("only name the organization's own records, and not deleted ones", async () => {
    const ana = await member("Ana");
    const bea = await member("Bea");
    const beas = account();
    await send(bea, [{ type: "create", entity: "treasuryAccounts", data: beas }]);
    const method = {
      id: newId(),
      type: "card",
      name: "Tarjeta",
      number: "",
      accountId: beas.id,
      active: true,
    } as const;
    const response = await send(ana, [{ type: "create", entity: "paymentMethods", data: method }]);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_payment_method");

    const anas = account();
    await send(ana, [
      { type: "create", entity: "treasuryAccounts", data: anas },
      { type: "delete", entity: "treasuryAccounts", id: anas.id },
    ]);
    expect(
      (await send(ana, [{ type: "create", entity: "paymentMethods", data: { ...method, accountId: anas.id } }])).status,
    ).toBe(400);
  });

  it("stores the catalog, keeping the stock movements of deleted products", async () => {
    const ana = await member();
    const services = { id: newId(), name: "Servicios", parentId: null };
    const photos = { id: newId(), name: "Fotografía", parentId: services.id };
    const shoot = product({ familyId: photos.id, tags: [newId()] });
    const initial: StockMovement = {
      id: newId(),
      productId: shoot.id,
      quantity: 10,
      at: "2026-10-01T09:30",
      kind: "initial",
    };
    const closing: StockMovement = {
      id: newId(),
      productId: shoot.id,
      quantity: -10,
      at: "2026-10-18T19:29:05",
      kind: "deleted",
      comments: "Producto eliminado",
    };
    const response = await send(ana, [
      { type: "create", entity: "catalogFamilies", data: services },
      { type: "create", entity: "catalogFamilies", data: photos },
      { type: "create", entity: "products", data: shoot },
      { type: "create", entity: "stockMovements", data: initial },
      { type: "delete", entity: "products", id: shoot.id },
      { type: "create", entity: "stockMovements", data: closing },
    ]);
    expect(response.status).toBe(200);
    const stored = await workspace(ana);
    expect(stored.catalogFamilies).toEqual([services, photos]);
    expect(stored.products).toEqual([]);
    expect(stored.stockMovements).toEqual([initial, closing]);
  });

  it("keeps products' optional fields and clears them with null", async () => {
    const ana = await member();
    const shoot = product({ unit: "h", cost: 40.25, stock: null });
    await send(ana, [{ type: "create", entity: "products", data: shoot }]);
    expect((await workspace(ana)).products).toEqual([shoot]);
    await send(ana, [{ type: "update", entity: "products", id: shoot.id, changes: { unit: null, cost: null } }]);
    expect((await workspace(ana)).products).toEqual([{ ...shoot, unit: null, cost: null }]);
  });

  it("won't make a family its own ancestor", async () => {
    const ana = await member();
    const parent = { id: newId(), name: "Servicios", parentId: null };
    const child = { id: newId(), name: "Diseño web", parentId: parent.id };
    await send(ana, [
      { type: "create", entity: "catalogFamilies", data: parent },
      { type: "create", entity: "catalogFamilies", data: child },
    ]);
    const response = await send(ana, [
      { type: "update", entity: "catalogFamilies", id: parent.id, changes: { parentId: child.id } },
    ]);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_catalog_family");
  });

  it("rejects updates and deletes of records that don't exist", async () => {
    const ana = await member();
    expect((await send(ana, [{ type: "delete", entity: "products", id: newId() }])).status).toBe(404);
    expect((await send(ana, [{ type: "update", entity: "tags", id: newId(), changes: { name: "X" } }])).status).toBe(
      404,
    );
  });
});
