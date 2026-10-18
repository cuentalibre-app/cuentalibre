import { DEFAULT_ORGANIZATION_SETTINGS, type FiledReturn } from "@fiscalia/contracts";
import { newId } from "@fiscalia/core";
import { describe, expect, it } from "vitest";
import { changes, errorCode, member, send, workspace } from "./test/sync";

const profile = {
  ...DEFAULT_ORGANIZATION_SETTINGS.businessProfile,
  taxId: "50123456Q",
  firstName: "Lucía",
  lastName: "Martín",
};

describe("settings", () => {
  it("serves the defaults until a section is saved", async () => {
    const ana = await member();
    expect((await workspace(ana)).settings).toEqual(DEFAULT_ORGANIZATION_SETTINGS);

    const response = await send(ana, [{ type: "saveSettings", section: "businessProfile", data: profile }]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      changes: [{ op: "upsert", entity: "settings", data: { section: "businessProfile", data: profile } }],
    });
    expect((await workspace(ana)).settings).toEqual({ ...DEFAULT_ORGANIZATION_SETTINGS, businessProfile: profile });
  });

  it("feeds saved sections", async () => {
    const ana = await member();
    const { cursor } = await workspace(ana);
    const signing = { invoice: "company", quote: "none", deliveryNote: "none" } as const;
    await send(ana, [{ type: "saveSettings", section: "signing", data: signing }]);
    expect((await changes(ana, cursor)).changes).toEqual([
      { op: "upsert", entity: "settings", data: { section: "signing", data: signing } },
    ]);
  });

  it("validates the whole section", async () => {
    const ana = await member();
    const response = await send(ana, [
      {
        type: "saveSettings",
        section: "taxSetup",
        data: { ...DEFAULT_ORGANIZATION_SETTINGS.taxSetup, region: "mars" },
      },
    ]);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_settings");
  });

  it("takes only the organization's payment methods as the default one", async () => {
    const ana = await member();
    const unknown = await send(ana, [{ type: "saveSettings", section: "defaultPaymentMethod", data: newId() }]);
    expect(unknown.status).toBe(400);

    const method = { id: newId(), type: "cash", name: "Efectivo", number: "", accountId: null, active: true } as const;
    const response = await send(ana, [
      { type: "create", entity: "paymentMethods", data: method },
      { type: "saveSettings", section: "defaultPaymentMethod", data: method.id },
    ]);
    expect(response.status).toBe(200);
    expect((await workspace(ana)).settings.defaultPaymentMethod).toBe(method.id);
  });

  it("isolates organizations", async () => {
    const ana = await member("Ana");
    const bea = await member("Bea");
    await send(ana, [{ type: "saveSettings", section: "businessProfile", data: profile }]);
    expect((await workspace(bea)).settings.businessProfile).toEqual(DEFAULT_ORGANIZATION_SETTINGS.businessProfile);
  });
});

const filed = (form: FiledReturn["form"], fields: Partial<FiledReturn> = {}): FiledReturn => ({
  id: newId(),
  form,
  period: "2026-T3",
  boxes: form === "303" ? { "71": 21000, "87": 0 } : { "07": 30000, "19": 30000 },
  result: (form === "303" ? 21000 : 30000) as FiledReturn["result"],
  filedOn: "2026-10-15",
  ...fields,
});

describe("filed returns", () => {
  it("are stored when the quarter is closed, and closing again adds a new version", async () => {
    const ana = await member();
    const first = [filed("303"), filed("130")];
    const response = await send(ana, [
      { type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-15", returns: first },
    ]);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { changes: unknown[] }).changes).toEqual([
      { op: "upsert", entity: "closedQuarters", data: { period: "2026-T3", closedOn: "2026-10-15" } },
      { op: "upsert", entity: "filedReturns", data: first[0] },
      { op: "upsert", entity: "filedReturns", data: first[1] },
    ]);

    await send(ana, [{ type: "reopenQuarter", period: "2026-T3" }]);
    const supplementary = filed("303", { boxes: { "71": 25000, "87": 0 }, result: 25000 as FiledReturn["result"] });
    await send(ana, [{ type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-20", returns: [supplementary] }]);
    expect((await workspace(ana)).filedReturns).toEqual([...first, supplementary]);
  });

  it("must be of the quarter being closed, one per form", async () => {
    const ana = await member();
    const other = await send(ana, [
      {
        type: "closeQuarter",
        period: "2026-T3",
        closedOn: "2026-10-15",
        returns: [filed("303", { period: "2026-T2" })],
      },
    ]);
    expect(other.status).toBe(400);
    expect(await errorCode(other)).toBe("invalid_filed_return");

    const twice = await send(ana, [
      { type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-15", returns: [filed("303"), filed("303")] },
    ]);
    expect(twice.status).toBe(400);
    expect((await workspace(ana)).closedQuarters).toEqual([]);
  });

  it("are never replaced", async () => {
    const ana = await member();
    const once = filed("130");
    await send(ana, [{ type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-15", returns: [once] }]);
    const again = await send(ana, [
      {
        type: "closeQuarter",
        period: "2026-T3",
        closedOn: "2026-10-15",
        returns: [{ ...once, result: 0 as FiledReturn["result"] }],
      },
    ]);
    expect(again.status).toBe(409);
    expect((await workspace(ana)).filedReturns).toEqual([once]);
  });
});
