import type { Workspace } from "@cuentalibre/contracts";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { user } from "./db/schema";
import { seed } from "./db/seed";
import { app, db, env } from "./test/harness";

describe("seed", () => {
  it("creates one verified account with invoices and expenses, once", async () => {
    const account = { email: `seed${Date.now()}@example.com`, password: "a-long-password" };
    expect(await seed(app, db, env.BETTER_AUTH_URL, account, "2026-10-27")).toBe(true);

    const [created] = await db.select().from(user).where(eq(user.email, account.email));
    expect(created?.emailVerified).toBe(true);

    const signIn = await app.request(`${env.BETTER_AUTH_URL}/v1/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.BETTER_AUTH_URL },
      body: JSON.stringify(account),
    });
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers
      .getSetCookie()
      .map((header) => header.split(";")[0])
      .join("; ");
    const response = await app.request(`${env.BETTER_AUTH_URL}/v1/workspace`, { headers: { cookie } });
    const workspace = (await response.json()) as Workspace;
    expect(workspace.salesDocuments.map((document) => document.kind)).toEqual(["invoice", "invoice", "draft"]);
    expect(workspace.purchaseInvoices).toHaveLength(1);
    expect(workspace.expenses).toHaveLength(2);

    expect(await seed(app, db, env.BETTER_AUTH_URL, account)).toBe(false);
  });
});
