import { APIError, createAuthMiddleware } from "better-auth/api";
import { isPasswordCompromised } from "better-auth/plugins";

/** The error code for a password found in a data breach; the web app knows it. */
export const BREACHED_PASSWORD = "PASSWORD_COMPROMISED";
export const BREACHED_PASSWORD_MESSAGE =
  "This password has appeared in a data breach, so it's among the first ones attackers try. Choose another.";

/** Better Auth's routes that set a new password, and the field that carries it. */
const PASSWORD_FIELDS: Record<string, string> = {
  "/sign-up/email": "password",
  "/change-password": "newPassword",
  "/reset-password": "newPassword",
};

/** How long to wait for Have I Been Pwned before accepting the password. */
const CHECK_TIMEOUT_MS = 3000;

/**
 * Whether the password is in Have I Been Pwned's list of breached passwords. Only the first
 * five characters of its SHA-1 hash leave the server. If the service can't be reached in time
 * the password is accepted: it is a safeguard, and signing up mustn't depend on it.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`No answer in ${CHECK_TIMEOUT_MS} ms`)), CHECK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([isPasswordCompromised(password), timeout]);
  } catch (error) {
    console.warn("Could not check the password against Have I Been Pwned:", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Rejects breached passwords on Better Auth's routes that set one. */
export function rejectBreachedPasswords() {
  return createAuthMiddleware(async (ctx) => {
    const field = PASSWORD_FIELDS[ctx.path];
    const password = field && (ctx.body as Record<string, unknown> | undefined)?.[field];
    if (typeof password !== "string" || !(await isBreachedPassword(password))) return;
    throw new APIError("BAD_REQUEST", { code: BREACHED_PASSWORD, message: BREACHED_PASSWORD_MESSAGE });
  });
}
