import { describe, expect, it } from "vitest";
import { redirectedMailer, type Mailer, type OutgoingEmail } from "./mailer";

describe("redirectedMailer", () => {
  it("delivers to one address and names the original recipients in the subject", async () => {
    const sent: OutgoingEmail[] = [];
    const mailer: Mailer = { address: "facturas@cuentalibre.test", send: async (email) => void sent.push(email) };
    const email: OutgoingEmail = {
      fromName: "Estudio Lucía",
      to: ["ana@example.com"],
      cc: ["luis@example.com"],
      bcc: ["eva@example.com"],
      subject: "Factura 2026-0001",
      text: "Hola",
      attachments: [],
    };

    await redirectedMailer(mailer, "owner@example.com").send(email);

    expect(sent).toEqual([
      {
        ...email,
        to: ["owner@example.com"],
        cc: [],
        bcc: [],
        subject: "[ana@example.com, luis@example.com, eva@example.com] Factura 2026-0001",
      },
    ]);
  });
});
