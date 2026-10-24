import { newId } from "@cuentalibre/core";
import type { SyncCommand } from "@cuentalibre/contracts";
import { API_URL, ONBOARDING_PATH, RESET_PASSWORD_PATH, SIGN_IN_PATH, SIGN_UP_PATH } from "./session";

/** Better Auth rejected the request; `code` says why. */
export class AuthError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function post<R>(path: string, body: unknown): Promise<R> {
  const response = await fetch(`${API_URL}/v1/auth${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as { code?: string } | null;
  if (!response.ok) throw new AuthError(data?.code ?? `HTTP_${response.status}`);
  return data as R;
}

async function get<R>(path: string): Promise<R> {
  const response = await fetch(`${API_URL}/v1/auth${path}`, { credentials: "include" });
  const data = (await response.json().catch(() => null)) as { code?: string } | null;
  if (!response.ok) throw new AuthError(data?.code ?? `HTTP_${response.status}`);
  return data as R;
}

export const signIn = (email: string, password: string) => post("/sign-in/email", { email, password });

/** On instances that send email, the API also sends a code to verify it. */
export const signUp = (name: string, email: string, password: string) =>
  post("/sign-up/email", { name, email, password });

/** Sends the signed-in user a new code to verify their email; the previous one stops working. */
export const sendVerificationEmail = (email: string) => post("/send-verification-email", { email });

/** Verifies the email with the code sent to it. Each code allows three tries. */
export const verifyEmail = (email: string, otp: string) => post("/email-otp/verify-email", { email, otp });

/** Sends a code to `newEmail`, to switch the account to it; nothing arrives if it has an account already. */
export const requestEmailChange = (newEmail: string) => post("/email-otp/request-email-change", { newEmail });

/** Switches the account to `newEmail`, verified, with the code sent to it. */
export const changeEmail = (newEmail: string, otp: string) => post("/email-otp/change-email", { newEmail, otp });

/** Emails a link to choose a new password, if the email has an account; the answer is the same either way. */
export const requestPasswordReset = (email: string) =>
  post("/request-password-reset", { email, redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}` });

/** Sets the new password with the token from the emailed link; every session ends. */
export const resetPassword = (token: string, newPassword: string) => post("/reset-password", { token, newPassword });

/** Changes the signed-in user's password, checking the current one; sessions on other devices end. */
export const changePassword = (currentPassword: string, newPassword: string) =>
  post("/change-password", { currentPassword, newPassword, revokeOtherSessions: true });

/**
 * Goes to Google to sign in. Only the sign-up screen creates new users, as
 * people accept the terms there; Google brings them back to `error` if it fails.
 */
export async function signInWithGoogle(intent: "sign-in" | "sign-up") {
  const origin = window.location.origin;
  const { url } = await post<{ url: string }>("/sign-in/social", {
    provider: "google",
    callbackURL: `${origin}/`,
    newUserCallbackURL: `${origin}${ONBOARDING_PATH}`,
    errorCallbackURL: `${origin}${intent === "sign-up" ? SIGN_UP_PATH : SIGN_IN_PATH}`,
    requestSignUp: intent === "sign-up",
  });
  window.location.assign(url);
}

/** A way the signed-in user can sign in: `credential` (email and password) or a provider such as `google`. */
export interface LinkedAccount {
  id: string;
  providerId: string;
}

export const linkedAccounts = () => get<LinkedAccount[]>("/list-accounts");

/**
 * Goes to Google to link it to the signed-in user, who has proven they own the
 * account with their password; Google must use the same email. Comes back to
 * `returnPath`, with `?vinculada=google` or `?error=`.
 */
export async function linkGoogle(returnPath: string) {
  const origin = window.location.origin;
  const { url } = await post<{ url: string }>("/link-social", {
    provider: "google",
    callbackURL: `${origin}${returnPath}?vinculada=google`,
    errorCallbackURL: `${origin}${returnPath}`,
  });
  window.location.assign(url);
}

/** Better Auth refuses to unlink the user's only way in. */
export const unlinkAccount = (accountId: string) => post("/unlink-account", { accountId });

/**
 * What this instance offers besides email and password: Google, and email
 * (verifying it, resetting a forgotten password). Nothing extra if the API can't say.
 */
export interface SignInMethods {
  google: boolean;
  email: boolean;
}

let methods: Promise<SignInMethods> | undefined;

/** Asked once per load: several parts of a screen want it. */
export const signInMethods = () => (methods ??= fetchSignInMethods());

async function fetchSignInMethods(): Promise<SignInMethods> {
  try {
    const response = await fetch(`${API_URL}/v1/sign-in-methods`);
    if (response.ok) return (await response.json()) as SignInMethods;
  } catch {
    // Unreachable API: the screen still offers email and password.
  }
  methods = undefined;
  return { google: false, email: false };
}

