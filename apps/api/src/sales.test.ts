import type { SalesDocument } from "@fiscalia/contracts";
import { newId, type Cents } from "@fiscalia/core";
import { describe, expect, it } from "vitest";
import type { Client } from "./test/harness";
import { changes, client, document, errorCode, line, member, send, workspace } from "./test/sync";

/** A member with one client, ready to invoice. */
async function seller() {
  const ana = await member();
  const norte = client({ address: "Calle Mayor 1", city: "Bilbao" });
  expect((await send(ana, [{ type: "create", entity: "clients", data: norte }])).status).toBe(200);
  return Object.assign(ana, { norte });
}

async function issue(user: Client, data: SalesDocument, number?: string) {
  return send(user, [{ type: "issue", data, ...(number && { number }) }]);
}

async function issued(user: Client, data: SalesDocument) {
  const response = await issue(user, data);
  expect(response.status).toBe(200);
  const { changes } = (await response.json()) as { changes: { data: SalesDocument }[] };
  return changes[0]!.data;
}

async function salesDocuments(user: Client) {
  return (await workspace(user)).salesDocuments;
}

describe("sales documents", () => {
  it("creates, updates and deletes drafts, quotes and delivery notes", async () => {
    const ana = await seller();
    const quote = document(ana.norte.id, { kind: "quote", number: "P-2026-0001", status: "created" });
    expect((await send(ana, [{ type: "create", entity: "salesDocuments", data: quote }])).status).toBe(200);
    expect(await salesDocuments(ana)).toEqual([quote]);

    const lines = [line({ concept: "Logo", unitPrice: 300.125, quantity: 2, discount: 0.075 }), line()];
    const updated = await send(ana, [
      { type: "update", entity: "salesDocuments", id: quote.id, changes: { status: "sent", lines } },
    ]);
    expect(updated.status).toBe(200);
    expect(await salesDocuments(ana)).toEqual([{ ...quote, status: "sent", lines }]);

    expect((await send(ana, [{ type: "delete", entity: "salesDocuments", id: quote.id }])).status).toBe(200);
    expect(await salesDocuments(ana)).toEqual([]);
  });

  it("keeps drafts without a client", async () => {
    const ana = await seller();
    const draft = document("");
    expect((await send(ana, [{ type: "create", entity: "salesDocuments", data: draft }])).status).toBe(200);
    expect(await salesDocuments(ana)).toEqual([draft]);
  });

  it("clears an optional field with null and keeps null in a nullable one", async () => {
    const ana = await seller();
    const draft = document(ana.norte.id, { cadastralRef: "1234" });
    await send(ana, [{ type: "create", entity: "salesDocuments", data: draft }]);
    const response = await send(ana, [
      { type: "update", entity: "salesDocuments", id: draft.id, changes: { dueOn: null, cadastralRef: null } },
    ]);
    expect(response.status).toBe(200);
    const { cadastralRef: _, ...rest } = draft;
    expect(await salesDocuments(ana)).toEqual([{ ...rest, dueOn: null }]);
  });

  it("only takes the organization's own clients", async () => {
    const ana = await seller();
    const luis = await seller();
    const response = await send(ana, [{ type: "create", entity: "salesDocuments", data: document(luis.norte.id) }]);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_document");
  });

  it("doesn't create invoices directly", async () => {
    const ana = await seller();
    const invoice = document(ana.norte.id, { kind: "invoice", number: "2026-0001" });
    const response = await send(ana, [{ type: "create", entity: "salesDocuments", data: invoice }]);
    expect(response.status).toBe(400);
  });
});

