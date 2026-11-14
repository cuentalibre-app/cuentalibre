import { useSyncExternalStore } from "react";
import { signInMethods } from "@/features/auth/auth-api";

/*
 * The AI help chat: whether its panel is open, and the conversation so far. One store for the
 * desktop panel, its toggle in the page headers and the phone's sheet, so they show the same chat.
 * The conversation lives in memory only; reloading the page starts afresh.
 */

export interface HelpMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

interface HelpChatState {
  open: boolean;
  messages: HelpMessage[];
  /** Waiting for the answer to the last question. */
  pending: boolean;
  /** Why the last question got no answer, for the user. */
  error: string | null;
}

const STORAGE_KEY = "cuentalibre:help-chat-open";

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let state: HelpChatState = { open: readOpen(), messages: [], pending: false, error: null };
let nextId = 1;
const listeners = new Set<() => void>();

function set(patch: Partial<HelpChatState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useHelpChat = () => useSyncExternalStore(subscribe, () => state);

export function setHelpChatOpen(open: boolean) {
  set({ open });
  try {
    localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the panel still opens
  }
}

export const toggleHelpChat = () => setHelpChatOpen(!state.open);

/** Clears the conversation, to ask about something else. */
export const resetHelpChat = () => set({ messages: [], pending: false, error: null });

/** Adds the question to the conversation and asks for its answer. */
export function askHelpChat(text: string) {
  const question = text.trim();
  if (!question || state.pending) return;
  set({ messages: [...state.messages, { id: nextId++, role: "user", text: question }], error: null });
  // The server's endpoint comes next (#103); until then every question ends here.
  set({ error: "El asistente todavía no puede responder en este servidor." });
}

let available = false;
let asked = false;
const availabilityListeners = new Set<() => void>();

/** Asks the API once per load, so toggles on every page don't pop in after each navigation. */
function subscribeAvailability(listener: () => void) {
  availabilityListeners.add(listener);
  if (!asked) {
    asked = true;
    void signInMethods().then((methods) => {
      available = methods.chat;
      availabilityListeners.forEach((l) => l());
    });
  }
  return () => availabilityListeners.delete(listener);
}

/** Whether this instance has the help chat set up (`AI_CHAT_MODEL` on the API); false until it says. */
export const useHelpChatAvailable = () => useSyncExternalStore(subscribeAvailability, () => available);
