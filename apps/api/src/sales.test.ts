import { DEFAULT_ORGANIZATION_SETTINGS, type SalesDocument } from "@cuentalibre/contracts";
import { newId, type Cents } from "@cuentalibre/core";
import { describe, expect, it } from "vitest";
import type { Client } from "./test/harness";
import {
  changes,
  client,
  document,
  errorCode,
  issuer,
  ISSUER_PROFILE,
  line,
  member,
  send,
  workspace,
} from "./test/sync";

/** A member with one client, ready to invoice. */
async function seller() {
  const ana = await issuer();
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

  it("only takes a status of the document's kind", async () => {
    const ana = await seller();
    const quote = document(ana.norte.id, { kind: "quote", number: "P-2026-0001", status: "paid" });
    const created = await send(ana, [{ type: "create", entity: "salesDocuments", data: quote }]);
    expect(created.status).toBe(400);
    expect(await created.json()).toEqual({
      error: {
        code: "invalid_document",
        message: "status: a quote can only be created, sent, accepted, rejected, invoiced.",
      },
    });

    const draft = document(ana.norte.id);
    await send(ana, [{ type: "create", entity: "salesDocuments", data: draft }]);
    const updated = await send(ana, [
      { type: "update", entity: "salesDocuments", id: draft.id, changes: { status: "accepted" } },
    ]);
    expect(updated.status).toBe(400);
    expect(await errorCode(updated)).toBe("invalid_document");
    expect(await salesDocuments(ana)).toEqual([draft]);
  });

  it("won't store lines that share an ID", async () => {
    const ana = await seller();
    const draft = document(ana.norte.id);
    await send(ana, [{ type: "create", entity: "salesDocuments", data: draft }]);
    const lines = [line({ id: "1", concept: "X" }), line({ id: "1", concept: "Y" })];
    const response = await send(ana, [{ type: "update", entity: "salesDocuments", id: draft.id, changes: { lines } }]);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "invalid_document", message: "lines: the ID 1 is repeated." },
    });
    expect(await salesDocuments(ana)).toEqual([draft]);
  });

  it("doesn't create invoices directly", async () => {
    const ana = await seller();
    const invoice = document(ana.norte.id, { kind: "invoice", number: "2026-0001" });
    const response = await send(ana, [{ type: "create", entity: "salesDocuments", data: invoice }]);
    expect(response.status).toBe(400);
  });
});

