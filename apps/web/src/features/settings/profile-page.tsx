import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router";
import { BellRing, ImageUp, Trash2 } from "lucide-react";
import type { Gender, NotificationPrefs, UserLocale, UserProfile } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Input } from "@cuentalibre/ui/components/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { authErrorMessage, deleteAccount } from "@/features/auth/auth-api";
import { SIGN_IN_PATH, reloadAt, sessionState } from "@/features/auth/session";
import { CheckField, Field, GroupedSelect, Section } from "@/features/sales/form-fields";
import { LANGUAGES, NUMBER_FORMATS, defaultNumberFormat, formatSample } from "@/features/sales/invoice-locale";
import type { Option } from "@/features/sales/sales-model";
import { EXPORT_PATH } from "@/features/transfer/transfer-model";
import { SaveButton, SettingsHeader, useDraft } from "./settings-parts";
import { initials } from "./settings-model";
import { userFullName, userStore, useUserSettings } from "./user-store";

const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024;

/** Radix Select can't hold an empty value: this stands for "the business default". */
const BUSINESS_DEFAULT = "default";

const GENDERS: Option<Exclude<Gender, "">>[] = [
  { value: "male", label: "Hombre" },
  { value: "female", label: "Mujer" },
];

/** The time zones a business in Spain is likely to need, Spanish ones first. */
const TIME_ZONES: Option[] = [
  { value: "Europe/Madrid", label: "(UTC+01:00) Bruselas, Copenhague, Madrid, París" },
  { value: "Atlantic/Canary", label: "(UTC+00:00) Canarias" },
  { value: "Europe/Lisbon", label: "(UTC+00:00) Dublín, Edimburgo, Lisboa, Londres" },
  { value: "Europe/Berlin", label: "(UTC+01:00) Ámsterdam, Berlín, Berna, Roma, Estocolmo, Viena" },
  { value: "Europe/Warsaw", label: "(UTC+01:00) Sarajevo, Skopie, Varsovia, Zagreb" },
  { value: "Europe/Athens", label: "(UTC+02:00) Atenas, Bucarest" },
  { value: "Europe/Helsinki", label: "(UTC+02:00) Helsinki, Kiev, Riga, Sofía, Tallin, Vilna" },
  { value: "Europe/Istanbul", label: "(UTC+03:00) Estambul" },
  { value: "Europe/Moscow", label: "(UTC+03:00) Moscú, San Petersburgo" },
  { value: "Asia/Dubai", label: "(UTC+04:00) Abu Dabi, Mascate" },
  { value: "Asia/Kolkata", label: "(UTC+05:30) Chennai, Calcuta, Bombay, Nueva Delhi" },
  { value: "Asia/Shanghai", label: "(UTC+08:00) Pekín, Chongqing, Hong Kong, Urumqi" },
  { value: "Asia/Tokyo", label: "(UTC+09:00) Osaka, Sapporo, Tokio" },
  { value: "Australia/Sydney", label: "(UTC+10:00) Canberra, Melbourne, Sídney" },
  { value: "America/Sao_Paulo", label: "(UTC-03:00) Brasilia" },
  { value: "America/Argentina/Buenos_Aires", label: "(UTC-03:00) Ciudad de Buenos Aires" },
  { value: "America/Santiago", label: "(UTC-04:00) Santiago" },
  { value: "America/Caracas", label: "(UTC-04:00) Caracas" },
  { value: "America/Bogota", label: "(UTC-05:00) Bogotá, Lima, Quito, Río Branco" },
  { value: "America/New_York", label: "(UTC-05:00) Hora del Este (EE. UU. y Canadá)" },
  { value: "America/Mexico_City", label: "(UTC-06:00) Guadalajara, Ciudad de México, Monterrey" },
  { value: "America/Los_Angeles", label: "(UTC-08:00) Hora del Pacífico (EE. UU. y Canadá)" },
];

/** Language and format the business uses, which an empty user choice follows. */
const BUSINESS_LOCALE = { language: "es", numberFormat: "ES" };

export function ProfilePage() {
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
        <SettingsHeader
          title="Datos personales"
          description="Tus datos como usuario de cuentalibre, no los de tu empresa."
        />
        <PersonalSection />
        <NotificationsSection />
        <LocaleSection />
        {/* The demo has no account to delete */}
        {sessionState() === "connected" && <DeleteAccountSection />}
      </div>
    </TooltipProvider>
  );
}

