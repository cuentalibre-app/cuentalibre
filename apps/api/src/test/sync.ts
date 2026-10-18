import type { Changes, SyncCommand, Workspace } from "@fiscalia/contracts";
import { newId } from "@fiscalia/core";
import { expect } from "vitest";
import { createOrganization, signUp, type Client } from "./harness";

/** The workspace of an organization with no data. */
export const EMPTY: Workspace = {
  cursor: 0,
  clients: [],
  suppliers: [],
  salesDocuments: [],
  purchaseInvoices: [],
  expenses: [],
  closedQuarters: [],
};

/** A signed-in user working in a new organization of their own. */
export async function member(name = "Ana") {
  const client = await signUp(name);
  const organization = await createOrganization(client, `${name} SL`);
  return Object.assign(client, { organizationId: organization.id });
}

export const client = (fields: Record<string, unknown> = {}) => ({
  id: newId(),
  name: "Estudio Norte S.L.",
  taxId: "B12345674",
  ...fields,
});

export async function send(user: Client, commands: SyncCommand[]) {
  return user.request("/v1/commands", { method: "POST", body: { commands } });
}

export async function workspace(user: Client) {
  const response = await user.request("/v1/workspace");
  expect(response.status).toBe(200);
  return (await response.json()) as Workspace;
}

export async function changes(user: Client, since: number, limit?: number) {
  const response = await user.request(`/v1/sync?since=${since}${limit ? `&limit=${limit}` : ""}`);
  expect(response.status).toBe(200);
  return (await response.json()) as Changes;
}

export const errorCode = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;