export const signOut = () => post("/sign-out", {});

/**
 * The signed-in user; `hasPassword` is false for people who only sign in with
 * Google, who come verified, and then `passwordChangedAt` is null.
 */
export async function currentUser() {
  const response = await fetch(`${API_URL}/v1/me`, { credentials: "include" });
  if (!response.ok) throw new AuthError(`HTTP_${response.status}`);
  const { user } = (await response.json()) as {
    user: { email: string; emailVerified: boolean; hasPassword: boolean; passwordChangedAt: string | null };
  };
  return user;
}

/**
 * Deletes the account for good, after checking the password (or, for users
 * without one, that they signed in recently); the session ends with it.
 */
export async function deleteAccount(password?: string) {
  const response = await fetch(`${API_URL}/v1/me`, {
    method: "DELETE",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (response.ok) return;
  const data = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
  throw new AuthError(data?.error?.code ?? `HTTP_${response.status}`);
}

/** Creates the user's organization, which becomes the session's active one. */
export const createOrganization = (name: string) => post("/organization/create", { name, slug: slugFor(name) });

/** Saves settings of the session's active organization before the app, and its data layer, loads. */
export async function saveSettings(commands: SyncCommand[]) {
  const response = await fetch(`${API_URL}/v1/commands`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ commands }),
  });
  if (!response.ok) throw new AuthError(`HTTP_${response.status}`);
}

/** A unique, URL-safe slug; users never see it. */
export function slugFor(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  // crypto.randomUUID only exists on HTTPS and localhost; the tail of a UUIDv7 is random
  return `${base || "empresa"}-${newId().slice(-8)}`;
}

export const MIN_PASSWORD_LENGTH = 8;

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "El email o la contraseña no son correctos.",
  USER_ALREADY_EXISTS: "Ya hay una cuenta con este email. Entra con tu contraseña.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya hay una cuenta con este email. Entra con tu contraseña.",
  INVALID_EMAIL: "El email no es válido.",
  PASSWORD_TOO_SHORT: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  wrong_password: "La contraseña no es correcta.",
  INVALID_PASSWORD: "La contraseña actual no es correcta.",
  session_not_fresh:
    "Por seguridad, sal y vuelve a entrar con Google. Después tendrás 10 minutos para eliminar la cuenta.",
  // Google sign-in sends these back in the URL
  signup_disabled: "No hay ninguna cuenta con esta cuenta de Google. Créala primero.",
  account_not_linked:
    "Ya tienes cuenta con este email. Entra con tu contraseña y vincula Google desde Configuración › Credenciales de acceso.",
  email_does_not_match: "Esa cuenta de Google usa otro email. Vincula la que tenga el mismo email que tu cuenta.",
  account_already_linked_to_different_user: "Esa cuenta de Google ya está vinculada a otro usuario.",
  FAILED_TO_UNLINK_LAST_ACCOUNT: "Es tu única forma de entrar, así que no puedes desvincularla.",
  SESSION_NOT_FRESH: "Por seguridad, sal y vuelve a entrar antes de desvincularla.",
  // The link to reset a password sends these back
  INVALID_TOKEN: "El enlace no es válido o ya se ha usado. Pide otro.",
  TOKEN_EXPIRED: "El enlace ha caducado. Pide otro.",
  EMAIL_ALREADY_VERIFIED: "Tu email ya está verificado.",
  // Codes to verify an email
  INVALID_OTP: "El código no es correcto. Revísalo o pide otro.",
  OTP_EXPIRED: "El código ha caducado. Pide otro.",
  TOO_MANY_ATTEMPTS: "Has fallado el código demasiadas veces. Pide otro.",
  RESET_PASSWORD_DISABLED: "Este servidor no puede enviar emails, así que no puede restablecer contraseñas.",
  VERIFICATION_EMAIL_NOT_ENABLED: "Este servidor no puede enviar emails.",
  sole_owner:
    "Eres el único propietario de una empresa que tiene más usuarios. Quítalos o haz propietario a otro antes de eliminar tu cuenta.",
};

/** What to tell the user when Google, or the link to reset a password, sent them back with `?error=`; nothing if they cancelled. */
export function oauthErrorMessage(code: string | null): string | null {
  if (!code || code === "access_denied") return null;
  return authErrorMessage(new AuthError(code));
}

/** What to tell the user when signing in, signing up or creating the organization fails. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthError) return MESSAGES[error.code] ?? "Algo ha ido mal. Inténtalo de nuevo.";
  return "No se puede conectar con el servidor. Inténtalo de nuevo.";
}
