import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router";
import { BellRing, ImageUp, Trash2 } from "lucide-react";
import type { Gender, NotificationPrefs, UserProfile } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Input } from "@cuentalibre/ui/components/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { authErrorMessage, currentUser, deleteAccount } from "@/features/auth/auth-api";
import { ForgotPasswordLink } from "@/features/auth/forgot-password-link";
import { SIGN_IN_PATH, reloadAt, sessionState } from "@/features/auth/session";
import { CheckField, Field, GroupedSelect, Section } from "@/features/sales/form-fields";
import type { Option } from "@/features/sales/sales-model";
import { EXPORT_PATH } from "@/features/transfer/transfer-model";
import { SaveButton, SettingsHeader, useDraft } from "./settings-parts";
import { initials } from "./settings-model";
import { userFullName, userStore, useUserSettings } from "./user-store";

const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024;

/** Radix Select can't hold an empty value: this stands for it. */
const UNSET = "default";

const GENDERS: Option<Exclude<Gender, "">>[] = [
  { value: "male", label: "Hombre" },
  { value: "female", label: "Mujer" },
];

export function ProfilePage() {
  const connected = sessionState() === "connected";
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
        <SettingsHeader
          title="Datos personales"
          description="Tus datos como usuario de cuentalibre, no los de tu empresa."
        />
        <PersonalSection />
        {/* Nothing sends these notifications yet: only the demo shows them */}
        {!connected && <NotificationsSection />}
        {/* The demo has no account to delete */}
        {connected && <DeleteAccountSection />}
      </div>
    </TooltipProvider>
  );
}

/* Each section saves on its own, so a change to the notifications doesn't wait on the profile. */

