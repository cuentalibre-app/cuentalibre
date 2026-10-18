import { z } from "zod";

const devDatabaseUrl = "postgres://fiscalia:fiscalia@localhost:5432/fiscalia";
const devSecret = "dev-only-secret-do-not-use-in-production-0000";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url().default(devDatabaseUrl),
    /** Signs sessions and cookies. Generate one with `openssl rand -base64 32`. */
    BETTER_AUTH_SECRET: z.string().min(32).default(devSecret),
    /** Public URL of the API, used in auth callbacks. */
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    /** Origin of the web app, trusted by auth and allowed by CORS. */
    WEB_ORIGIN: z.url().default("http://localhost:5173"),
  })
  .refine((env) => env.NODE_ENV !== "production" || env.BETTER_AUTH_SECRET !== devSecret, {
    message: "BETTER_AUTH_SECRET must be set in production",
    path: ["BETTER_AUTH_SECRET"],
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}
