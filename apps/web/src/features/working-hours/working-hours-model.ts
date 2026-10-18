import type { EntryError } from "@fiscalia/core";
import type { Worker } from "@fiscalia/contracts";
import { workers } from "@/mocks/working-hours";

export const WORKING_HOURS_PATH = "/jornada";
export const WORKED_HOURS_PATH = "/informes/horas-trabajadas";

export const ENTRY_ERRORS: Record<EntryError, string> = {
  endBeforeStart: "La salida tiene que ser posterior a la entrada.",
  future: "No se pueden registrar horas que todavía no han llegado.",
  openEntry: "Tiene una entrada sin salida. Registra antes la salida de ese tramo.",
  overlap: "Se solapa con otro tramo registrado de la misma persona.",
};

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

/** "jueves" for an ISO date. */
export const weekdayName = (isoDate: string) => WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()]!;

/** Local date-time as "YYYY-MM-DDTHH:mm", the format of the entries and of datetime-local inputs. */
export function toLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const byId = new Map(workers.map((w) => [w.id, w]));

export const workerOf = (id: string): Worker | undefined => byId.get(id);
export const workerName = (id: string) => byId.get(id)?.name ?? "Persona eliminada";

/** The person whose day the overview opens with: the owner. */
export const defaultWorkerId = workers.find((w) => w.owner)?.id ?? workers[0]!.id;

export const workerOptions = (all?: string) => [
  ...(all ? [{ value: "all", label: all }] : []),
  ...workers.map((w) => ({ value: w.id, label: w.name })),
];