function PersonalSection() {
  const saved = useUserSettings().profile;
  const { draft, set, dirty, justSaved, markSaved } = useDraft<UserProfile>(saved);
  const [showErrors, setShowErrors] = useState(false);
  const errors = {
    firstName: draft.firstName.trim() ? undefined : "Introduce tu nombre.",
  };

  const save = () => {
    if (errors.firstName) return setShowErrors(true);
    userStore.updateProfile(draft);
    setShowErrors(false);
    markSaved();
  };

  return (
    <Section
      title="Datos personales"
      index={0}
      action={<SaveButton dirty={dirty} justSaved={justSaved} onSave={save} />}
    >
      <p className="m-0 text-sm">
        <span className="text-muted-foreground">Email de contacto: </span>
        <span className="font-medium">{draft.email}</span>
      </p>
      {/* The picture isn't stored yet: only the demo shows it */}
      {sessionState() !== "connected" && (
        <AvatarField name={userFullName(draft)} url={draft.avatarUrl} onChange={(url) => set("avatarUrl", url)} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required error={showErrors ? errors.firstName : undefined}>
          {(p) => (
            <Input
              {...p}
              value={draft.firstName}
              autoComplete="given-name"
              onChange={(e) => set("firstName", e.target.value)}
            />
          )}
        </Field>
        <Field label="Apellidos">
          {(p) => (
            <Input
              {...p}
              value={draft.lastName}
              autoComplete="family-name"
              onChange={(e) => set("lastName", e.target.value)}
            />
          )}
        </Field>
        <Field label="Fecha de nacimiento">
          {(p) => (
            <Input
              {...p}
              type="date"
              value={draft.birthDate}
              autoComplete="bday"
              onChange={(e) => set("birthDate", e.target.value)}
            />
          )}
        </Field>
        <Field label="Teléfono">
          {(p) => (
            <Input
              {...p}
              type="tel"
              value={draft.phone}
              autoComplete="tel"
              onChange={(e) => set("phone", e.target.value)}
            />
          )}
        </Field>
        <Field label="Género">
          {(p) => (
            <GroupedSelect
              {...p}
              value={draft.gender || UNSET}
              onChange={(v) => set("gender", v === UNSET ? "" : (v as Gender))}
              groups={[{ options: [{ value: UNSET, label: "Prefiero no decirlo" }, ...GENDERS] }]}
            />
          )}
        </Field>
      </div>
    </Section>
  );
}

/** Profile picture, kept in memory as an object URL until there is a backend. */
function AvatarField({
  name,
  url,
  onChange,
}: {
  name: string;
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const accept = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("La imagen debe ser PNG, JPG o SVG.");
    if (file.size > MAX_AVATAR_BYTES) return setError("La imagen pesa más de 1,5 MB.");
    setError("");
    onChange(URL.createObjectURL(file));
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">Imagen de perfil</span>
      <div className="flex flex-wrap items-center gap-4">
        {url ? (
          <img src={url} alt="Imagen de perfil" className="size-16 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-16 place-items-center rounded-full bg-muted-strong text-lg font-semibold"
          >
            {initials(name)}
          </span>
        )}
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" size="md" onClick={() => input.current?.click()}>
            <ImageUp aria-hidden="true" />
            Elegir imagen de perfil
          </Button>
          {url && (
            <Button variant="secondary" size="md" onClick={() => onChange(null)}>
              <Trash2 aria-hidden="true" />
              Eliminar imagen de perfil
            </Button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={accept} />
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function NotificationsSection() {
  const saved = useUserSettings().notifications;
  const { draft, set, dirty, justSaved, markSaved } = useDraft<NotificationPrefs>(saved);
  const save = () => {
    userStore.updateNotifications(draft);
    markSaved();
  };

  return (
    <Section
      title="Notificaciones y avisos"
      index={1}
      action={<SaveButton dirty={dirty} justSaved={justSaved} onSave={save} />}
    >
      <p className="m-0 max-w-3xl text-muted-foreground">
        cuentalibre se toma muy en serio tu privacidad: no comercia con los correos electrónicos ni con los datos de sus
        usuarios. Todas las notificaciones que recibas las envía directamente el equipo de cuentalibre.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-3 p-0 font-semibold">Notificaciones de la aplicación</legend>
          <CheckField
            label="Deseo recibir las enviadas por correo electrónico"
            checked={draft.appByEmail}
            onChange={(v) => set("appByEmail", v)}
          />
          <CheckField
            label="Deseo recibir las enviadas mediante notificación push"
            checked={draft.appByPush}
            onChange={(v) => set("appByPush", v)}
          />
        </fieldset>
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-3 p-0 font-semibold">Mensajes promocionales</legend>
          <CheckField
            label="Deseo recibir los enviados por correo electrónico"
            checked={draft.promosByEmail}
            onChange={(v) => set("promosByEmail", v)}
          />
          <CheckField
            label="Deseo recibir los enviados mediante notificación push"
            checked={draft.promosByPush}
            onChange={(v) => set("promosByPush", v)}
          />
        </fieldset>
      </div>
      <BrowserNotifications />
    </Section>
  );
}

/** Permission for push notifications in this browser, through the Notification API. */
function BrowserNotifications() {
  const supported = typeof Notification !== "undefined";
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    supported ? Notification.permission : "unsupported",
  );

  // The user may change it from the browser's site settings while the page is open
  useEffect(() => {
    if (!supported) return;
    const sync = () => setPermission(Notification.permission);
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, [supported]);

  const text = {
    unsupported: "Este navegador no admite notificaciones push.",
    granted:
      "Este navegador ya recibe tus notificaciones. Para dejar de recibirlas, bloquéalas en los ajustes del sitio.",
    denied: "Has bloqueado las notificaciones en este navegador. Puedes permitirlas en los ajustes del sitio.",
    default: "Si lo deseas, puedes recibir las notificaciones push en este navegador.",
  }[permission];

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-3 text-sm">
        <BellRing className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {text}
      </span>
      {permission === "default" && (
        <Button
          variant="secondary"
          size="md"
          className="self-start sm:self-auto"
          onClick={() => void Notification.requestPermission().then(setPermission)}
        >
          Habilitar notificaciones para este navegador
        </Button>
      )}
    </div>
  );
}

function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Eliminar cuenta" index={1} defaultOpen={false}>
      <div className="flex max-w-3xl flex-col gap-2 text-muted-foreground">
        <p className="m-0">
          Se borrarán tu usuario y todas las empresas en las que eres el único usuario, con sus facturas, gastos,
          contactos, documentos adjuntos y configuración. No se puede deshacer.
        </p>
        <p className="m-0">
          La Ley General Tributaria te obliga a conservar tus facturas y libros durante al menos cuatro años.{" "}
          <Link to={EXPORT_PATH} className="font-medium text-primary hover:text-primary-hover">
            Exporta tus datos
          </Link>{" "}
          antes de eliminar la cuenta.
        </p>
        <p className="m-0">
          Las empresas que compartes con otros usuarios se mantienen; solo dejarás de pertenecer a ellas. Las copias de
          seguridad que aún contengan tus datos se borran solas en un plazo de 31 días.
        </p>
      </div>
      <Button variant="destructive" className="self-start" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" />
        Eliminar mi cuenta
      </Button>
      <DeleteAccountDialog open={open} onOpenChange={setOpen} />
    </Section>
  );
}

function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [password, setPassword] = useState("");
  // People who only sign in with Google have no password to type
  const [hasPassword, setHasPassword] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    currentUser()
      .then((user) => active && setHasPassword(user.hasPassword))
      .catch(() => {
        // Keep asking for the password; the API answers if it was wrong to.
      });
    return () => {
      active = false;
    };
  }, [open]);

  const change = (next: boolean) => {
    if (pending) return;
    if (!next) {
      setPassword("");
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await deleteAccount(hasPassword ? password : undefined);
      reloadAt(SIGN_IN_PATH);
    } catch (failure) {
      setError(authErrorMessage(failure));
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-w-md">
        <DialogTitle>¿Eliminar tu cuenta?</DialogTitle>
        <DialogDescription className="m-0">
          Se borrarán para siempre tu usuario y los datos de las empresas en las que eres el único usuario.
          {hasPassword && " Escribe tu contraseña para confirmarlo."}
        </DialogDescription>
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          {hasPassword && (
            <Field label="Contraseña" action={<ForgotPasswordLink />}>
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
            </Field>
          )}
          {error && (
            <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending || (hasPassword && !password)}>
              {pending ? "Eliminando…" : "Eliminar cuenta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
