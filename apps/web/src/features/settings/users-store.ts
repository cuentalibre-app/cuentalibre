import { useSyncExternalStore } from "react";
import { toIsoDate } from "@fiscalia/core";
import type { CompanyUser, EmailSettings, UserRole } from "@fiscalia/contracts";
import { initialEmailSettings, initialUsers } from "@/mocks/users";
import type { Option } from "@/features/sales/sales-model";

/** Company users and the outgoing email settings, in memory until reload like the other stores. */
interface State {
  users: CompanyUser[];
  email: EmailSettings;
}

let state: State = { users: initialUsers, email: initialEmailSettings };
const listeners = new Set<() => void>();

function commit(changes: Partial<State>) {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useUsers = () => useSyncExternalStore(subscribe, () => state.users);
export const useEmailSettings = () => useSyncExternalStore(subscribe, () => state.email);

export const usersStore = {
  get: () => state,
  addUser: (user: CompanyUser) => commit({ users: [...state.users, user] }),
  updateUser: (id: string, changes: Partial<CompanyUser>) =>
    commit({ users: state.users.map((u) => (u.id === id ? { ...u, ...changes } : u)) }),
  /** The owner always keeps access. */
  removeUser: (id: string) => commit({ users: state.users.filter((u) => u.id !== id || u.owner) }),
  updateEmail: (email: EmailSettings) => commit({ email }),
};

export const ROLES: (Option<UserRole> & { hint: string })[] = [
  { value: "admin", label: "Administrador", hint: "Acceso completo, también a la configuración y los usuarios." },
  { value: "standard", label: "Usuario estándar", hint: "Crea y edita documentos, pero no cambia la configuración." },
  { value: "readOnly", label: "Solo lectura", hint: "Consulta y descarga, sin cambiar nada." },
];

export const roleLabel = (role: UserRole) => ROLES.find((r) => r.value === role)?.label ?? role;

/** Whether access has lapsed: the expiry date is the last day with access. */
export const isExpired = (user: CompanyUser, today = toIsoDate(new Date())) =>
  user.expiresOn !== null && user.expiresOn < today;
