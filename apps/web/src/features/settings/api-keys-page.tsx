import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import type { ApiKey, CreatedApiKey } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Input } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { SITE_URL } from "@/components/legal-links";
import { ApiError } from "@/data/api";
import { currentBackend } from "@/data/backend";
import { API_URL } from "@/features/auth/session";
import { Field, GroupedSelect, Section } from "@/features/sales/form-fields";
import { copyText } from "@/lib/clipboard";
import { formatDate } from "@/lib/format";
import { SettingsHeader } from "./settings-parts";
import { Page } from "@/components/page";

const EXPIRY = [
  { value: "never", label: "Nunca" },
  { value: "30", label: "En 30 días" },
  { value: "90", label: "En 90 días" },
  { value: "365", label: "En un año" },
];

const day = (iso: string | null) => (iso ? formatDate(iso.slice(0, 10)) : "—");

/** API keys for scripts and agents: each one acts as you in this company. */
export function ApiKeysPage() {
  const api = currentBackend().apiKeys;
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("never");
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      ?.list()
      .then(setKeys)
      .catch(() => setError("No se han podido cargar tus claves."));
  }, [api]);
  useEffect(load, [load]);

  const create = async () => {
    if (!api || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const key = await api.create({
        name: name.trim(),
        ...(expiry !== "never" && { expiresInDays: Number(expiry) }),
      });
      setCreated(key);
      setCopied(false);
      setName("");
      load();
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.code === "too_many_api_keys"
          ? "Ya tienes el máximo de claves activas. Revoca una para crear otra."
          : "No se ha podido crear la clave. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (key: ApiKey) => {
    if (!api || !window.confirm(`¿Revocar la clave «${key.name}»? Lo que la use dejará de funcionar.`)) return;
    await api.revoke(key.id).catch(() => setError("No se ha podido revocar la clave."));
    if (created?.id === key.id) setCreated(null);
    load();
  };

  const copy = async (text: string) => {
    if (await copyText(text)) setCopied(true);
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <SettingsHeader
          title="API y agentes"
          description="Claves para que tus scripts y asistentes de IA trabajen con tus datos."
        />

        {!api ? (
          <p className="m-0 max-w-3xl rounded-lg bg-muted px-4 py-3 text-sm">
            Las claves de API están disponibles cuando usas cuentalibre con tu cuenta.
          </p>
        ) : (
          <>
            <Section title="Nueva clave" index={0}>
              <p className="m-0 max-w-3xl text-sm text-muted-foreground">
                Una clave actúa en tu nombre en esta empresa, con tus mismos permisos: puede leer tus datos, crear
                borradores y emitir facturas. Guárdala como una contraseña y revócala si ya no la usas.
              </p>
              <form
                className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void create();
                }}
              >
                <Field label="Nombre" required>
                  {(p) => (
                    <Input
                      {...p}
                      maxLength={32}
                      placeholder="Asistente, script de bancos…"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Caduca">
                  {(p) => <GroupedSelect {...p} value={expiry} onChange={setExpiry} groups={[{ options: EXPIRY }]} />}
                </Field>
                <Button type="submit" disabled={busy || !name.trim()}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
                  Crear clave
                </Button>
              </form>

              {created && (
                <div role="status" className="flex flex-col gap-2 rounded-xl bg-success-soft px-3.5 py-3 text-sm">
                  <strong className="font-semibold text-success">Clave «{created.name}» creada</strong>
                  <p className="m-0">Cópiala ahora: por seguridad no se volverá a mostrar.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 font-mono text-xs break-all">
                      {created.key}
                    </code>
                    <Button variant="secondary" onClick={() => void copy(created.key)}>
                      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                      {copied ? "Copiada" : "Copiar"}
                    </Button>
                  </div>
                </div>
              )}
              {error && (
                <p role="alert" className="m-0 rounded-xl bg-destructive-soft px-3.5 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </Section>

            <Section title="Tus claves" index={1}>
              {keys === null ? (
                <p className="m-0 text-sm text-muted-foreground">Cargando…</p>
              ) : keys.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">Aún no has creado ninguna clave.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
                  {keys.map((key) => (
                    <li key={key.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-medium">{key.name}</span>
                        <span className="text-xs text-muted-foreground">
                          <span className="font-mono">{key.start}…</span> · Creada el {day(key.createdAt)} · Último uso{" "}
                          {key.lastUsedAt ? `el ${day(key.lastUsedAt)}` : "nunca"} ·{" "}
                          {key.expiresAt ? `Caduca el ${day(key.expiresAt)}` : "No caduca"}
                        </span>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => void revoke(key)}>
                        <Trash2 aria-hidden="true" />
                        Revocar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Cómo usarla" index={2}>
              <p className="m-0 max-w-3xl text-sm text-muted-foreground">
                Envía la clave en la cabecera <code className="font-mono">Authorization</code>. La API está descrita en{" "}
                <a
                  href={`${API_URL}/v1/openapi.json`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary no-underline hover:text-primary-hover"
                >
                  OpenAPI
                </a>
                : facturas, borradores, compras, gastos, contactos y archivos.
                {SITE_URL && (
                  <>
                    {" "}
                    Para conectar un agente de IA, sigue la{" "}
                    <a
                      href={`${SITE_URL}/docs/agentes`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary no-underline hover:text-primary-hover"
                    >
                      guía
                    </a>{" "}
                    y la{" "}
                    <a
                      href={`${SITE_URL}/docs/api`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary no-underline hover:text-primary-hover"
                    >
                      referencia de la API
                    </a>
                    .
                  </>
                )}
              </p>
              <pre className="m-0 overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono text-xs">
                {`curl ${API_URL ?? ""}/v1/sales-documents?from=2026-01-01 \\\n  -H "Authorization: Bearer fsk_…"`}
              </pre>
            </Section>
          </>
        )}
      </Page>
    </TooltipProvider>
  );
}
