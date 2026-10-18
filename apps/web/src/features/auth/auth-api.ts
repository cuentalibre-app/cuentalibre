import { API_URL } from "./session";

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

export const signIn = (email: string, password: string) => post("/sign-in/email", { email, password });

export const signUp = (name: string, email: string, password: string) =>
  post("/sign-up/email", { name, email, password });

export const signOut = () => post("/sign-out", {});

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
};

/** What to tell the user when signing in, signing up or creating the organization fails. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthError) return MESSAGES[error.code] ?? "Algo ha ido mal. Inténtalo de nuevo.";
  return "No se puede conectar con el servidor. Inténtalo de nuevo.";
}
