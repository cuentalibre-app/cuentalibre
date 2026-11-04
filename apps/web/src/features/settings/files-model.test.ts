import type { FileUsage, FileUser } from "@cuentalibre/contracts";
import { describe, expect, it } from "vitest";
import { fileUserLabel, fileUserPath, unusedBytes, visibleFiles } from "./files-model";

const ID = "0199f0a0-0000-7000-8000-000000000001";
const DOC = "0199f0a0-0000-7000-8000-000000000002";

const user = (fields: Partial<FileUser>): FileUser => ({
  kind: "expense",
  id: ID,
  label: null,
  deleted: false,
  ...fields,
});

const file = (name: string, size: number, uploadedAt: string, usedBy: FileUser[] = []): FileUsage => ({
  id: ID,
  name,
  size,
  contentType: "application/pdf",
  uploadedAt,
  usedBy,
});

describe("files model", () => {
  const files = [
    file("ticket.jpg", 200, "2026-10-02T10:00:00.000Z", [user({ label: "Amazon" })]),
    file("contrato.pdf", 900, "2026-10-01T10:00:00.000Z"),
    file("suelto.pdf", 100, "2026-10-03T10:00:00.000Z"),
  ];

  it("shows the newest or the largest first, and only unused files if asked", () => {
    expect(visibleFiles(files, "all", "recent").map((f) => f.name)).toEqual([
      "suelto.pdf",
      "ticket.jpg",
      "contrato.pdf",
    ]);
    expect(visibleFiles(files, "all", "size").map((f) => f.name)).toEqual(["contrato.pdf", "ticket.jpg", "suelto.pdf"]);
    expect(visibleFiles(files, "unused", "size").map((f) => f.name)).toEqual(["contrato.pdf", "suelto.pdf"]);
    expect(unusedBytes(files)).toBe(1000);
  });

  it("names each record that uses a file", () => {
    expect(fileUserLabel(user({ kind: "invoice", label: "F-2026-014" }))).toBe("Factura F-2026-014");
    expect(fileUserLabel(user({ kind: "expense", label: "Amazon" }))).toBe("Gasto · Amazon");
    expect(fileUserLabel(user({ kind: "email", label: "Tu factura" }))).toBe("Correo · Tu factura");
    expect(fileUserLabel(user({ kind: "quote" }))).toBe("Presupuesto");
  });

  it("links to the record, or for an email to the document it sent, unless it was deleted", () => {
    const none = () => undefined;
    expect(fileUserPath(user({ kind: "invoice" }), none)).toBe(`/ventas/facturas/${ID}`);
    expect(fileUserPath(user({ kind: "supplier" }), none)).toBe(`/contactos/proveedores/${ID}`);
    expect(fileUserPath(user({ kind: "expense" }), none)).toBe(`/compras/gastos/${ID}`);
    expect(fileUserPath(user({ kind: "asset" }), none)).toBe(`/compras/bienes-de-inversion/${ID}`);
    expect(fileUserPath(user({ kind: "expense", deleted: true }), none)).toBeUndefined();
    const email = user({ kind: "email", documentId: DOC });
    expect(fileUserPath(email, () => "draft")).toBe(`/ventas/borradores/${DOC}`);
    expect(fileUserPath(email, none)).toBeUndefined();
  });
});
