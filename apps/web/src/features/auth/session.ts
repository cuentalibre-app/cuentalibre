import { SITE_URL } from "@/components/legal-links";
import { connectApi, type ConnectResult } from "@/data/api";

export const SIGN_IN_PATH = "/entrar";
export const SIGN_UP_PATH = "/registro";
export const ONBOARDING_PATH = "/bienvenida";
export const DEMO_PATH = "/demo";
export const FORGOT_PASSWORD_PATH = "/recuperar-contrasena";
/** Where the link to reset a password lands, with `?token=` (or `?error=` if it no longer works). */
export const RESET_PASSWORD_PATH = "/nueva-contrasena";

/**
 * Where the API is, from `VITE_API_URL`: a full URL, or a path such as `/` when the
 * API serves the app from its own origin (self-hosting). Undefined without one.
 */
export function resolveApiUrl(value: string | undefined, origin: string | undefined) {
  if (!value) return undefined;
  const url = value.startsWith("/") && origin ? `${origin}${value}` : value;
  return url.replace(/\/$/, "");
}

/** The API the app signs in to. Without it the app only runs the demo. */
export const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL as string | undefined, globalThis.location?.origin);

/** What the app runs on: the user's data from the API, or the sample data ("demo"). */
export type SessionState = ConnectResult | "demo";

let state: SessionState = "demo";

export const sessionState = () => state;

/** Where the demo was opened from, to go back there when leaving it. */
const DEMO_RETURN_KEY = "cuentalibre:demo-return";

interface DemoReturn {
  /** The page that linked to the demo, if the browser said. */
  from: string | null;
  /** The demo opened in a tab of its own (a link to a new tab): closing it goes back. */
  ownTab: boolean;
}

/** Whether a path is in the demo, which lives under /demo: /demo/ventas/facturas… */
const inDemo = (pathname: string) => pathname === DEMO_PATH || pathname.startsWith(`${DEMO_PATH}/`);

/**
 * The app's routes live under /demo in the demo, so its URLs say so and can be
 * shared or reloaded; the router takes this as its basename.
 */
export const routerBasename = () => (inDemo(window.location.pathname) ? DEMO_PATH : undefined);

/** Forgets where the demo was opened from; the app leaves it by loading a path outside /demo. */
export function leaveDemo() {
  try {
    sessionStorage.removeItem(DEMO_RETURN_KEY);
  } catch {
    // Storage blocked: nothing was stored.
  }
}

/**
 * Decides what the app runs on, before the first render: the demo under /demo
 * (and always without an API); otherwise the API.
 */
export async function startSession() {
  if (routerBasename()) {
    try {
      // Kept from the first visit: reloading has no referrer, and moving around the demo isn't where it came from
      if (!sessionStorage.getItem(DEMO_RETURN_KEY)) {
        const referrer = document.referrer && new URL(document.referrer);
        const from = referrer && !inDemo(referrer.pathname) ? referrer.href : null;
        const back: DemoReturn = { from, ownTab: window.history.length === 1 };
        sessionStorage.setItem(DEMO_RETURN_KEY, JSON.stringify(back));
      }
    } catch {
      // Storage blocked: leaving the demo falls back to the site or the sign-in page.
    }
    state = "demo";
    return;
  }
  state = API_URL ? await connectApi(API_URL, sessionExpired) : "demo";
}

/** Where the session ended, when it ends while the app runs: the sign-in page says so, and comes back. */
function sessionExpired() {
  reloadAt(signInPath({ back: `${window.location.pathname}${window.location.search}`, expired: true }));
}

/** The query of the sign-in page: whether the session ended, and where to go back to after signing in. */
const EXPIRED_PARAM = "caducada";
const BACK_PARAM = "volver";

/** The sign-in page, coming back to `back` (a path in the app) once signed in. */
export function signInPath({ back, expired = false }: { back?: string; expired?: boolean } = {}) {
  const params = new URLSearchParams();
  if (expired) params.set(EXPIRED_PARAM, "1");
  const path = back && returnPath(back);
  if (path && path !== "/") params.set(BACK_PARAM, path);
  const query = params.toString();
  return query ? `${SIGN_IN_PATH}?${query}` : SIGN_IN_PATH;
}

/** What the sign-in page's query says: whether the session ended, and where to go once signed in. */
export function signInQuery(params: URLSearchParams) {
  return { expired: params.get(EXPIRED_PARAM) === "1", back: returnPath(params.get(BACK_PARAM)) };
}

/** A path in this app to go back to; anything else, which could lead to another site, goes home. */
export function returnPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

function demoReturn(): DemoReturn {
  try {
    const stored = sessionStorage.getItem(DEMO_RETURN_KEY);
    if (stored) return JSON.parse(stored) as DemoReturn;
  } catch {
    // Storage blocked or garbled: fall back to the site or the sign-in page.
  }
  return { from: null, ownTab: false };
}

/** Where leaving the demo goes when it can't just close its tab; null when there is nowhere else to go. */
function demoExit(back: DemoReturn) {
  return back.from ?? SITE_URL ?? (API_URL ? SIGN_IN_PATH : null);
}

/** Whether the demo has somewhere to go back to, so it offers to leave. */
export const canExitDemo = () => {
  const back = demoReturn();
  return back.ownTab || demoExit(back) !== null;
};

/**
 * Leaves the demo for where it was opened from: closes its tab when it has one
 * of its own, so the page that opened it shows again, or goes back to that page.
 */
export function exitDemo() {
  const back = demoReturn();
  const exit = demoExit(back);
  leaveDemo();
  if (back.ownTab) window.close();
  // Still here when the browser doesn't let the page close its tab
  if (exit) window.setTimeout(() => window.location.assign(exit), back.ownTab ? 150 : 0);
}

/** Reloads the app at `path`, so it boots again with the new session. */
export function reloadAt(path: string) {
  window.location.assign(path);
}
