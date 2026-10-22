import { API_URL, ONBOARDING_PATH, SIGN_IN_PATH, SIGN_UP_PATH } from "./session";

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

export const signUp = (name: string, email: string, password: string) =>
  post("/sign-up/email", { name, email, password });

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

/** How people can sign in to this instance besides email and password; nothing extra if the API can't say. */
export async function signInMethods(): Promise<{ google: boolean }> {
  try {
    const response = await fetch(`${API_URL}/v1/sign-in-methods`);
    if (response.ok) return (await response.json()) as { google: boolean };
  } catch {
    // Unreachable API: the screen still offers email and password.
  }
  return { google: false };
}

export const signOut = () => post("/sign-out", {});

/** The signed-in user; `hasPassword` is false for people who only sign in with Google. */
export async function currentUser() {
  const response = await fetch(`${API_URL}/v1/me`, { credentials: "include" });
  if (!response.ok) throw new AuthError(`HTTP_${response.status}`);
  const { user } = (await response.json()) as { user: { email: string; hasPassword: boolean } };
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

/** A unique, URL-safe slug; users never see it. */
export function slugFor(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "empresa"}-${crypto.randomUUID().slice(0, 8)}`;
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
  sole_owner:
    "Eres el único propietario de una empresa que tiene más usuarios. Quítalos o haz propietario a otro antes de eliminar tu cuenta.",
};

/** What to tell the user when Google sign-in sent them back with `?error=`; nothing if they cancelled. */
export function oauthErrorMessage(code: string | null): string | null {
  if (!code || code === "access_denied") return null;
  return authErrorMessage(new AuthError(code));
}

/** What to tell the user when signing in, signing up or creating the organization fails. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthError) return MESSAGES[error.code] ?? "Algo ha ido mal. Inténtalo de nuevo.";
  return "No se puede conectar con el servidor. Inténtalo de nuevo.";
}
