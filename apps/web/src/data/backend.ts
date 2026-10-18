import type { Command } from "./commands";

/**
 * Where commands go. The commands of one call are applied together or not at
 * all, so a change that touches several records can't be half saved.
 */
export interface Backend {
  send(commands: Command[]): Promise<void>;
}

/** Until there is an API, data lives only in memory and every change is accepted. */
export const localBackend: Backend = {
  send: () => Promise.resolve(),
};

let backend: Backend = localBackend;

/** Switches the backend: the API client once there is one, or a fake in tests. */
export function setBackend(next: Backend) {
  backend = next;
}

type ErrorListener = (error: unknown, commands: Command[]) => void;
const errorListeners = new Set<ErrorListener>();

/** Called when the backend rejects a change, after the store has undone it. */
export function onCommandError(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  return () => void errorListeners.delete(listener);
}

/**
 * Sends commands the store has already applied. If the backend rejects them,
 * `undo` takes the store back and the error listeners are told.
 */
export function send(commands: Command[], undo: () => void): Promise<void> {
  if (commands.length === 0) return Promise.resolve();
  return backend.send(commands).catch((error: unknown) => {
    undo();
    errorListeners.forEach((listener) => listener(error, commands));
  });
}
