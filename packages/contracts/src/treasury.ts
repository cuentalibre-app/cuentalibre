import { z } from "zod";
import { cents, id, isoDate } from "./common";

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