describe("issuing invoices", () => {
  it("numbers invoices in sequence and freezes the client and totals", async () => {
    const ana = await seller();
    const first = await issued(ana, document(ana.norte.id, { number: null }));
    expect(first).toMatchObject({
      kind: "invoice",
      number: "2026-0001",
      status: "pending",
      issued: {
        client: { name: "Estudio Norte S.L.", taxId: "B12345674", address: "Calle Mayor 1", city: "Bilbao" },
        totals: { base: 100_000, vat: 21_000, withholding: 15_000, total: 106_000 },
      },
    });
    const second = await issued(ana, document(ana.norte.id, { issuedOn: "2026-10-06" }));
    expect(second.number).toBe("2026-0002");

    // Editing the client later doesn't change the invoice
    await send(ana, [{ type: "update", entity: "clients", id: ana.norte.id, changes: { name: "Norte Estudio S.L." } }]);
    expect((await salesDocuments(ana)).find((doc) => doc.id === first.id)?.issued?.client.name).toBe(
      "Estudio Norte S.L.",
    );
  });

  it("issues a draft in place", async () => {
    const ana = await seller();
    const draft = document(ana.norte.id);
    await send(ana, [{ type: "create", entity: "salesDocuments", data: draft }]);
    const invoice = await issued(ana, { ...draft, kind: "invoice" });
    expect(invoice).toMatchObject({ id: draft.id, kind: "invoice", number: "2026-0001" });
    expect(await salesDocuments(ana)).toHaveLength(1);
  });

  it("ignores the number the app forecast", async () => {
    const ana = await seller();
    const invoice = await issued(ana, document(ana.norte.id, { kind: "invoice", number: "2026-0099" }));
    expect(invoice.number).toBe("2026-0001");
  });

  it("won't issue an invoice dated before the last one of its series", async () => {
    const ana = await seller();
    await issued(ana, document(ana.norte.id, { issuedOn: "2026-10-10" }));
    const response = await issue(ana, document(ana.norte.id, { issuedOn: "2026-10-09" }));
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("date_out_of_order");
    // A new year starts a new series
    expect((await issued(ana, document(ana.norte.id, { issuedOn: "2027-01-02" }))).number).toBe("2027-0001");
  });

  it("keeps the number of an imported invoice when it's free", async () => {
    const ana = await seller();
    expect((await (await issue(ana, document(ana.norte.id), "2026-0046")).json()) as unknown).toMatchObject({
      changes: [{ data: { number: "2026-0046" } }],
    });
    expect((await issued(ana, document(ana.norte.id))).number).toBe("2026-0047");

    const taken = await issue(ana, document(ana.norte.id), "2026-0046");
    expect(taken.status).toBe(409);
    expect(await errorCode(taken)).toBe("number_taken");
    expect((await issue(ana, document(ana.norte.id), "R-2026-0001")).status).toBe(400);
  });

  it("needs a client and lines", async () => {
    const ana = await seller();
    expect((await issue(ana, document(""))).status).toBe(400);
    expect((await issue(ana, document(ana.norte.id, { lines: [] }))).status).toBe(400);
  });

  it("won't issue a document twice", async () => {
    const ana = await seller();
    const invoice = await issued(ana, document(ana.norte.id));
    const again = await issue(ana, invoice);
    expect(again.status).toBe(409);
    expect(await errorCode(again)).toBe("already_issued");
  });
});

describe("issued invoices", () => {
  it("can't be edited or deleted", async () => {
    const ana = await seller();
    const invoice = await issued(ana, document(ana.norte.id));
    for (const changes of [{ lines: [line({ unitPrice: 1 })] }, { issuedOn: "2026-10-06" }, { number: "2026-0002" }]) {
      const response = await send(ana, [{ type: "update", entity: "salesDocuments", id: invoice.id, changes }]);
      expect(response.status).toBe(409);
      expect(await errorCode(response)).toBe("invoice_issued");
    }
    const deleted = await send(ana, [{ type: "delete", entity: "salesDocuments", id: invoice.id }]);
    expect(deleted.status).toBe(409);
    expect(await salesDocuments(ana)).toEqual([invoice]);
  });

  it("still take their collections, tags and private notes", async () => {
    const ana = await seller();
    const invoice = await issued(ana, document(ana.norte.id));
    const total = invoice.issued!.totals.total;
    const half = { id: newId(), date: "2026-10-20", amount: total / 2, paymentMethodId: "bank1" };
    const partial = { payments: [half], tags: ["t1"], privateNotes: "Pagada por transferencia" };
    const response = await send(ana, [
      // Unchanged fields sent along are fine
      { type: "update", entity: "salesDocuments", id: invoice.id, changes: { ...partial, issuedOn: invoice.issuedOn } },
    ]);
    expect(response.status).toBe(200);
    // Part of the total collected: still pending
    expect(await salesDocuments(ana)).toEqual([{ ...invoice, ...partial, status: "pending" }]);

    const rest = { ...half, id: newId(), date: "2026-10-27" };
    // The status follows the collections, whatever the client sends
    await send(ana, [
      {
        type: "update",
        entity: "salesDocuments",
        id: invoice.id,
        changes: { payments: [half, rest], status: "pending" },
      },
    ]);
    expect((await salesDocuments(ana))[0]).toMatchObject({ status: "paid", payments: [half, rest] });

    const back = await send(ana, [
      { type: "update", entity: "salesDocuments", id: invoice.id, changes: { payments: [], status: "pending" } },
    ]);
    expect(back.status).toBe(200);
    expect((await salesDocuments(ana))[0]).toMatchObject({ status: "pending" });
    expect((await salesDocuments(ana))[0]?.payments).toBeUndefined();
    const invalid = await send(ana, [
      { type: "update", entity: "salesDocuments", id: invoice.id, changes: { status: "accepted" } },
    ]);
    expect(invalid.status).toBe(400);
  });

  it("are paid when issued with collections that cover the total", async () => {
    const ana = await seller();
    const draft = document(ana.norte.id);
    const invoice = await issued(ana, {
      ...draft,
      payments: [{ id: newId(), date: draft.issuedOn, amount: 106_000 as Cents, paymentMethodId: "bank1" }],
    });
    expect(invoice.status).toBe("paid");
  });

  it("are the only documents that take collections", async () => {
    const ana = await seller();
    const response = await send(ana, [
      {
        type: "create",
        entity: "salesDocuments",
        data: {
          ...document(ana.norte.id, { kind: "quote", status: "created" }),
          payments: [{ id: newId(), date: "2026-10-20", amount: 100 as Cents, paymentMethodId: "bank1" }],
        },
      },
    ]);
    expect(response.status).toBe(400);
  });
});

