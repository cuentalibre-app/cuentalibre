import type { Cents } from "@cuentalibre/core";
import { z } from "zod";

/**
 * Record ID. New records get a UUIDv7 (`newId()` in core); the sample data still
 * uses short readable IDs, so this becomes `z.uuid({ version: "v7" })` once the
 * mocks are turned into seed data with real UUIDs.
 */
export const id = z.string().min(1);

/** ISO date, "2026-10-18". */
export const isoDate = z.iso.date();

/** Local date and time without a time zone, "2026-10-17T19:29". */
export const localDateTime = z.iso.datetime({ local: true });

/** Whole euro cents (see money.ts in core). */
export const cents = z.int().transform((value) => value as Cents);

/** A rate as a fraction: 0.21 is 21 %. */
export const fraction = z.number().min(0).max(1);

/** A whole percentage from 0 to 100. */
export const percentage = z.int().min(0).max(100);

/** A color as #rrggbb. */
export const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

export const attachmentSchema = z.object({
  id,
  name: z.string(),
  /** Bytes. */
  size: z.int().nonnegative(),
  /**
   * Object URL of the file picked in this session. Only the browser keeps it:
   * the server stores the file under the attachment's ID (see `/v1/files`).
   */
  url: z.string().optional(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

/** A payment of a received invoice, or a collection of an issued one. */
export const paymentSchema = z.object({
  id,
  date: isoDate,
  /** A credit note or rectifying invoice has negative payments (refunds). */
  amount: cents,
  paymentMethodId: id,
});
export type Payment = z.infer<typeof paymentSchema>;

/** Where a rented property is, as forms 115 and 180 ask. */
export const rentalLocationSchema = z.enum(["spain", "basqueCountry", "navarre", "noCadastralRef", "abroad"]);
export type RentalLocation = z.infer<typeof rentalLocationSchema>;