describe("issuing invoices", () => {
  it("needs the issuer's NIF, fiscal name and address, also for imported invoices", async () => {
    const ana = await member();
    const norte = client();
    expect((await send(ana, [{ type: "create", entity: "clients", data: norte }])).status).toBe(200);
    // The trade name doesn't name the issuer
    const profile = { ...ISSUER_PROFILE, lastName: "", city: " ", tradeName: "Estudio Martín" };
    await send(ana, [{ type: "saveSettings", section: "businessProfile", data: profile }]);

    for (const number of [undefined, "2026-0100"]) {
      const response = await issue(ana, document(norte.id), number);
      expect(response.status).toBe(400);
      const { error } = (await response.json()) as { error: { code: string; message: string } };
      expect(error).toMatchObject({ code: "issuer_missing", message: expect.stringContaining("lastName, city") });
    }
    expect(await salesDocuments(ana)).toEqual([]);

    // Drafts don't name an issuer yet
    expect((await send(ana, [{ type: "create", entity: "salesDocuments", data: document(norte.id) }])).status).toBe(
      200,
    );
  });

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
  it("can be deleted while the quarter is open", async () => {
    const ana = await seller();
    const first = await issued(ana, document(ana.norte.id, { issuedOn: "2026-10-20" }));
    expect((await send(ana, [{ type: "delete", entity: "salesDocuments", id: first.id }])).status).toBe(200);
    expect(await salesDocuments(ana)).toEqual([]);
    // Its number and date are free again
    const next = await issued(ana, document(ana.norte.id, { issuedOn: "2026-10-19" }));
    expect(next.number).toBe("2026-0001");

    const old = await issued(ana, document(ana.norte.id, { issuedOn: "2026-10-21" }));
    await send(ana, [{ type: "closeQuarter", period: "2026-T4", closedOn: "2027-01-15" }]);
    const closed = await send(ana, [{ type: "delete", entity: "salesDocuments", id: old.id }]);
    expect(closed.status).toBe(409);
    expect(await errorCode(closed)).toBe("quarter_closed");
  });

  it("can only be deleted from the end of their series", async () => {
    const ana = await seller();
    const first = await issued(ana, document(ana.norte.id));
    const second = await issued(ana, document(ana.norte.id));
    const middle = await send(ana, [{ type: "delete", entity: "salesDocuments", id: first.id }]);
    expect(middle.status).toBe(409);
    expect(await errorCode(middle)).toBe("not_last_in_series");
    // An invoice of another series doesn't hold it back
    await issued(ana, document(ana.norte.id, { series: "rectifying", rectifiesId: first.id, lines: [line()] }));
    expect((await send(ana, [{ type: "delete", entity: "salesDocuments", id: second.id }])).status).toBe(200);
  });

  it("can't be deleted while a rectifying invoice corrects them", async () => {
    const ana = await seller();
    const original = await issued(ana, document(ana.norte.id));
    const rectifying = await issued(
      ana,
      document(ana.norte.id, { series: "rectifying", rectifiesId: original.id, lines: [line({ quantity: -1 })] }),
    );
    const blocked = await send(ana, [{ type: "delete", entity: "salesDocuments", id: original.id }]);
    expect(blocked.status).toBe(409);
    expect(await errorCode(blocked)).toBe("in_use");

    expect((await send(ana, [{ type: "delete", entity: "salesDocuments", id: rectifying.id }])).status).toBe(200);
    expect((await send(ana, [{ type: "delete", entity: "salesDocuments", id: original.id }])).status).toBe(200);
  });

  it("can be revised while the quarter is open", async () => {
    const ana = await seller();
    const first = await issued(ana, document(ana.norte.id, { issuedOn: "2026-10-05" }));
    const second = await issued(ana, document(ana.norte.id, { issuedOn: "2026-10-10" }));
    const update = (id: string, changes: Record<string, unknown>) =>
      send(ana, [{ type: "update", entity: "salesDocuments", id, changes }]);

    const lines = [line({ unitPrice: 2000 })];
    expect((await update(first.id, { lines, issuedOn: "2026-10-08", publicNotes: "Revisada" })).status).toBe(200);
    const revised = (await salesDocuments(ana)).find((d) => d.id === first.id)!;
    // Same number, new totals: 2000 + 21 % VAT - 15 % withholding
    expect(revised).toMatchObject({ number: first.number, issuedOn: "2026-10-08", publicNotes: "Revisada" });
    expect(revised.issued!.totals.total).toBe(212_000);

    // Its number and its place in the series stay
    expect((await update(first.id, { number: "2026-0009" })).status).toBe(400);
    const late = await update(first.id, { issuedOn: "2026-10-11" });
    expect(late.status).toBe(409);
    expect(await errorCode(late)).toBe("date_out_of_order");
    expect((await update(second.id, { issuedOn: "2027-01-04" })).status).toBe(400);

    await send(ana, [{ type: "closeQuarter", period: "2026-T4", closedOn: "2027-01-15" }]);
    const closed = await update(second.id, { publicNotes: "Tarde" });
    expect(closed.status).toBe(409);
    expect(await errorCode(closed)).toBe("quarter_closed");
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

  it("can't take the original past zero, however many there are", async () => {
    const ana = await seller();
    const original = await issued(ana, document(ana.norte.id, { lines: [line({ quantity: 3 })] }));
    const rectify = (quantity: number) =>
      issue(
        ana,
        document(ana.norte.id, { series: "rectifying", rectifiesId: original.id, lines: [line({ quantity })] }),
      );

    expect((await rectify(-2)).status).toBe(200);
    const past = await rectify(-2);
    expect(past.status).toBe(409);
    expect(await errorCode(past)).toBe("rectified_past_zero");
    // Undoing part of a rectification brings the original back up
    expect((await rectify(1)).status).toBe(200);
    expect((await rectify(-2)).status).toBe(200);
    expect(await errorCode(await rectify(-1))).toBe("rectified_past_zero");
  });

  it("only rectify an original, never another rectifying invoice", async () => {
    const ana = await seller();
    const original = await issued(ana, document(ana.norte.id));
    const rectifying = await issued(
      ana,
      document(ana.norte.id, { series: "rectifying", rectifiesId: original.id, lines: [line({ quantity: -1 })] }),
    );
    const chained = await issue(
      ana,
      document(ana.norte.id, { series: "rectifying", rectifiesId: rectifying.id, lines: [line()] }),
    );
    expect(chained.status).toBe(400);
  });
});

describe("custom series", () => {
  const serieB = { id: newId(), type: "normal" as const, name: "Serie B", mask: "AAAA-B-####" };

  async function withSeries(user: Client, series: object[] = [serieB], defaultSeries?: object) {
    return send(user, [
      {
        type: "saveSettings",
        section: "invoiceSettings",
        data: { ...DEFAULT_ORGANIZATION_SETTINGS.invoiceSettings, series, defaultSeries },
      },
    ]);
  }

  it("number their invoices with their mask, apart from the built-in series", async () => {
    const ana = await seller();
    expect((await withSeries(ana)).status).toBe(200);
    await issued(ana, document(ana.norte.id));
    const invoice = await issued(ana, document(ana.norte.id, { seriesId: serieB.id }));
    expect(invoice).toMatchObject({ number: "2026-B-0001", seriesId: serieB.id });
    expect((await issued(ana, document(ana.norte.id, { seriesId: serieB.id }))).number).toBe("2026-B-0002");
    expect((await issued(ana, document(ana.norte.id))).number).toBe("2026-0002");
  });

  it("take imported numbers that follow their mask", async () => {
    const ana = await seller();
    await withSeries(ana);
    expect((await issue(ana, document(ana.norte.id, { seriesId: serieB.id }), "2026-B-0007")).status).toBe(200);
    expect((await issued(ana, document(ana.norte.id, { seriesId: serieB.id }))).number).toBe("2026-B-0008");
    const off = await issue(ana, document(ana.norte.id, { seriesId: serieB.id }), "2026-0009");
    expect(off.status).toBe(400);
  });

  it("must exist and match the type of the invoice", async () => {
    const ana = await seller();
    const unknown = await issue(ana, document(ana.norte.id, { seriesId: newId() }));
    expect(unknown.status).toBe(400);
    await withSeries(ana);
    const original = await issued(ana, document(ana.norte.id));
    const rectifying = document(ana.norte.id, { series: "rectifying", rectifiesId: original.id, seriesId: serieB.id });
    expect((await issue(ana, rectifying)).status).toBe(400);
  });

  it("can't share the format of another series", async () => {
    const ana = await seller();
    const clash = { ...serieB, id: newId(), mask: "AAAA-##" };
    const response = await withSeries(ana, [clash]);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_settings");
  });

  it("keep their mask once they number an invoice", async () => {
    const ana = await seller();
    await withSeries(ana);
    expect((await withSeries(ana, [{ ...serieB, mask: "AAAA-C-####" }])).status).toBe(200);
    await withSeries(ana);
    await issued(ana, document(ana.norte.id, { seriesId: serieB.id }));
    expect((await withSeries(ana, [{ ...serieB, name: "Serie B (tienda)" }])).status).toBe(200);
    const changed = await withSeries(ana, [{ ...serieB, mask: "AAAA-C-####" }]);
    expect(changed.status).toBe(409);
    expect(await errorCode(changed)).toBe("series_in_use");
    expect((await withSeries(ana, [])).status).toBe(409);
  });
});

describe("series settings", () => {
  const serieB = { id: newId(), type: "normal" as const, name: "Serie B", mask: "AAAA-B-####" };
  const save = (user: Client, series: object[], defaultSeries?: object) =>
    send(user, [
      {
        type: "saveSettings",
        section: "invoiceSettings",
        data: { ...DEFAULT_ORGANIZATION_SETTINGS.invoiceSettings, series, defaultSeries },
      },
    ]);

  it("can be removed while no invoice or draft uses them", async () => {
    const ana = await seller();
    await save(ana, [serieB]);
    expect((await save(ana, [])).status).toBe(200);
    await save(ana, [serieB]);
    const draft = document(ana.norte.id, { kind: "draft", number: null, seriesId: serieB.id });
    await send(ana, [{ type: "create", entity: "salesDocuments", data: draft }]);
    expect((await save(ana, [])).status).toBe(409);
  });

  it("take no new invoices while inactive, but still imported ones", async () => {
    const ana = await seller();
    await save(ana, [{ ...serieB, active: false }]);
    const response = await issue(ana, document(ana.norte.id, { seriesId: serieB.id }));
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("series_inactive");
    expect((await issue(ana, document(ana.norte.id, { seriesId: serieB.id }), "2026-B-0004")).status).toBe(200);
  });

  it("let built-in series change their mask until they number an invoice, but not their type", async () => {
    const ana = await seller();
    const normal = { id: "normal", type: "normal", name: "Ordinarias", mask: "F-AA-###" };
    expect((await save(ana, [normal])).status).toBe(200);
    expect((await issued(ana, document(ana.norte.id))).number).toBe("F-26-001");
    expect((await save(ana, [{ ...normal, mask: "AAAA-####" }])).status).toBe(409);
    expect((await save(ana, [{ ...normal, name: "Facturas" }])).status).toBe(200);
    expect((await save(ana, [{ ...normal, type: "rectifying" }])).status).toBe(400);
  });

  it("propose an active default series of each type", async () => {
    const ana = await seller();
    expect((await save(ana, [serieB], { normal: serieB.id })).status).toBe(200);
    expect((await save(ana, [{ ...serieB, active: false }], { normal: serieB.id })).status).toBe(400);
    expect((await save(ana, [serieB], { rectifying: serieB.id })).status).toBe(400);
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
