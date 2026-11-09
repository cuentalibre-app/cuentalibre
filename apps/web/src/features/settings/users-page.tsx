import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { MailCheck, MoreHorizontal, Pencil, Plus, Power, Send, Trash2, UserRound } from "lucide-react";
import { newId } from "@cuentalibre/core";
import type { CompanyUser, UserKind, UserRole } from "@cuentalibre/contracts";
import { Badge, type BadgeProps } from "@cuentalibre/ui/components/badge";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { DropdownMenuTrigger } from "@cuentalibre/ui/components/dropdown-menu";
import { Input } from "@cuentalibre/ui/components/input";
import { SegmentedControl } from "@cuentalibre/ui/components/segmented-control";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { table } from "@cuentalibre/ui/lib/table";
import { currentBackend } from "@/data/backend";
import { sessionState } from "@/features/auth/session";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { ActionsMenu, EmptyState, IconAction, type Action } from "@/features/sales/list-parts";
import { formatDate } from "@/lib/format";
import { ConfirmDialog, SettingsHeader } from "./settings-parts";
import { useUserSettings } from "./user-store";
import { isExpired, ROLES, roleLabel, toCompanyUser, useUsers, usersStore } from "./users-store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const KINDS: { value: UserKind; label: string }[] = [
  { value: "member", label: "Usuario de la empresa" },
  { value: "advisor", label: "Gestor o asesor" },
];

// Fixed widths so the users and advisors tables line up
const COLUMNS = [
  { label: "Usuario", width: undefined },
  { label: "Acceso a la empresa", width: "w-48" },
  { label: "Último acceso", width: "w-44", demoOnly: true },
  { label: "Fecha expiración", width: "w-40" },
  { label: "Rol", width: "w-40" },
];

function accessStatus(user: CompanyUser): { label: string; tone: BadgeProps["tone"] } {
  if (!user.enabled) return { label: "Desactivado", tone: "neutral" };
  if (isExpired(user)) return { label: "Caducado", tone: "danger" };
  if (user.invited) return { label: "Invitación pendiente", tone: "warning" };
  return { label: "Activo", tone: "success" };
}

/** "17 oct 2026, 19:29" */
function formatAccess(at: string | null): string {
  if (!at) return "Nunca";
  const [date, time] = at.split("T");
  return `${formatDate(date!)}, ${time!.slice(0, 5)}`;
}

