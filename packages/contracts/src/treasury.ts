import { z } from "zod";
import { cents, id, isoDate } from "./common";

export const movementSourceSchema = z.enum(["import", "manual"]);
export type MovementSource = z.infer<typeof movementSourceSchema>;

export const bankMovementSchema = z.object({
  id,
  /** Treasury account (settings) the movement belongs to. */
  accountId: id,
  date: isoDate,
  /** As the bank writes it: "TRANSFERENCIA DE …", "RECIBO …". */
  concept: z.string(),
  reference: z.string(),
  /** Signed: positive money in, negative money out. */
  amount: cents,
  /** Balance after the movement, when the bank reports it. */
  balance: cents.nullable(),
  source: movementSourceSchema,
  /** Payments (see `TreasuryPayment.key`) this movement is reconciled with. */
  paymentKeys: z.array(z.string()),
});
export type BankMovement = z.infer<typeof bankMovementSchema>;

/** A collection or payment not tied to any invoice or expense: a loan, a transfer to savings, an adjustment… */
export const manualPaymentSchema = z.object({
  id,
  date: isoDate,
  /** Signed: positive for money in. */
  amount: cents,
  paymentMethodId: id,
  description: z.string(),
});
export type ManualPayment = z.infer<typeof manualPaymentSchema>;
