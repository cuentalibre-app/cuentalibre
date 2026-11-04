import type { FileUsage, FileUser, SalesKind } from "@cuentalibre/contracts";
import { contactPath } from "@/features/contacts/contacts-model";
import { expensePath } from "@/features/purchases/expenses-model";
import { ASSETS_PATH, PURCHASES_PATH } from "@/features/purchases/purchases-model";
import { KINDS } from "@/features/sales/sales-model";

export type FilesFilter = "all" | "unused";
export type FilesSort = "recent" | "size";

/** The files to show, unused ones only if asked, newest or largest first. */
export function visibleFiles(files: FileUsage[], filter: FilesFilter, sort: FilesSort): FileUsage[] {
  const shown = filter === "unused" ? files.filter((file) => file.usedBy.length === 0) : [...files];
  return sort === "size"
    ? shown.sort((a, b) => b.size - a.size)
    : shown.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** Bytes taken by files no record names: what deleting them would free. */
export const unusedBytes = (files: FileUsage[]) =>
  files.reduce((sum, file) => sum + (file.usedBy.length ? 0 : file.size), 0);

const NOUNS: Record<Exclude<FileUser["kind"], SalesKind>, string> = {
  client: "Cliente",
  supplier: "Proveedor",
  purchaseInvoice: "Factura recibida",
  asset: "Bien de inversión",
  expense: "Gasto",
  email: "Correo",
};

const isSalesKind = (kind: FileUser["kind"]): kind is SalesKind => kind in KINDS;

/** "Factura 2026-0047", "Gasto · Amazon", "Correo · Factura 2026-0047". */
export function fileUserLabel(user: FileUser): string {
  if (isSalesKind(user.kind)) return [KINDS[user.kind].singular, user.label].filter(Boolean).join(" ");
  return [NOUNS[user.kind], user.label].filter(Boolean).join(" · ");
}

/**
 * Where the record opens; none once deleted. An email opens the document it sent,
 * whose kind `kindOf` tells, if it's still there.
 */
export function fileUserPath(user: FileUser, kindOf: (documentId: string) => SalesKind | undefined) {
  if (user.deleted) return undefined;
  switch (user.kind) {
    case "client":
    case "supplier":
      return contactPath(user.kind, user.id);
    case "purchaseInvoice":
      return `${PURCHASES_PATH}/${user.id}`;
    case "asset":
      return `${ASSETS_PATH}/${user.id}`;
    case "expense":
      return expensePath(user);
    case "email": {
      const kind = user.documentId && kindOf(user.documentId);
      return kind ? `${KINDS[kind].path}/${user.documentId}` : undefined;
    }
    default:
      return `${KINDS[user.kind].path}/${user.id}`;
  }
}
