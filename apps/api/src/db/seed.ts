import { DEFAULT_ORGANIZATION_SETTINGS, type SyncCommand } from "@cuentalibre/contracts";
import { addDays, newId, type Cents } from "@cuentalibre/core";
import { eq } from "drizzle-orm";
import type { createApp } from "../app";
import type { Db } from "./client";
import { user } from "./schema";

/**
 * Fills an empty staging database with one account: a business with a few clients,
 * invoices and expenses, all made up. Staging never holds a copy of production data.
 * It goes through the API like the web app, so the records pass the same checks.
 * Returns false, doing nothing, when the account already exists.
 */
export async function seed(
  app: Pick<ReturnType<typeof createApp>, "request">,
  db: Db,
  origin: string,
  account: { email: string; password: string },
  today = new Date().toISOString().slice(0, 10),
): Promise<boolean> {
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, account.email));
  if (existing) return false;

  const cookies: string[] = [];
  const request = async (path: string, body: unknown) => {
    const response = await app.request(`${origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie: cookies.join("; ") },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
    for (const header of response.headers.getSetCookie()) cookies.push(header.split(";")[0]!);
    return response;
  };

  await request("/v1/auth/sign-up/email", { name: "Lucía", ...account });
  // No mailbox behind it to verify, and a banner asking for it would only get in the way
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, account.email));
  await request("/v1/auth/organization/create", { name: "Estudio Lucía Martín", slug: `seed-${newId()}` });

  const norte = {
    id: newId(),
    name: "Estudio Norte S.L.",
    taxId: "B12345674",
    address: "Calle Mayor 1",
    city: "Bilbao",
  };
  const brisa = { id: newId(), name: "Hosting Brisa S.L.", taxId: "B87654323" };
  const line = (concept: string, unitPrice: number) => ({
    id: newId(),
    concept,
    unitPrice,
    quantity: 1,
    discount: 0,
    vatRate: 0.21,
  });
  const invoice = (issuedOn: string, concept: string, unitPrice: number) => ({
    id: newId(),
    kind: "draft" as const,
    number: null,
    series: "normal" as const,
    clientId: norte.id,
    issuedOn,
    dueOn: addDays(issuedOn, 30),
    incomeType: "705" as const,
    withholding: "professional" as const,
    operationType: "national" as const,
    operationOn: null,
    cashBasis: false,
    rental: false,
    lines: [line(concept, unitPrice)],
    status: "pending" as const,
    publicNotes: "",
    privateNotes: "",
  });
  const expense = (date: string, concept: string, amount: number, payee: string) => ({
    id: newId(),
    date,
    number: "",
    concept,
    amount: amount as Cents,
    expenseType: "629" as const,
    imputation: 100,
    supplierId: null,
    otherPayee: { name: payee, taxId: "" },
    payment: { date, paymentMethodId: "card" },
    rental: false,
    privateNotes: "",
  });

  const commands: SyncCommand[] = [
    {
      type: "saveSettings",
      section: "businessProfile",
      data: {
        ...DEFAULT_ORGANIZATION_SETTINGS.businessProfile,
        taxId: "50123456Q",
        firstName: "Lucía",
        lastName: "Martín",
        secondLastName: "Sanz",
        address: "Calle del Pez 12",
        postalCode: "28004",
        city: "Madrid",
      },
    },
    { type: "create", entity: "clients", data: norte },
    { type: "create", entity: "suppliers", data: brisa },
    { type: "issue", data: invoice(addDays(today, -20), "Diseño web", 1200) },
    { type: "issue", data: invoice(addDays(today, -10), "Mantenimiento mensual", 300) },
    { type: "create", entity: "salesDocuments", data: invoice(today, "Rediseño del logo", 450) },
    {
      type: "create",
      entity: "purchaseInvoices",
      data: {
        id: newId(),
        supplierId: brisa.id,
        number: "F-118",
        issuedOn: addDays(today, -15),
        bookedOn: addDays(today, -15),
        dueOn: null,
        expenseType: "629",
        imputation: 100,
        vatImputation: null,
        withholding: "none",
        operationType: "national",
        operationOn: null,
        cashBasis: false,
        rental: false,
        lines: [line("Hosting anual", 120)],
        payments: [],
        privateNotes: "",
      },
    },
    { type: "create", entity: "expenses", data: expense(addDays(today, -12), "Parking", 1250, "Aparcamiento Centro") },
    { type: "create", entity: "expenses", data: expense(addDays(today, -5), "Comida con cliente", 3480, "Bar Sol") },
  ] as SyncCommand[];
  await request("/v1/commands", { commands });
  return true;
}
