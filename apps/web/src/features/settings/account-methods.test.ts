import type { PaymentMethod, TreasuryAccount } from "@cuentalibre/contracts";
import { describe, expect, it } from "vitest";
import { addAccount, removeAccount, setAccountActive, takesMethod, type MethodBook } from "./account-methods";

const revolut: TreasuryAccount = { id: "rev", kind: "bank", name: "Revolut", number: "ES12", active: true };
const cash: TreasuryAccount = { id: "box", kind: "cash", name: "Caja", number: "", active: true };

const method = (id: string, accountId: string | null, active = true): PaymentMethod => ({
  id,
  type: "transfer",
  name: id,
  number: "",
  accountId,
  active,
});

const book = (defaultPaymentMethodId = "transfer"): MethodBook => ({
  accounts: [revolut, cash],
  paymentMethods: [
    method("transfer", "rev"),
    method("debit", "rev", false),
    method("cash", "box"),
    method("cheque", null),
  ],
  defaultPaymentMethodId,
});

describe("accounts and their methods", () => {
  it("opens an account with a method of its own", () => {
    const paypal: TreasuryAccount = { id: "pp", kind: "paypal", name: "PayPal", number: "yo@mail.es", active: true };
    const change = addAccount(book(), paypal, "pp-method");
    const created = {
      id: "pp-method",
      type: "paypal",
      name: "PayPal",
      number: "yo@mail.es",
      accountId: "pp",
      active: true,
    };
    expect(change.paymentMethods.at(-1)).toEqual(created);
    expect(change.commands).toEqual([
      { type: "create", entity: "treasuryAccounts", data: paypal },
      { type: "create", entity: "paymentMethods", data: created },
    ]);
  });

  it("makes the first method the default when there was none", () => {
    const empty = { accounts: [], paymentMethods: [], defaultPaymentMethodId: "" };
    const change = addAccount(empty, revolut, "m1");
    expect(change.defaultPaymentMethodId).toBe("m1");
    expect(change.commands.at(-1)).toEqual({ type: "saveSettings", section: "defaultPaymentMethod", data: "m1" });
  });

  it("deactivates and reactivates an account's methods with it", () => {
    const off = setAccountActive(book(), "rev", false);
    expect(off.paymentMethods.filter((m) => m.accountId === "rev").map((m) => m.active)).toEqual([false, false]);
    expect(off.commands).toEqual([
      { type: "update", entity: "treasuryAccounts", id: "rev", changes: { active: false } },
      { type: "update", entity: "paymentMethods", id: "transfer", changes: { active: false } },
      // The default moves to the next active method
      { type: "saveSettings", section: "defaultPaymentMethod", data: "cash" },
    ]);

    const on = setAccountActive({ ...off, defaultPaymentMethodId: "cash" }, "rev", true);
    expect(on.paymentMethods.filter((m) => m.accountId === "rev").every((m) => m.active)).toBe(true);
    expect(on.defaultPaymentMethodId).toBe("cash");
  });

  it("removes an account's unused methods and keeps the used ones, unlinked and inactive", () => {
    const change = removeAccount(book("cash"), "rev", (id) => id === "transfer");
    expect(change.accounts).toEqual([cash]);
    expect(change.paymentMethods).toEqual([
      { ...method("transfer", null), active: false },
      method("cash", "box"),
      method("cheque", null),
    ]);
    expect(change.commands).toEqual([
      { type: "update", entity: "paymentMethods", id: "transfer", changes: { accountId: null, active: false } },
      { type: "delete", entity: "paymentMethods", id: "debit" },
      { type: "delete", entity: "treasuryAccounts", id: "rev" },
    ]);
  });

  it("lets only a bank account take more than one method", () => {
    expect(takesMethod(revolut, book().paymentMethods)).toBe(true);
    expect(takesMethod(cash, book().paymentMethods)).toBe(false);
    // Its own method can stay; an empty cash account takes one
    expect(takesMethod(cash, book().paymentMethods, "cash")).toBe(true);
    expect(takesMethod(cash, [])).toBe(true);
  });

  it("clears the default when no active method is left", () => {
    const only = {
      accounts: [revolut],
      paymentMethods: [method("transfer", "rev")],
      defaultPaymentMethodId: "transfer",
    };
    const change = removeAccount(only, "rev", () => false);
    expect(change.paymentMethods).toEqual([]);
    expect(change.defaultPaymentMethodId).toBe("");
    expect(change.commands.at(-1)).toEqual({ type: "saveSettings", section: "defaultPaymentMethod", data: "" });
  });
});
