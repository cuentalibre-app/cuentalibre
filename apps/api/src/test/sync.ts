import {
  DEFAULT_ORGANIZATION_SETTINGS,
  type Changes,
  type SalesDocument,
  type SyncCommand,
  type Workspace,
} from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
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
  filedReturns: [],
  tags: [],
  paymentMethods: [],
  manualPayments: [],
  catalogFamilies: [],
  products: [],
  stockMovements: [],
  settings: DEFAULT_ORGANIZATION_SETTINGS,
};

/** A signed-in user working in a new organization of their own. */
export async function member(name = "Ana") {
  const client = await signUp(name);
  const organization = await createOrganization(client, `${name} SL`);
  return Object.assign(client, { organizationId: organization.id });
}

/** A self-employed worker's profile with everything an invoice names its issuer with. */
export const ISSUER_PROFILE = {
  ...DEFAULT_ORGANIZATION_SETTINGS.businessProfile,
  taxId: "50123456Q",
  firstName: "Lucía",
  lastName: "Martín",
  secondLastName: "Sanz",
  address: "Calle del Pez 12",
  postalCode: "28004",
  city: "Madrid",
};

/** A member whose business profile lets them issue invoices. */
export async function issuer(name = "Ana") {
  const user = await member(name);
  const response = await send(user, [{ type: "saveSettings", section: "businessProfile", data: ISSUER_PROFILE }]);
  expect(response.status).toBe(200);
  return user;
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

/** A sales line of 1000 € at 21 % VAT. */
export const line = (fields: Record<string, unknown> = {}) => ({
  id: newId(),
  concept: "Diseño web",
  unitPrice: 1000,
  quantity: 1,
  discount: 0,
  vatRate: 0.21,
  ...fields,
});

/** A draft for the client, dated 5 October 2026. */
export const document = (clientId: string, fields: Partial<SalesDocument> = {}): SalesDocument => ({
  id: newId(),
  kind: "draft",
  number: "BOR-2026-0001",
  series: "normal",
  clientId,
  issuedOn: "2026-10-05",
  dueOn: "2026-11-04",
  incomeType: "705",
  withholding: "professional",
  operationType: "national",
  operationOn: null,
  cashBasis: false,
  rental: false,
  lines: [line()],
  status: "pending",
  publicNotes: "",
  privateNotes: "",
  ...fields,
});
