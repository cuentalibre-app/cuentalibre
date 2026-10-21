import { connectApi, type ConnectResult } from "@/data/api";

export const SIGN_IN_PATH = "/entrar";
export const SIGN_UP_PATH = "/registro";
export const ONBOARDING_PATH = "/bienvenida";
export const DEMO_PATH = "/demo";

/** The API the app signs in to. Without it the app only runs the demo. */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");

/** What the app runs on: the user's data from the API, or the sample data ("demo"). */
export type SessionState = ConnectResult | "demo";

let state: SessionState = "demo";

export const sessionState = () => state;

const DEMO_KEY = "cuentalibre:demo";

function isDemoRequested() {
  try {
    return sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

/** Stops the demo; the next load goes to the API. */
export function leaveDemo() {
  try {
    sessionStorage.removeItem(DEMO_KEY);
  } catch {
    // Storage blocked: the demo flag was never stored either.
  }
}

/**
 * Decides what the app runs on, before the first render. Opening /demo starts
 * the demo for this tab; otherwise the app connects to the API if there is one.
 */
export async function startSession() {
  if (window.location.pathname === DEMO_PATH) {
    try {
      sessionStorage.setItem(DEMO_KEY, "1");
    } catch {
      // Storage blocked: the demo lasts until the next reload.
    }
    state = "demo";
    return;
  }
  state = API_URL && !isDemoRequested() ? await connectApi(API_URL) : "demo";
}

/** Reloads the app at `path`, so it boots again with the new session. */
export function reloadAt(path: string) {
  window.location.assign(path);
}