/* Each section saves on its own, like in the reference app, so a change to the notifications doesn't wait on the profile. */

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
      <AvatarField name={userFullName(draft)} url={draft.avatarUrl} onChange={(url) => set("avatarUrl", url)} />
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
              value={draft.gender || BUSINESS_DEFAULT}
              onChange={(v) => set("gender", v === BUSINESS_DEFAULT ? "" : (v as Gender))}
              groups={[{ options: [{ value: BUSINESS_DEFAULT, label: "Prefiero no decirlo" }, ...GENDERS] }]}
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

function LocaleSection() {
  const saved = useUserSettings().locale;
  const { draft, set, setDraft, dirty, justSaved, markSaved } = useDraft<UserLocale>(saved);
  const save = () => {
    userStore.updateLocale(draft);
    markSaved();
  };

  const language = draft.language || BUSINESS_LOCALE.language;
  const numberFormat =
    draft.numberFormat || (draft.language ? defaultNumberFormat(draft.language) : BUSINESS_LOCALE.numberFormat);
  const sample = formatSample(language, numberFormat, new Date());
  const formats: Option[] = draft.language
    ? (NUMBER_FORMATS[draft.language] ?? [])
    : [{ value: BUSINESS_DEFAULT, label: "Formato por defecto de la empresa" }];

  return (
    <Section
      title="Idioma, formato numérico y zona horaria"
      index={2}
      action={<SaveButton dirty={dirty} justSaved={justSaved} onSave={save} />}
    >
      <div className="flex max-w-3xl flex-col gap-2 text-muted-foreground">
        <p className="m-0">
          cuentalibre está en español por ahora. Si eliges otro idioma, los textos seguirán en español, pero los números
          y las fechas tomarán su formato.
        </p>
        <p className="m-0">
          Este idioma y formato no se aplican a las facturas, albaranes y presupuestos en PDF, que tienen su propia
          configuración.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="flex flex-col gap-4">
          <Field label="Idioma">
            {(p) => (
              <GroupedSelect
                {...p}
                value={draft.language || BUSINESS_DEFAULT}
                onChange={(v) => {
                  const next = v === BUSINESS_DEFAULT ? "" : v;
                  setDraft((d) => ({ ...d, language: next, numberFormat: next ? defaultNumberFormat(next) : "" }));
                }}
                groups={[
                  { options: [{ value: BUSINESS_DEFAULT, label: "Idioma por defecto de la empresa" }, ...LANGUAGES] },
                ]}
              />
            )}
          </Field>
          <Field label="Formato numérico">
            {(p) => (
              <GroupedSelect
                {...p}
                value={draft.language ? numberFormat : BUSINESS_DEFAULT}
                onChange={(v) => set("numberFormat", v === BUSINESS_DEFAULT ? "" : v)}
                groups={[{ options: formats }]}
              />
            )}
          </Field>
          <Field label="Zona horaria" hint="Por ahora solo se aplica al registro de la jornada laboral.">
            {(p) => (
              <GroupedSelect
                {...p}
                value={draft.timeZone || BUSINESS_DEFAULT}
                onChange={(v) => set("timeZone", v === BUSINESS_DEFAULT ? "" : v)}
                groups={[
                  { options: [{ value: BUSINESS_DEFAULT, label: "Zona horaria por defecto de la empresa" }] },
                  { label: "Zonas horarias", options: TIME_ZONES },
                ]}
              />
            )}
          </Field>
        </div>
        {sample && (
          <div className="flex flex-col gap-1.5 self-start rounded-lg bg-muted p-4 text-sm">
            <span className="font-semibold">Ejemplo de formato</span>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Números negativos</dt>
              <dd className="m-0 amount">{sample.negative}</dd>
              <dt className="text-muted-foreground">Números positivos</dt>
              <dd className="m-0 amount">{sample.positive}</dd>
              <dt className="text-muted-foreground">Fecha</dt>
              <dd className="m-0 amount">{sample.date}</dd>
            </dl>
          </div>
        )}
      </div>
    </Section>
  );
}

function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Eliminar cuenta" index={3} defaultOpen={false}>
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await deleteAccount(password);
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
          Se borrarán para siempre tu usuario y los datos de las empresas en las que eres el único usuario. Escribe tu
          contraseña para confirmarlo.
        </DialogDescription>
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <Field label="Contraseña">
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
            <Button type="submit" variant="destructive" disabled={pending || !password}>
              {pending ? "Eliminando…" : "Eliminar cuenta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
