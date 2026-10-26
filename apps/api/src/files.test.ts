import { newId } from "@cuentalibre/core";
import { describe, expect, it } from "vitest";
import type { Client } from "./test/harness";
import { client, errorCode, member, send, workspace } from "./test/sync";

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

  it("needs a session and an organization", async () => {
    const response = await (await import("./test/harness")).app.request(`http://localhost:3000/v1/files/${newId()}`);
    expect(response.status).toBe(401);
  });
});