describe("rectifying invoices", () => {
  it("are numbered in their own series and name an issued invoice", async () => {
    const ana = await seller();
    const original = await issued(ana, document(ana.norte.id));
    const rectifying = await issued(
      ana,
      document(ana.norte.id, { series: "rectifying", rectifiesId: original.id, lines: [line({ quantity: -1 })] }),
    );
    expect(rectifying).toMatchObject({ number: "R-2026-0001", rectifiesId: original.id });
    expect(rectifying.issued?.totals.total).toBe(-106_000);
    expect((await issued(ana, document(ana.norte.id))).number).toBe("2026-0002");
  });

  it("must rectify an issued invoice of the normal series", async () => {
    const ana = await seller();
    const draft = document(ana.norte.id);
    await send(ana, [{ type: "create", entity: "salesDocuments", data: draft }]);
    for (const rectifiesId of [undefined, draft.id, newId()]) {
      const response = await issue(ana, document(ana.norte.id, { series: "rectifying", rectifiesId }));
      expect(response.status).toBe(400);
    }
    const original = await issued(ana, document(ana.norte.id));
    const normal = await issue(ana, document(ana.norte.id, { rectifiesId: original.id }));
    expect(normal.status).toBe(400);
  });
});

describe("closed quarters", () => {
  it("lock issuing invoices dated in them until they are reopened", async () => {
    const ana = await seller();
    await send(ana, [{ type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-15" }]);
    expect((await workspace(ana)).closedQuarters).toEqual([{ period: "2026-T3", closedOn: "2026-10-15" }]);

    const response = await issue(ana, document(ana.norte.id, { issuedOn: "2026-09-30" }));
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("quarter_closed");
    // Drafts aren't booked, so they can still be dated in it
    expect(
      (await send(ana, [{ type: "create", entity: "salesDocuments", data: document("", { issuedOn: "2026-09-30" }) }]))
        .status,
    ).toBe(200);

    const { cursor } = await workspace(ana);
    await send(ana, [{ type: "reopenQuarter", period: "2026-T3" }]);
    expect((await changes(ana, cursor)).changes).toEqual([{ op: "delete", entity: "closedQuarters", id: "2026-T3" }]);
    expect((await issue(ana, document(ana.norte.id, { issuedOn: "2026-09-30" }))).status).toBe(200);
  });

  it("can be closed again", async () => {
    const ana = await seller();
    await send(ana, [{ type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-15" }]);
    await send(ana, [{ type: "reopenQuarter", period: "2026-T3" }]);
    const response = await send(ana, [{ type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-18" }]);
    expect(await response.json()).toEqual({
      changes: [{ op: "upsert", entity: "closedQuarters", data: { period: "2026-T3", closedOn: "2026-10-18" } }],
    });
    expect((await send(ana, [{ type: "reopenQuarter", period: "2026-T4" }])).status).toBe(404);
  });
});
