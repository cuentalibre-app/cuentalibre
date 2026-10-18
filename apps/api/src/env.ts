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
    /** Where uploaded files go: a local directory, or an S3-compatible bucket. */
    STORAGE_DRIVER: z.enum(["disk", "s3"]).default("disk"),
    /** For the disk driver. Relative paths start at the working directory. */
    STORAGE_DIR: z.string().min(1).default("./data/files"),
    S3_ENDPOINT: z.url().optional(),
    S3_BUCKET: z.string().min(1).optional(),
    S3_REGION: z.string().min(1).default("auto"),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    /** Largest file that can be uploaded, in bytes. */
    FILE_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(25 * 1024 * 1024),
  })
  .refine((env) => env.NODE_ENV !== "production" || env.BETTER_AUTH_SECRET !== devSecret, {
    message: "BETTER_AUTH_SECRET must be set in production",
    path: ["BETTER_AUTH_SECRET"],
  })
  .refine(
    (env) =>
      env.STORAGE_DRIVER !== "s3" ||
      (env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY),
    {
      message: "The s3 storage driver needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY",
      path: ["STORAGE_DRIVER"],
    },
  );

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}
