import { useState, type CSSProperties } from "react";
import { MoreHorizontal, Pencil, Plus, Power, Star, Trash2 } from "lucide-react";
import type { PaymentMethod } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button } from "@cuentalibre/ui/components/button";
import { DropdownMenuTrigger } from "@cuentalibre/ui/components/dropdown-menu";
import { SegmentedControl } from "@cuentalibre/ui/components/segmented-control";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { ActionsMenu, EmptyState, IconAction, type Action } from "@/features/sales/list-parts";
import { METHOD_ICONS } from "./method-icons";
import { MethodDialog } from "./method-dialog";
import { methodUsage } from "./method-usage";
import { ConfirmDialog, SettingsHeader } from "./settings-parts";
import { ACTIVE_STATUS, displayNumber, maskNumber, methodTypeLabel, usePaymentMethods } from "./settings-model";
import { settingsStore, useSettings } from "./settings-store";
import { Page } from "@/components/page";

type StatusFilter = "all" | "active" | "inactive";

const defaultMark = (
  <Tooltip>
    <TooltipTrigger asChild>
      <span tabIndex={0} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
        <Star className="size-3.5 fill-current" aria-hidden="true" />
        Por defecto
      </span>
    </TooltipTrigger>
    <TooltipContent>Se propone en las facturas nuevas</TooltipContent>
  </Tooltip>
);

/** How the business collects and pays: bank accounts, cards, cash, PayPal… */
export function PaymentMethodsPage() {
  const { defaultPaymentMethodId } = useSettings();
  const methods = usePaymentMethods();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<PaymentMethod | "new" | null>(null);
  const [removing, setRemoving] = useState<PaymentMethod | null>(null);
  const [blocked, setBlocked] = useState<{ method: PaymentMethod; uses: number } | null>(null);

  const shown = methods.filter((m) => status === "all" || m.active === (status === "active"));

  const askRemove = (m: PaymentMethod) => {
    const uses = methodUsage(m.id);
    if (uses > 0) setBlocked({ method: m, uses });
    else setRemoving(m);
  };

  const actions = (m: PaymentMethod): Action[][] => {
    const isDefault = m.id === defaultPaymentMethodId;
    return [
      [
        {
          label: "Establecer por defecto",
          icon: Star,
          run: isDefault || !m.active ? undefined : () => settingsStore.setDefaultPaymentMethod(m.id),
        },
        { label: "Editar", icon: Pencil, run: () => setEditing(m) },
        {
          label: m.active ? "Desactivar" : "Activar",
          icon: Power,
          // The default method stays active: it's proposed on every new document
          run: isDefault ? undefined : () => settingsStore.updatePaymentMethod(m.id, { active: !m.active }),
        },
      ],
      [{ label: "Eliminar", icon: Trash2, danger: true, run: isDefault ? undefined : () => askRemove(m) }],
    ];
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <SettingsHeader
          title="Formas de cobro y pago"
          description="Cómo te pagan tus clientes y cómo pagas a tus proveedores: tus cuentas, tarjetas, PayPal o efectivo."
        >
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            Nueva forma de pago
          </Button>
        </SettingsHeader>

        <SegmentedControl
          label="Estado"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todas" },
            { value: "active", label: "Activas" },
            { value: "inactive", label: "Inactivas" },
          ]}
          className="self-start"
        />

        {shown.length === 0 ? (
          <div className="surface">
            <EmptyState
              message={
                methods.length === 0
                  ? "Todavía no tienes formas de cobro y pago"
                  : "Ninguna forma de pago con este estado"
              }
              hint={
                methods.length === 0
                  ? "Añade tu cuenta bancaria para que sus datos salgan en tus facturas."
                  : "Prueba con otro filtro."
              }
            />
          </div>
        ) : (
          <>
            <ul className="m-0 flex list-none flex-col overflow-hidden surface p-0">
              {shown.map((m, i) => {
                const Icon = METHOD_ICONS[m.type];
                const number = m.number && displayNumber(m);
                return (
                  <li
                    key={m.id}
                    className="flex animate-row-in items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
                    style={{ "--i": i } as CSSProperties}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className={cn("truncate font-semibold", !m.active && "text-muted-foreground")}>
                          {m.name}
                        </span>
                        {m.id === defaultPaymentMethodId && defaultMark}
                        {!m.active && <Badge tone={ACTIVE_STATUS.inactive.tone}>Inactiva</Badge>}
                      </span>
                      <span className="flex flex-wrap gap-x-1.5 text-sm text-muted-foreground">
                        <span>{methodTypeLabel(m.type)}</span>
                        {number && (
                          // A whole IBAN doesn't fit a phone: its last digits are enough to tell it apart
                          <span className="min-w-0 truncate tabular-nums">
                            <span className="sm:hidden">{maskNumber(m.number)}</span>
                            <span className="hidden sm:inline">· {number}</span>
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="flex gap-0.5">
                      <span className="hidden lg:contents">
                        <IconAction action={{ label: "Editar", icon: Pencil, run: () => setEditing(m) }} />
                      </span>
                      <ActionsMenu
                        groups={actions(m)}
                        trigger={
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Más opciones de ${m.name}`}>
                              <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                        }
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="m-0 text-sm text-muted-foreground">
              {shown.length} {shown.length === 1 ? "forma de cobro y pago" : "formas de cobro y pago"}
            </p>
          </>
        )}

        {editing && (
          <MethodDialog
            key={editing === "new" ? "new" : editing.id}
            open
            onOpenChange={(open) => !open && setEditing(null)}
            method={editing === "new" ? null : editing}
          />
        )}

        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Eliminar forma de pago"
          confirmLabel="Eliminar"
          danger
          onConfirm={() => removing && settingsStore.removePaymentMethod(removing.id)}
        >
          <p className="m-0">Se eliminará «{removing?.name}». No la usa ningún documento ni contacto.</p>
        </ConfirmDialog>
        <ConfirmDialog
          open={blocked !== null}
          onOpenChange={(open) => !open && setBlocked(null)}
          title="Esta forma de pago está en uso"
          confirmLabel="Desactivar"
          onConfirm={() => blocked && settingsStore.updatePaymentMethod(blocked.method.id, { active: false })}
        >
          <p className="m-0">
            «{blocked?.method.name}» aparece en {blocked?.uses}{" "}
            {blocked?.uses === 1 ? "documento o contacto" : "documentos o contactos"}, así que no se puede eliminar.
          </p>
          <p className="m-0">Puedes desactivarla: dejará de proponerse, pero los documentos la conservan.</p>
        </ConfirmDialog>
      </Page>
    </TooltipProvider>
  );
}