function UserDialog({
  open,
  onOpenChange,
  user,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CompanyUser | null;
  /** Kind of a new user, from the table it was created from. */
  kind: UserKind;
}) {
  const users = useUsers();
  const [form, setForm] = useState({
    kind: user?.kind ?? kind,
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? ("standard" as UserRole),
    expiresOn: user?.expiresOn ?? "",
  });
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const owner = user?.owner ?? false;
  // Only invitations can change address: an active user signs in with it
  const emailLocked = user !== null && !user.invited;

  const email = form.email.trim().toLowerCase();
  const errors = {
    name: form.name.trim() ? undefined : "Escribe su nombre o el de la gestoría.",
    email: !email
      ? "Escribe el email al que enviaremos la invitación."
      : !EMAIL_RE.test(email)
        ? "El email no es válido."
        : users.some((u) => u.id !== user?.id && u.email.toLowerCase() === email)
          ? "Ya hay un usuario con este email."
          : undefined,
  };

  const save = () => {
    setSubmitted(true);
    if (errors.name || errors.email) return;
    const values = {
      kind: owner ? "member" : form.kind,
      name: form.name.trim(),
      email,
      role: owner ? "admin" : form.role,
      expiresOn: owner ? null : form.expiresOn || null,
    } satisfies Partial<CompanyUser>;
    if (user) usersStore.updateUser(user.id, values);
    else
      usersStore.addUser({
        id: newId(),
        ...values,
        enabled: true,
        invited: true,
        lastAccessAt: null,
      });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{user ? "Modificar usuario" : "Nuevo usuario"}</DialogTitle>
        <DialogDescription>
          {user
            ? "Cambia su rol o hasta cuándo puede acceder a tu empresa."
            : "Le enviaremos una invitación por email para que acceda a tu empresa con su propio usuario."}
        </DialogDescription>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {!owner && (
            <SegmentedControl
              label="Tipo de acceso"
              options={KINDS}
              value={form.kind}
              onChange={(v) => set("kind", v)}
              className="self-start"
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" required error={submitted ? errors.name : undefined}>
              {(p) => (
                <Input
                  {...p}
                  autoFocus
                  value={form.name}
                  placeholder={form.kind === "advisor" ? "Asesoría Pérez" : "Nombre y apellidos"}
                  onChange={(e) => set("name", e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Email"
              required
              error={submitted ? errors.email : undefined}
              hint={emailLocked ? "Es con el que accede: solo puede cambiarlo esa persona." : undefined}
            >
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  value={form.email}
                  disabled={emailLocked}
                  spellCheck={false}
                  onChange={(e) => set("email", e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field
            label="Rol"
            hint={
              owner ? "Quien creó la empresa es siempre administrador." : ROLES.find((r) => r.value === form.role)?.hint
            }
          >
            {(p) => (
              <GroupedSelect
                {...p}
                value={owner ? "admin" : form.role}
                disabled={owner}
                onChange={(v) => set("role", v as UserRole)}
                groups={[{ options: ROLES }]}
              />
            )}
          </Field>
          {!owner && (
            <Field label="Fecha de expiración" hint="Último día con acceso. Déjala vacía para que no expire.">
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={form.expiresOn}
                  onChange={(e) => set("expiresOn", e.target.value)}
                  className="sm:w-48"
                />
              )}
            </Field>
          )}
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit">{user ? "Guardar" : "Enviar invitación"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UsersTable({
  title,
  description,
  users,
  empty,
  actions,
  onEdit,
  index,
  readOnly = false,
}: {
  title: string;
  description: string;
  users: CompanyUser[];
  empty: { message: string; hint: string; action?: ReactNode };
  actions: (user: CompanyUser) => Action[][];
  onEdit: (user: CompanyUser) => void;
  index: number;
  /** Signed in, members can't be managed yet, and the last access isn't tracked. */
  readOnly?: boolean;
}) {
  const you = useUserSettings().profile.email.toLowerCase();
  const columns = COLUMNS.filter((c) => !(readOnly && c.demoOnly));
  const menu = (u: CompanyUser, size: string) => (
    <ActionsMenu
      groups={actions(u)}
      trigger={
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Más opciones de ${u.name}`} className={cn(size, "px-0")}>
            <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      }
    />
  );

  return (
    <section
      aria-label={title}
      className="flex animate-rise-in flex-col gap-3"
      style={{ "--i": index } as CSSProperties}
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-lg font-semibold tracking-tight lg:text-title">{title}</h2>
        <p className="m-0 text-sm text-muted-foreground">{description}</p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-border">
          <EmptyState {...empty} />
        </div>
      ) : (
        <>
          <div className="relative hidden overflow-x-auto rounded-xl border border-border lg:block">
            <table className="w-full min-w-[56rem] table-fixed border-collapse">
              <thead>
                <tr className={table.headRow}>
                  {columns.map((c) => (
                    <th key={c.label} scope="col" className={cn(table.th, c.width)}>
                      {c.label}
                    </th>
                  ))}
                  {!readOnly && (
                    <th scope="col" className={cn(table.th, "w-24")}>
                      <span className="sr-only">Operaciones</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const status = accessStatus(u);
                  return (
                    <tr key={u.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                      <td className={table.td}>
                        <span className="flex flex-col">
                          <span className="flex items-center gap-2 font-medium">
                            {u.name}
                            {u.email.toLowerCase() === you && (
                              <span className="text-xs font-normal text-muted-foreground">(tú)</span>
                            )}
                          </span>
                          <span className="text-sm text-muted-foreground">{u.email}</span>
                        </span>
                      </td>
                      <td className={table.td}>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </td>
                      {!readOnly && (
                        <td className={cn(table.td, "text-sm whitespace-nowrap")}>{formatAccess(u.lastAccessAt)}</td>
                      )}
                      <td className={cn(table.td, "text-sm whitespace-nowrap")}>
                        {u.expiresOn ? (
                          formatDate(u.expiresOn)
                        ) : (
                          <span className="text-muted-foreground">No expira</span>
                        )}
                      </td>
                      <td className={table.td}>{roleLabel(u.role)}</td>
                      {!readOnly && (
                        <td className={cn(table.td, "whitespace-nowrap")}>
                          <span className="flex justify-end gap-0.5">
                            <IconAction action={{ label: "Editar usuario", icon: Pencil, run: () => onEdit(u) }} />
                            {menu(u, "size-8")}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:hidden">
            {users.map((u) => {
              const status = accessStatus(u);
              return (
                <li key={u.id} className="flex items-start gap-3 rounded-xl border border-border p-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{u.name}</span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <span className="truncate text-sm text-muted-foreground">{u.email}</span>
                    <span className="text-sm">
                      {roleLabel(u.role)}
                      <span className="text-muted-foreground">
                        {" · "}
                        {u.expiresOn ? `Expira el ${formatDate(u.expiresOn)}` : "No expira"}
                      </span>
                    </span>
                    {!readOnly && (
                      <span className="text-xs text-muted-foreground">
                        Último acceso: {formatAccess(u.lastAccessAt)}
                      </span>
                    )}
                  </div>
                  {!readOnly && menu(u, "size-9")}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * Signed in, the organization's real members, without managing them: inviting
 * and changing access come with roles enforced by the API. The demo keeps the
 * sample users and everything you can do with them.
 */
export function UsersPage() {
  return sessionState() === "connected" ? <MembersPage /> : <DemoUsersPage />;
}

function MembersPage() {
  const [members, setMembers] = useState<CompanyUser[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    currentBackend()
      .members?.()
      .then((rows) => setMembers(rows.map(toCompanyUser)))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="flex flex-col gap-6 px-5 pt-6 pb-8 lg:px-8">
      <SettingsHeader title="Gestión de usuarios" description="Las personas que tienen acceso a tu empresa." />
      {error && (
        <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive">
          No se han podido cargar los usuarios. Recarga la página para intentarlo de nuevo.
        </p>
      )}
      {members && (
        <UsersTable
          index={0}
          readOnly
          title="Usuarios con acceso a la empresa"
          description="Tú y quienes trabajan contigo, cada uno con su propio usuario y contraseña."
          users={members}
          actions={() => []}
          onEdit={() => {}}
          empty={{ message: "No hay usuarios", hint: "Invita a quien trabaje contigo." }}
        />
      )}
    </div>
  );
}

function DemoUsersPage() {
  const users = useUsers();
  const [editing, setEditing] = useState<{ user: CompanyUser | null; kind: UserKind } | null>(null);
  const [removing, setRemoving] = useState<CompanyUser | null>(null);
  const [resent, setResent] = useState<string | null>(null);

  const actions = (u: CompanyUser): Action[][] => [
    [
      { label: "Editar usuario", icon: Pencil, run: () => setEditing({ user: u, kind: u.kind }) },
      {
        label: "Reenviar invitación",
        icon: Send,
        run: u.invited && u.enabled ? () => setResent(u.email) : undefined,
      },
      {
        label: u.enabled ? "Desactivar acceso" : "Activar acceso",
        icon: Power,
        run: u.owner ? undefined : () => usersStore.updateUser(u.id, { enabled: !u.enabled }),
      },
    ],
    [{ label: "Quitar acceso", icon: Trash2, danger: true, run: u.owner ? undefined : () => setRemoving(u) }],
  ];

  const members = users.filter((u) => u.kind === "member");
  const advisors = users.filter((u) => u.kind === "advisor");

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-6 px-5 pt-6 pb-8 lg:px-8">
        <SettingsHeader title="Gestión de usuarios" description="Las personas que tienen acceso a tu empresa.">
          <Button onClick={() => setEditing({ user: null, kind: "member" })}>
            <Plus aria-hidden="true" />
            Nuevo usuario
          </Button>
        </SettingsHeader>

        {resent && (
          <p
            role="status"
            className="m-0 flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-sm text-success"
          >
            <MailCheck className="size-4 shrink-0" aria-hidden="true" />
            Hemos reenviado la invitación a {resent}.
          </p>
        )}

        <UsersTable
          index={0}
          title="Usuarios con acceso a la empresa"
          description="Tú y quienes trabajan contigo, cada uno con su propio usuario y contraseña."
          users={members}
          actions={actions}
          onEdit={(u) => setEditing({ user: u, kind: u.kind })}
          empty={{ message: "No hay usuarios", hint: "Invita a quien trabaje contigo." }}
        />

        <UsersTable
          index={1}
          title="Gestores con acceso a la empresa"
          description="Tu gestoría o asesor entra con su propio usuario para revisar tus cuentas y preparar tus impuestos."
          users={advisors}
          actions={actions}
          onEdit={(u) => setEditing({ user: u, kind: u.kind })}
          empty={{
            message: "Ningún gestor tiene acceso",
            hint: "Invita a tu gestoría para que trabaje sobre tus datos sin pedirte archivos.",
            action: (
              <Button variant="secondary" size="md" onClick={() => setEditing({ user: null, kind: "advisor" })}>
                <UserRound aria-hidden="true" />
                Invitar a un gestor
              </Button>
            ),
          }}
        />

        {editing && (
          <UserDialog
            key={editing.user?.id ?? `new-${editing.kind}`}
            open
            onOpenChange={(open) => !open && setEditing(null)}
            user={editing.user}
            kind={editing.kind}
          />
        )}
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Quitar acceso"
          confirmLabel="Quitar acceso"
          danger
          onConfirm={() => removing && usersStore.removeUser(removing.id)}
        >
          <p className="m-0">
            {removing?.name} ({removing?.email}) dejará de poder entrar en tu empresa. Sus documentos y cambios se
            conservan.
          </p>
        </ConfirmDialog>
      </div>
    </TooltipProvider>
  );
}
