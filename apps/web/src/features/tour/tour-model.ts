import type { TourStatus } from "@cuentalibre/contracts";
import { createStore } from "@/data/store";
import type { SessionState } from "@/features/auth/session";
import { BUSINESS_PATH } from "@/features/settings/settings-model";
import { userStore } from "@/features/settings/user-store";

export interface TourStep {
  title: string;
  body: string;
  /**
   * The elements the step points at, by their `data-tour` attribute: the first
   * one on screen wins, so a step can name the sidebar's entry and the bottom
   * bar's. Without any, the step shows in the middle of the screen.
   */
  targets: string[];
  /** A link that ends the tour and takes the user somewhere. */
  action?: { label: string; to: string };
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Te damos la bienvenida",
    body: "Lo básico en un minuto. Puedes saltarlo cuando quieras.",
    targets: [],
  },
  {
    title: "Inicio",
    body: "Tu negocio de un vistazo: lo que facturas y gastas, lo que te queda limpio y los próximos plazos de impuestos.",
    targets: ["/"],
  },
  {
    title: "Ventas",
    body: "Crea facturas, presupuestos y albaranes. Un borrador lo cambias cuanto quieras; al emitir la factura recibe su número y ya cuenta para tus impuestos.",
    targets: ["/ventas"],
  },
  {
    title: "Compras y gastos",
    body: "Registra un gasto o una factura recibida con el botón Crear en cuanto te llegue: resta de tu beneficio y su IVA se deduce.",
    targets: ["/compras", "crear"],
  },
  {
    title: "Impuestos",
    body: "El IVA y el IRPF del trimestre, calculados con lo que registras, y el calendario de cada modelo que te toca presentar.",
    targets: ["/impuestos"],
  },
  {
    title: "Configuración",
    body: "Antes de facturar, completa tu NIF y tu dirección.",
    targets: ["/configuracion", "/mas"],
    action: { label: "Completar los datos de la empresa", to: BUSINESS_PATH },
  },
];

/** Whether the tour is on screen, and at which step. Only this tab knows. */
const tour = createStore({ open: false, step: 0 });

export const useTour = tour.use;
export const tourState = tour.get;

export function startTour() {
  tour.set({ open: true, step: 0 });
}

export function goToStep(step: number) {
  tour.set({ open: true, step: Math.max(0, Math.min(step, TOUR_STEPS.length - 1)) });
}

/** In the demo the tour shows once per visit, remembered by the tab; signed in, by the account. */
const DEMO_TOUR_KEY = "cuentalibre:demo-tour";

function demoTourSeen() {
  try {
    return sessionStorage.getItem(DEMO_TOUR_KEY) !== null;
  } catch {
    // Storage blocked: showing it again on reload is fine.
    return false;
  }
}

/** Closes the tour and remembers it was finished or skipped, so it doesn't start by itself again. */
export function endTour(status: Exclude<TourStatus, "pending">, session: SessionState) {
  tour.set({ open: false, step: 0 });
  if (session === "demo") {
    try {
      sessionStorage.setItem(DEMO_TOUR_KEY, status);
    } catch {
      // Storage blocked: it may show again on reload.
    }
  } else if (userStore.get().tour.status !== status) {
    void userStore.setTourStatus(status);
  }
}

/** Whether the tour should start by itself: the first time the user, or a visit to the demo, enters the app. */
export function shouldStartTour(session: SessionState, status: TourStatus) {
  return session === "demo" ? !demoTourSeen() : status === "pending";
}

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Room left between the card and the screen's edges, and between the card and what it points at. */
const EDGE = 16;
const GAP = 14;

/**
 * Where the card of a step goes: beside what it points at when there's room
 * (to the right of the sidebar), else above it (the bottom bar on phones) or
 * below it, and always inside the screen. Without a target, centered.
 */
export function placeCard(
  target: Box | null,
  card: { width: number; height: number },
  screen: { width: number; height: number },
) {
  const clamp = (value: number, size: number, room: number) => Math.max(EDGE, Math.min(value, room - size - EDGE));
  if (!target) {
    return {
      top: clamp((screen.height - card.height) / 2, card.height, screen.height),
      left: clamp((screen.width - card.width) / 2, card.width, screen.width),
    };
  }
  const right = target.left + target.width + GAP;
  if (right + card.width + EDGE <= screen.width) {
    return { top: clamp(target.top + target.height / 2 - card.height / 2, card.height, screen.height), left: right };
  }
  const centeredLeft = clamp(target.left + target.width / 2 - card.width / 2, card.width, screen.width);
  const above = target.top - GAP - card.height;
  if (above >= EDGE) return { top: above, left: centeredLeft };
  return { top: clamp(target.top + target.height + GAP, card.height, screen.height), left: centeredLeft };
}
