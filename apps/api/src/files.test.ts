import type { Cents } from "@cuentalibre/core";
import type { Expense, FileListing } from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { file, user } from "./db/schema";
import { db, storage, type Client } from "./test/harness";
import { client, document, errorCode, member, send, workspace } from "./test/sync";

const pdf = new TextEncoder().encode("%PDF-1.7 factura");

async function upload(
  user: Client,
  body: string | Uint8Array<ArrayBuffer>,
  fields: { id?: string; name?: string; type?: string } = {},
) {
  const form = new FormData();
  form.set("file", new File([body], fields.name ?? "factura.pdf", { type: fields.type ?? "application/pdf" }));
  if (fields.id) form.set("id", fields.id);
  return user.request("/v1/files", { method: "POST", form });
}

async function listing(user: Client) {
  const response = await user.request("/v1/files");
  expect(response.status).toBe(200);
  return (await response.json()) as FileListing;
}

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

describe("files", () => {
  it("uploads a file under the ID the client chose and serves it back", async () => {
    const ana = await member();
    const id = newId();
    const response = await upload(ana, pdf, { id, name: "Factura Brisa 118.pdf" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id,
      name: "Factura Brisa 118.pdf",
      size: pdf.byteLength,
      contentType: "application/pdf",
    });

    const download = await ana.request(`/v1/files/${id}`);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("application/pdf");
    expect(download.headers.get("content-disposition")).toBe("inline; filename*=UTF-8''Factura%20Brisa%20118.pdf");
    // Shown in a tab, a file runs nothing and can't be framed
    expect(download.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'; sandbox");
    expect(download.headers.get("x-content-type-options")).toBe("nosniff");
    expect(download.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(pdf);
  });

  it("downloads types a browser could run instead of showing them", async () => {
    const ana = await member();
    const response = await upload(ana, "<script>alert(1)</script>", { name: "page.html", type: "text/html" });
    const { id } = (await response.json()) as { id: string };
    const download = await ana.request(`/v1/files/${id}`);
    expect(download.headers.get("content-type")).toBe("application/octet-stream");
    expect(download.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(download.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("doesn't reuse an ID", async () => {
    const ana = await member();
    const id = newId();
    expect((await upload(ana, pdf, { id })).status).toBe(201);
    const again = await upload(ana, "other bytes", { id });
    expect(again.status).toBe(409);
    expect(new Uint8Array(await (await ana.request(`/v1/files/${id}`)).arrayBuffer())).toEqual(pdf);
  });

  it("rejects files over the size limit", async () => {
    const ana = await member();
    const response = await upload(ana, new Uint8Array(1024 * 1024 + 1));
    expect(response.status).toBe(413);
    expect(await errorCode(response)).toBe("file_too_large");
  });

  it("caps the bytes an organization's files take in all, even uploaded at once", async () => {
    const ana = await member();
    // The quota is 3 MB: three of these fit and the fourth doesn't
    const responses = await Promise.all([1, 2, 3, 4].map(() => upload(ana, new Uint8Array(1024 * 1024))));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 201, 201, 413]);
    expect(await errorCode(responses.find((response) => response.status === 413)!)).toBe("storage_quota_exceeded");

    // Other organizations have their own
    const eve = await member("Eve");
    expect((await upload(eve, pdf)).status).toBe(201);
  });

  it("keeps files to their organization", async () => {
    const ana = await member();
    const { id } = (await (await upload(ana, pdf)).json()) as { id: string };
    const eve = await member("Eve");
    expect((await eve.request(`/v1/files/${id}`)).status).toBe(404);

    // Nor can Eve attach Ana's file to her records
    const contact = client({ attachments: [{ id, name: "factura.pdf", size: pdf.byteLength }] });
    const response = await send(eve, [{ type: "create", entity: "clients", data: contact }]);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_attachment");
  });

  it("lets records name uploaded files and drops the browser's URL", async () => {
    const ana = await member();
    const { id } = (await (await upload(ana, pdf)).json()) as { id: string };
    const attachment = { id, name: "factura.pdf", size: pdf.byteLength };
    const contact = client({ attachments: [{ ...attachment, url: "blob:http://localhost:5173/x" }] });
    expect((await send(ana, [{ type: "create", entity: "clients", data: contact }])).status).toBe(200);
    expect((await workspace(ana)).clients).toEqual([{ ...contact, attachments: [attachment] }]);

    const missing = await send(ana, [
      {
        type: "update",
        entity: "clients",
        id: contact.id,
        changes: { attachments: [attachment, { id: newId(), name: "otra.pdf", size: 1 }] },
      },
    ]);
    expect(await errorCode(missing)).toBe("invalid_attachment");
  });

  it("lists the files with the records that name them, deleted ones included, and the bytes they take", async () => {
    const ana = await member();
    const [contract, receipt, invoicePdf, loose] = await Promise.all(
      ["contrato.pdf", "ticket.jpg", "factura.pdf", "suelto.pdf"].map(async (name) => {
        const response = await upload(ana, pdf, { name });
        return ((await response.json()) as { id: string }).id;
      }),
    );
    const attach = (id: string) => [{ id, name: "x.pdf", size: pdf.byteLength }];
    const norte = client({ attachments: attach(contract!) });
    const parking = expense({ attachments: attach(receipt!) });
    const draft = document(norte.id, { attachments: attach(invoicePdf!) });
    await send(ana, [
      { type: "create", entity: "clients", data: norte },
      { type: "create", entity: "expenses", data: parking },
      { type: "create", entity: "salesDocuments", data: draft },
    ]);
    expect((await send(ana, [{ type: "delete", entity: "expenses", id: parking.id }])).status).toBe(200);

    const { files, usedBytes, quotaBytes } = await listing(ana);
    expect(usedBytes).toBe(4 * pdf.byteLength);
    expect(quotaBytes).toBe(3 * 1024 * 1024);
    const usersOf = (id: string) => files.find((f) => f.id === id)!.usedBy;
    expect(usersOf(contract!)).toEqual([{ kind: "client", id: norte.id, label: "Estudio Norte S.L.", deleted: false }]);
    expect(usersOf(receipt!)).toEqual([
      { kind: "expense", id: parking.id, label: "Aparcamiento Centro", deleted: true },
    ]);
    expect(usersOf(invoicePdf!)).toEqual([{ kind: "draft", id: draft.id, label: "BOR-2026-0001", deleted: false }]);
    expect(usersOf(loose!)).toEqual([]);
    expect(files.find((f) => f.id === loose)).toMatchObject({ name: "suelto.pdf", size: pdf.byteLength });
    expect(Date.parse(files[0]!.uploadedAt)).not.toBeNaN();

    // Files stay to their organization
    expect((await listing(await member("Eve"))).files).toEqual([]);
  });

  it("deletes an unused file and its bytes, freeing them from the quota", async () => {
    const ana = await member();
    const big = new Uint8Array(1024 * 1024);
    const ids = await Promise.all(
      [1, 2, 3].map(async () => ((await (await upload(ana, big)).json()) as { id: string }).id),
    );
    expect((await upload(ana, big)).status).toBe(413);

    const [row] = await db
      .select({ key: file.storageKey })
      .from(file)
      .where(and(eq(file.organizationId, ana.organizationId), eq(file.id, ids[0]!)));
    const response = await ana.request(`/v1/files/${ids[0]}`, { method: "DELETE" });
    expect(response.status).toBe(204);
    expect(await storage.get(row!.key)).toBeNull();
    expect((await ana.request(`/v1/files/${ids[0]}`)).status).toBe(404);
    expect((await listing(ana)).usedBytes).toBe(2 * big.byteLength);
    expect((await upload(ana, big)).status).toBe(201);

    expect((await ana.request(`/v1/files/${ids[0]}`, { method: "DELETE" })).status).toBe(404);
    // Nor can another organization delete Ana's files
    expect((await (await member("Eve")).request(`/v1/files/${ids[1]}`, { method: "DELETE" })).status).toBe(404);
  });

  it("refuses to delete a file any record names, live or deleted, or an email", async () => {
    const ana = await member();
    await db.update(user).set({ emailVerified: true }).where(eq(user.email, ana.email));
    const ids = await Promise.all(
      [1, 2, 3].map(async () => ((await (await upload(ana, pdf)).json()) as { id: string }).id),
    );
    const [live, deleted, emailed] = ids as [string, string, string];
    const attach = (id: string) => [{ id, name: "x.pdf", size: pdf.byteLength }];
    const norte = client({ attachments: attach(live) });
    const draft = document(norte.id, { attachments: attach(deleted) });
    await send(ana, [
      { type: "create", entity: "clients", data: norte },
      { type: "create", entity: "salesDocuments", data: draft },
    ]);
    const sent = await ana.request("/v1/emails", {
      method: "POST",
      body: {
        documentId: draft.id,
        to: ["cliente@example.com"],
        subject: "Factura",
        body: "Hola",
        attachments: [emailed],
      },
    });
    expect(sent.status).toBe(202);
    await send(ana, [{ type: "delete", entity: "salesDocuments", id: draft.id }]);

    for (const id of ids) {
      const response = await ana.request(`/v1/files/${id}`, { method: "DELETE" });
      expect(response.status).toBe(409);
      expect(await errorCode(response)).toBe("file_in_use");
      expect((await ana.request(`/v1/files/${id}`)).status).toBe(200);
    }
    const emailUser = (await listing(ana)).files.find((f) => f.id === emailed)!.usedBy;
    expect(emailUser).toEqual([
      { kind: "email", id: expect.any(String), label: "Factura", documentId: draft.id, deleted: false },
    ]);
  });

  it("never leaves a record naming a file deleted at the same time", async () => {
    const ana = await member();
    for (let round = 0; round < 10; round++) {
      const { id } = (await (await upload(ana, pdf)).json()) as { id: string };
      const contact = client({ attachments: [{ id, name: "x.pdf", size: pdf.byteLength }] });
      const [deleted, named] = await Promise.all([
        ana.request(`/v1/files/${id}`, { method: "DELETE" }),
        send(ana, [{ type: "create", entity: "clients", data: contact }]),
      ]);
      // Either the file went first and the record was refused, or the record kept it
      expect([deleted.status, named.status]).toSatisfy(
        ([d, n]: number[]) => (d === 204 && n === 400) || (d === 409 && n === 200),
      );
    }
  });

  it("needs a session and an organization", async () => {
    const response = await (await import("./test/harness")).app.request(`http://localhost:3000/v1/files/${newId()}`);
    expect(response.status).toBe(401);
  });
});
