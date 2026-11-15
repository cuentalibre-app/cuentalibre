import { useSyncExternalStore } from "react";
import { HELP_CHAT_MAX_MESSAGES, type HelpChatMessage, type HelpChatScreen } from "@cuentalibre/contracts";
import { ApiError } from "@/data/api";
import { currentBackend } from "@/data/backend";
import { signInMethods } from "@/features/auth/auth-api";
import { routerBasename } from "@/features/auth/session";
import { screenPath } from "./screen-path";

/*
 * The AI help chat: whether its panel is open, and the conversation so far. One store for the
 * desktop panel, its toggle in the page headers and the phone's sheet, so they show the same chat.
 * The conversation is mirrored to sessionStorage, so it survives a reload but not closing the tab.
 */

export interface HelpMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

interface HelpChatState {
  /** The panel docked on the right, on desktop; remembered across visits. */
  open: boolean;
  /** The sheet over the page, on phones; never reopens by itself. */
  sheetOpen: boolean;
  messages: HelpMessage[];
  /** Waiting for the answer to the last question. */
  pending: boolean;
  /** Why the last question got no answer, for the user. */
  error: string | null;
}

const STORAGE_KEY = "cuentalibre:help-chat-open";
const MESSAGES_KEY = "cuentalibre:help-chat-messages";

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function readMessages(): HelpMessage[] {
  try {
    return JSON.parse(sessionStorage.getItem(MESSAGES_KEY) ?? "[]") as HelpMessage[];
  } catch {
    return [];
  }
}

let state: HelpChatState = {
  open: readOpen(),
  sheetOpen: false,
  messages: readMessages(),
  pending: false,
  error: null,
};
let nextId = Math.max(0, ...state.messages.map((message) => message.id)) + 1;
const listeners = new Set<() => void>();

function set(patch: Partial<HelpChatState>) {
  const messagesChanged = patch.messages && patch.messages !== state.messages;
  state = { ...state, ...patch };
  if (messagesChanged) {
    try {
      sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(state.messages));
    } catch {
      // Storage blocked: the conversation still lasts until the page reloads
    }
  }
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

export const setHelpChatSheetOpen = (sheetOpen: boolean) => set({ sheetOpen });

/** The `lg` breakpoint in index.css, where the docked panel takes over from the sheet. */
const DESKTOP = "(min-width: 48rem)";

/** Docks or undocks the panel on desktop; opens the sheet on phones. */
export function toggleHelpChat() {
  if (window.matchMedia(DESKTOP).matches) setHelpChatOpen(!state.open);
  else setHelpChatSheetOpen(true);
}

/** Stops the answer on its way, if any. */
let answering: AbortController | null = null;

/** Clears the conversation, to ask about something else or before signing out. */
export function resetHelpChat() {
  answering?.abort();
  answering = null;
  set({ messages: [], pending: false, error: null });
}

/**
 * What the server is sent: the questions that got an answer, each with it, and the last
 * question; the latest ones only, starting with a question, so messages take turns.
 */
export function conversationFor(messages: HelpMessage[]): HelpChatMessage[] {
  const turns: HelpChatMessage[] = [];
  messages.forEach((message, i) => {
    const answered = message.role === "user" && messages[i + 1]?.role === "assistant";
    const last = i === messages.length - 1;
    if (message.role === "assistant" || answered || last) turns.push({ role: message.role, content: message.text });
  });
  const recent = turns.slice(-HELP_CHAT_MAX_MESSAGES);
  return recent[0]?.role === "assistant" ? recent.slice(1) : recent;
}

/**
 * Where the question is asked from, so the answer names the buttons on screen: below the
 * desktop width the app has the phone's tab bar instead of the sidebar.
 */
function currentScreen(): HelpChatScreen {
  const path = screenPath(window.location.pathname.slice(routerBasename()?.length ?? 0) || "/", window.location.search);
  return { device: window.matchMedia(DESKTOP).matches ? "desktop" : "phone", path: path.slice(0, 200) };
}

/** Why a question got no answer, for the user. */
export function helpChatError(error: unknown): string {
  switch (error instanceof ApiError ? error.code : null) {
    case "ai_quota_exceeded":
      return "Has hecho todas las preguntas de hoy. Podrás preguntar de nuevo mañana.";
    case "ai_unavailable":
      return "Este servidor no tiene configurado el asistente.";
    default:
      return "El asistente no ha podido responder. Vuelve a intentarlo en un rato.";
  }
}

/** Adds the question to the conversation and streams its answer into it. */
export async function askHelpChat(text: string) {
  const question = text.trim();
  if (!question || state.pending) return;
  const ask = currentBackend().helpChat;
  set({ messages: [...state.messages, { id: nextId++, role: "user", text: question }], error: null });
  if (!ask) {
    set({ error: helpChatError(new ApiError(503, "ai_unavailable", "No server.")) });
    return;
  }
  const controller = new AbortController();
  answering = controller;
  set({ pending: true });
  const answerId = nextId++;
  try {
    await ask(
      { messages: conversationFor(state.messages), screen: currentScreen() },
      (piece) => {
        if (controller.signal.aborted) return;
        const last = state.messages.at(-1);
        set({
          messages:
            last?.id === answerId
              ? [...state.messages.slice(0, -1), { ...last, text: last.text + piece }]
              : [...state.messages, { id: answerId, role: "assistant", text: piece }],
        });
      },
      controller.signal,
    );
  } catch (error) {
    if (!controller.signal.aborted) set({ error: helpChatError(error) });
  } finally {
    if (answering === controller) {
      answering = null;
      set({ pending: false });
    }
  }
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
