import { describe, expect, it } from "vitest";
import { fromDraft, toDraft, validateDraft } from "./contact-draft";

const draft = (fields: Partial<ReturnType<typeof toDraft>>) => ({ ...toDraft(undefined), name: "Norte SL", ...fields });

describe("validateDraft", () => {
  it("needs a valid tax ID", () => {
    expect(validateDraft(draft({ taxId: "" })).taxId).toBe("Introduce un NIF.");
    expect(validateDraft(draft({ taxId: "B12345675" })).taxId).toMatch(/control/);
    expect(validateDraft(draft({ taxId: "B12345674" })).taxId).toBeUndefined();
  });

  it('lets the "Clientes varios" client go without one, but not with a wrong one', () => {
    expect(validateDraft(draft({ taxId: "", variousClients: true })).taxId).toBeUndefined();
    expect(validateDraft(draft({ taxId: "hola", variousClients: true })).taxId).toBeDefined();
  });
});

describe("fromDraft", () => {
  it('keeps the "Clientes varios" mark on clients only', () => {
    const various = draft({ taxId: "", variousClients: true });
    expect(fromDraft("client", various, "c1").variousClients).toBe(true);
    expect(fromDraft("supplier", various, "s1").variousClients).toBeUndefined();
    expect(fromDraft("client", draft({ taxId: "B12345674" }), "c2").variousClients).toBeUndefined();
  });
});
