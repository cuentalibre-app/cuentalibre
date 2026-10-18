import { describe, expect, it } from "vitest";
import {
  autoReconcile,
  daysBetween,
  isDuplicateMovement,
  monthlyFlows,
  parseBankStatement,
  parseStatementAmount,
  parseStatementDate,
  rankCandidates,
  reconciliationStatus,
} from "./treasury";
import { eurosToCents } from "./money";

const eur = eurosToCents;

describe("reconciliationStatus", () => {
  it("compares to the cent", () => {
    expect(reconciliationStatus(eur(100), eur(0))).toBe("none");
    expect(reconciliationStatus(eur(100), eur(40))).toBe("partial");
    expect(reconciliationStatus(eur(0.3), eur(0.1 + 0.2))).toBe("full");
    expect(reconciliationStatus(eur(-48.4), eur(-48.4))).toBe("full");
  });
});

describe("daysBetween", () => {
  it("counts whole days across months and DST changes", () => {
    expect(daysBetween("2026-03-28", "2026-04-02")).toBe(5);
    expect(daysBetween("2026-10-30", "2026-10-20")).toBe(-10);
  });
});

describe("rankCandidates", () => {
  const movement = { date: "2026-09-24", amount: eur(4750) };

  it("keeps the same direction of money, within the window and not above the amount", () => {
    const ranked = rankCandidates(movement, [
      { id: "out", date: "2026-09-24", amount: eur(-4750) },
      { id: "far", date: "2026-06-01", amount: eur(4750) },
      { id: "big", date: "2026-09-24", amount: eur(5000) },
      { id: "ok", date: "2026-09-20", amount: eur(4750) },
    ]);
    expect(ranked.map((r) => r.candidate.id)).toEqual(["ok"]);
  });

  it("puts exact amounts first, then the closest date", () => {
    const ranked = rankCandidates(movement, [
      { id: "part", date: "2026-09-24", amount: eur(2000) },
      { id: "late", date: "2026-10-05", amount: eur(4750) },
      { id: "near", date: "2026-09-22", amount: eur(4750) },
    ]);
    expect(ranked.map((r) => [r.candidate.id, r.exact, r.days])).toEqual([
      ["near", true, 2],
      ["late", true, 11],
      ["part", false, 0],
    ]);
  });
});

describe("autoReconcile", () => {
  it("pairs equal monthly fees with their own month", () => {
    const pairs = autoReconcile(
      [
        { id: "m-sep", date: "2026-09-30", amount: eur(-88.56) },
        { id: "m-aug", date: "2026-08-31", amount: eur(-88.56) },
      ],
      [
        { id: "p-aug", date: "2026-08-31", amount: eur(-88.56) },
        { id: "p-sep", date: "2026-09-30", amount: eur(-88.56) },
      ],
    );
    expect(pairs).toEqual([
      { movementId: "m-aug", candidateId: "p-aug" },
      { movementId: "m-sep", candidateId: "p-sep" },
    ]);
  });

  it("leaves ambiguous movements and inexact amounts for review", () => {
    const pairs = autoReconcile(
      [
        { id: "tie", date: "2026-09-10", amount: eur(100) },
        { id: "inexact", date: "2026-09-10", amount: eur(99) },
      ],
      [
        { id: "a", date: "2026-09-08", amount: eur(100) },
        { id: "b", date: "2026-09-12", amount: eur(100) },
      ],
    );
    expect(pairs).toEqual([]);
  });
});

describe("monthlyFlows", () => {
  it("splits money in and out over the last months", () => {
    const months = monthlyFlows(
      [
        { date: "2026-10-02", amount: eur(500) },
        { date: "2026-10-03", amount: eur(-20) },
        { date: "2025-11-15", amount: eur(100) },
        { date: "2025-10-31", amount: eur(999) },
      ],
      new Date(2026, 9, 17),
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2025, month: 10, collected: eur(100), paid: 0 });
    expect(months[11]).toEqual({ year: 2026, month: 9, collected: eur(500), paid: eur(20) });
  });
});

describe("parseStatementAmount", () => {
  it("reads Spanish and English number formats", () => {
    expect(parseStatementAmount("1.250,50")).toBe(125_050);
    expect(parseStatementAmount("-1,250.50")).toBe(-125_050);
    expect(parseStatementAmount("-88,56 €")).toBe(-8_856);
    expect(parseStatementAmount("4750")).toBe(475_000);
    expect(parseStatementAmount("")).toBeNull();
    expect(parseStatementAmount("abc")).toBeNull();
  });
});

describe("parseStatementDate", () => {
  it("reads day-first and ISO dates", () => {
    expect(parseStatementDate("28/09/2026")).toBe("2026-09-28");
    expect(parseStatementDate("1-9-26")).toBe("2026-09-01");
    expect(parseStatementDate("2026-09-28")).toBe("2026-09-28");
  });

  it("rejects impossible dates", () => {
    expect(parseStatementDate("31/02/2026")).toBeNull();
    expect(parseStatementDate("septiembre")).toBeNull();
  });
});

describe("parseBankStatement", () => {
  it("skips the account details above the header and finds columns by name", () => {
    const csv = [
      "Cuenta;ES91 2100 0418 4502 0005 1332",
      "",
      "F. Operación;Concepto;Importe;Saldo;Referencia",
      '24/09/2026;"TRANSF. DE ESTUDIO NÓRDICO; S.L.";4.750,00;12.380,20;2026-0009',
      "30/09/2026;RECIBO SEG. SOCIAL;-294,00;12.086,20;",
      "31/09/2026;FECHA MALA;-1,00;;",
    ].join("\n");
    const { lines, errors } = parseBankStatement(csv);
    expect(lines).toEqual([
      {
        date: "2026-09-24",
        concept: "TRANSF. DE ESTUDIO NÓRDICO; S.L.",
        amount: eur(4750),
        balance: eur(12380.2),
        reference: "2026-0009",
      },
      { date: "2026-09-30", concept: "RECIBO SEG. SOCIAL", amount: eur(-294), balance: eur(12086.2), reference: "" },
    ]);
    expect(errors).toEqual([{ line: 6, message: "Fecha no válida: «31/09/2026»." }]);
  });

  it("combines debit and credit columns", () => {
    const csv = "Fecha,Descripción,Debe,Haber\n2026-10-01,Comisión,12.00,\n2026-10-02,Abono,,300.00";
    expect(parseBankStatement(csv).lines.map((l) => l.amount)).toEqual([eur(-12), eur(300)]);
  });

  it("reports a file without a recognizable header", () => {
    const { lines, errors } = parseBankStatement("a;b;c\n1;2;3");
    expect(lines).toEqual([]);
    expect(errors).toHaveLength(1);
  });
});

describe("isDuplicateMovement", () => {
  it("matches date, amount and concept, ignoring case and accents", () => {
    const existing = [{ date: "2026-09-30", amount: eur(-294), concept: "Recibo Seg. Social" }];
    expect(
      isDuplicateMovement({ date: "2026-09-30", amount: eur(-294), concept: "RECIBO SEG. SOCIAL" }, existing),
    ).toBe(true);
    expect(
      isDuplicateMovement({ date: "2026-10-30", amount: eur(-294), concept: "RECIBO SEG. SOCIAL" }, existing),
    ).toBe(false);
  });
});
