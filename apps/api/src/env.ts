import { z } from "zod";

const devDatabaseUrl = "postgres://cuentalibre:cuentalibre@localhost:5432/cuentalibre";
const devSecret = "dev-only-secret-do-not-use-in-production-0000";

const STRIPE_VARIABLES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_MONTHLY",
  "STRIPE_PRICE_QUARTERLY",
  "STRIPE_PRICE_YEARLY",
  "STRIPE_TAX_RATE",
] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url().default(devDatabaseUrl),
    /** Signs sessions and cookies. Generate one with `openssl rand -base64 32`. */
    BETTER_AUTH_SECRET: z.string().min(32).default(devSecret),
    /** Public URL of the API, used in auth callbacks. Defaults to `PUBLIC_URL`. */
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    /** Origin of the web app, trusted by auth and allowed by CORS. Defaults to `PUBLIC_URL`. */
    WEB_ORIGIN: z.url().default("http://localhost:5173"),
    /**
     * The built web app (`apps/web/dist`), served from the API's own origin with a
     * fallback to `index.html`. Self-hosting sets it; without it the API serves only `/v1`.
     */
    WEB_DIR: z.string().min(1).optional(),
    /** Google sign-in, from an OAuth client in Google Cloud. Without them it is off. */
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
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
      .default(10 * 1024 * 1024),
    /**
     * Most bytes an organization's files may take in all, so an account or API key
     * can't fill the storage. 0 means no limit.
     */
    FILE_QUOTA_BYTES: z.coerce
      .number()
      .int()
      .min(0)
      .default(1024 * 1024 * 1024),

    /**
     * Rejects new passwords found in data breaches, asking Have I Been Pwned with the first
     * five characters of their hash. Turn it off on servers that can't reach the internet.
     */
    PASSWORD_BREACH_CHECK: z.enum(["on", "off"]).default("on"),
    /** Outgoing email server, e.g. `smtps://user:password@smtp.example.com:465`. Without it, email is off. */
    SMTP_URL: z.url().optional(),
    /** Address emails are sent from; the business's name goes as the sender's name. */
    EMAIL_FROM: z.email().optional(),
    /** Address emails about people's accounts (verifying an email, resetting a password) are sent from; defaults to `EMAIL_FROM`. */
    ACCOUNT_EMAIL_FROM: z.email().optional(),
    /**
     * Most recipients (to and cc) an organization's emails reach in a day and in 30 days, so
     * a stolen or fake account can't send spam from the instance's domain. 0 means no limit.
     */
    EMAIL_DAILY_RECIPIENTS: z.coerce.number().int().min(0).default(50),
    EMAIL_MONTHLY_RECIPIENTS: z.coerce.number().int().min(0).default(500),
    /** Sends every email to this address instead of its recipients, so staging never writes to real people. */
    EMAIL_REDIRECT_TO: z.email().optional(),
    /** Sends unexpected errors to Sentry (no request data or users). Without it, errors only go to the log. */
    SENTRY_DSN: z.url().optional(),
    /** The version errors are tagged with; the image build sets it to the commit, or leaves it empty. */
    SENTRY_RELEASE: z.string().optional(),
    /**
     * Reading received invoices and receipts with an AI model. Without `AI_MODEL` it is off.
     * `AI_BASE_URL` points at any OpenAI-compatible API (Ollama, OpenRouter, LM Studio…) or
     * at Anthropic's; without it, an Anthropic key (`sk-ant-`) goes to Anthropic and any
     * other to OpenAI. The key never leaves the server; local models don't need one.
     */
    AI_MODEL: z.string().min(1).optional(),
    AI_API_KEY: z.string().min(1).optional(),
    AI_BASE_URL: z.url().optional(),
    /**
     * Most documents an organization may have read with AI in a calendar month (Spain's
     * time). Reading a file already read doesn't count. Unset or 0 means no limit.
     */
    AI_MONTHLY_DOCUMENTS: z.coerce.number().int().min(0).default(0),
    /**
     * The model's prices in dollars per million input and output tokens, to estimate
     * what each reading costs the instance. Without them, only tokens are recorded.
     */
    AI_INPUT_PRICE: z.coerce.number().min(0).optional(),
    AI_OUTPUT_PRICE: z.coerce.number().min(0).optional(),
    /**
     * Charging for Cloud with Stripe: all of them, or none and billing is off. The prices are
     * the product's three periods; the tax rate, the VAT added on top of them.
     */
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_PRICE_MONTHLY: z.string().min(1).optional(),
    STRIPE_PRICE_QUARTERLY: z.string().min(1).optional(),
    STRIPE_PRICE_YEARLY: z.string().min(1).optional(),
    STRIPE_TAX_RATE: z.string().min(1).optional(),
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
  )
  .refine((env) => !env.GOOGLE_CLIENT_ID === !env.GOOGLE_CLIENT_SECRET, {
    message: "Google sign-in needs both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
    path: ["GOOGLE_CLIENT_ID"],
  })
  .refine((env) => !env.SMTP_URL || env.EMAIL_FROM, {
    message: "SMTP_URL needs EMAIL_FROM",
    path: ["EMAIL_FROM"],
  })
  .refine((env) => !env.AI_MODEL || env.AI_BASE_URL || env.AI_API_KEY, {
    message: "AI_MODEL needs AI_API_KEY for OpenAI or Anthropic, or AI_BASE_URL for another provider",
    path: ["AI_API_KEY"],
  })
  .refine((env) => new Set(STRIPE_VARIABLES.map((name) => Boolean(env[name]))).size === 1, {
    message: `Billing needs all of ${STRIPE_VARIABLES.join(", ")}, or none of them`,
    path: ["STRIPE_SECRET_KEY"],
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Reads the environment. Self-hosting serves the app and the API from one origin, so
 * `PUBLIC_URL` (the address people open, e.g. `https://cuentas.example.com`) stands
 * for both `BETTER_AUTH_URL` and `WEB_ORIGIN`; either can still be set on its own.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const publicUrl = source.PUBLIC_URL?.replace(/\/$/, "") || undefined;
  return envSchema.parse({
    ...source,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL || publicUrl,
    WEB_ORIGIN: source.WEB_ORIGIN || publicUrl,
  });
}
