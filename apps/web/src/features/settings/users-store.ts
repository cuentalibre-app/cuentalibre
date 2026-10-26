import { toIsoDate } from "@cuentalibre/core";
import type { CompanyUser, OrganizationMember, UserRole } from "@cuentalibre/contracts";
import { createCollection } from "@/data/collection";
import { initialUsers } from "@/mocks/users";
import type { Option } from "@/features/sales/sales-model";

/** Company users. */
const users = createCollection<CompanyUser>("companyUsers", initialUsers);

export const useUsers = users.use;

export const usersStore = {
  addUser: users.add,
  updateUser: users.update,
  /** The owner always keeps access. */
  removeUser: (id: string) => (users.get(id)?.owner ? Promise.resolve() : users.remove(id)),
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

/**
 * A member of the organization as the users page shows them. The API only
 * knows its own roles so far: the owner and admins are administrators, the
 * rest standard users, all of them with access that never expires.
 */
export const toCompanyUser = (member: OrganizationMember): CompanyUser => ({
  id: member.userId,
  kind: "member",
  name: member.name,
  email: member.email,
  role: member.role === "member" ? "standard" : "admin",
  enabled: true,
  invited: false,
  lastAccessAt: null,
  expiresOn: null,
  owner: member.role === "owner",
});
