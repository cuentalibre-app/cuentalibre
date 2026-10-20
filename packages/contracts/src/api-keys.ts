import { z } from "zod";

/** An API key, for scripts and agents. It acts as the user who created it, in one organization. */
export const apiKeySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** First characters of the key, to recognize it. */
  start: z.string(),
  createdAt: z.iso.datetime(),
  /** Null never expires. */
  expiresAt: z.iso.datetime().nullable(),
  lastUsedAt: z.iso.datetime().nullable(),
});
export type ApiKey = z.infer<typeof apiKeySchema>;

export const newApiKeySchema = z.object({
  name: z.string().trim().min(1).max(32),
  /** Days until it expires; without it, it never does. */
  expiresInDays: z.int().min(1).max(365).optional(),
});
export type NewApiKey = z.infer<typeof newApiKeySchema>;

/** A key just created: the only time its secret is shown. */
export const createdApiKeySchema = apiKeySchema.extend({ key: z.string() });
export type CreatedApiKey = z.infer<typeof createdApiKeySchema>;
