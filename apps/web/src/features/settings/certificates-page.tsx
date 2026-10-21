import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileKey2, ShieldCheck, Trash2 } from "lucide-react";
import type { SignatureMode, SignedDocument } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { Field, GroupedSelect, Section } from "@/features/sales/form-fields";
import { formatDate } from "@/lib/format";
import { complianceStore, useCompliance } from "./compliance-store";
import { ConfirmDialog, SaveButton, SettingsHeader, useDraft } from "./settings-parts";
import { fullName } from "./settings-model";
import { useSettings } from "./settings-store";

const CERTIFICATE_EXTENSIONS = [".pfx", ".p12"];

const MODES: { value: SignatureMode; label: string }[] = [
  { value: "none", label: "No firmar" },
  { value: "company", label: "Firmar con el certificado de la empresa" },
];

const DOCUMENTS: { value: SignedDocument; label: string }[] = [
  { value: "invoice", label: "Facturas emitidas en PDF" },
  { value: "quote", label: "Presupuestos en PDF" },
  { value: "deliveryNote", label: "Albaranes en PDF" },
];

const STEPS = [
  "Arrastra o selecciona tu certificado para subirlo. Solo valen certificados con extensión .pfx o .p12 que incluyan la clave privada.",
  "Si tu certificado tiene contraseña, introdúcela cuando te la pidamos.",
  "Tu certificado está listo para usarse.",
];

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** The company's digital certificate and which PDFs are signed with it. Signing changes apply on save. */
export function CertificatesPage() {
  const { profile } = useSettings();
  const { certificate, signing } = useCompliance();
  const { draft, set, dirty, justSaved, markSaved } = useDraft(signing);
  const [pending, setPending] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const upload = () => {
    if (!pending) return;
    // The file isn't parsed until there is a backend: it's kept by name and taken as valid for two years
    const today = new Date();
    const expires = new Date(today);
    expires.setFullYear(expires.getFullYear() + 2);
    complianceStore.setCertificate({
      fileName: pending.name,
      holder: fullName(profile),
      taxId: profile.taxId,
      uploadedOn: isoDate(today),
      expiresOn: isoDate(expires),
      hasPassword: password !== "",
    });
    setPending(null);
    setPassword("");
  };

  const save = () => {
    complianceStore.updateSigning(draft);
    markSaved();
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
        <SettingsHeader
          title="Certificados digitales"
          description="Sube tu certificado digital y elige qué documentos se firman con él."
        >
          <SaveButton dirty={dirty} justSaved={justSaved} onSave={save} />
        </SettingsHeader>

        <Section title="Información" index={0}>
          <div className="flex max-w-3xl flex-col gap-2 text-muted-foreground">
            <p className="m-0">
              Un certificado digital es un fichero que identifica a una persona o empresa en Internet y le permite
              firmar documentos en su nombre. Puede ser el mismo que usas para presentar impuestos en la sede
              electrónica de la Agencia Tributaria, emitido por una entidad certificadora como la FNMT, Uanataca o ANF.
            </p>
            <p className="m-0">
              Te recomendamos que tu certificado esté protegido con contraseña para mayor seguridad.
            </p>
          </div>
          <ol className="m-0 flex max-w-3xl flex-col gap-2 pl-0">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-sm">{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Configuración del certificado digital" index={1}>
          <p className="m-0 max-w-3xl text-muted-foreground">
            Sube tu certificado digital a cuentalibre para firmar digitalmente tus documentos.
          </p>
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <CertificateDrop onFile={setPending} />
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <span className="text-sm font-medium text-muted-foreground">Certificado actual</span>
              {certificate ? (
                <>
                  <span className="flex min-w-0 items-center gap-2">
                    <FileKey2 className="size-4 shrink-0 text-primary" strokeWidth={1.8} aria-hidden="true" />
                    <span className="truncate font-medium">{certificate.fileName}</span>
                    <Badge tone="success">Válido</Badge>
                  </span>
                  <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Titular</dt>
                    <dd className="m-0 truncate">{certificate.holder}</dd>
                    <dt className="text-muted-foreground">NIF</dt>
                    <dd className="m-0 font-mono">{certificate.taxId}</dd>
                    <dt className="text-muted-foreground">Subido el</dt>
                    <dd className="m-0">{formatDate(certificate.uploadedOn)}</dd>
                    <dt className="text-muted-foreground">Caduca el</dt>
                    <dd className="m-0">{formatDate(certificate.expiresOn)}</dd>
                  </dl>
                  <Button variant="secondary" size="sm" className="self-start" onClick={() => setConfirmDelete(true)}>
                    <Trash2 aria-hidden="true" />
                    Borrar
                  </Button>
                </>
              ) : (
                <span className="text-sm">No se ha subido ningún certificado.</span>
              )}
            </div>
          </div>
        </Section>

        <Section title="Firmar electrónicamente los documentos" index={2}>
          <div className="flex max-w-3xl flex-col gap-2 text-muted-foreground">
            <p className="m-0">
              Un documento firmado electrónicamente garantiza que lo ha emitido quien lo firma y que su contenido no se
              ha modificado después de firmarlo.
            </p>
            <p className="m-0">
              Además, la firma digital hecha con un certificado válido y en vigor tiene la misma consideración legal que
              una firma manuscrita. cuentalibre puede firmar tus facturas emitidas, presupuestos y albaranes en PDF.
            </p>
          </div>
          {!certificate && (
            <p className="m-0 max-w-3xl rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
              Sube tu certificado digital para poder firmar tus documentos.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {DOCUMENTS.map((d) => (
              <Field key={d.value} label={d.label}>
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={certificate ? draft[d.value] : "none"}
                    disabled={!certificate}
                    onChange={(v) => set(d.value, v as SignatureMode)}
                    groups={[{ options: MODES }]}
                  />
                )}
              </Field>
            ))}
          </div>
        </Section>
      </div>

      <PasswordDialog
        file={pending}
        password={password}
        onPasswordChange={setPassword}
        onCancel={() => {
          setPending(null);
          setPassword("");
        }}
        onConfirm={upload}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Borrar el certificado"
        confirmLabel="Borrar"
        danger
        onConfirm={() => complianceStore.setCertificate(null)}
      >
        <p className="m-0">Tus documentos dejarán de firmarse hasta que subas otro certificado.</p>
      </ConfirmDialog>
    </TooltipProvider>
  );
}

function CertificateDrop({ onFile }: { onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!CERTIFICATE_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)))
      return setError("Solo se admiten certificados con extensión .pfx o .p12.");
    setError("");
    onFile(file);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files[0]);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-transparent p-6 text-muted-foreground transition-colors duration-150 hover:bg-muted",
          dragging ? "border-primary bg-primary-soft text-primary" : "border-border",
        )}
      >
        <ShieldCheck className="size-6" strokeWidth={1.6} aria-hidden="true" />
        <span className="font-medium text-foreground">Arrastra aquí tu certificado o haz clic para buscarlo</span>
        <span className="text-xs">Archivos .pfx o .p12 con la clave privada</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={CERTIFICATE_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordDialog({
  file,
  password,
  onPasswordChange,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  password: string;
  onPasswordChange: (password: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm();
          }}
        >
          <DialogTitle>Contraseña del certificado</DialogTitle>
          <DialogDescription>
            Si <span className="font-medium text-foreground">{file?.name}</span> está protegido con contraseña,
            introdúcela. Si no tiene, déjala en blanco.
          </DialogDescription>
          <Field label="Contraseña">
            {(p) => (
              <Input
                {...p}
                type="password"
                autoComplete="off"
                autoFocus
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit">Subir certificado</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
