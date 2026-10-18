import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ChevronDown, FilePlus2, FolderTree, X } from "lucide-react";
import { cents, isCatalogUnit, newId, priceBreakdown, stockOf, surchargeFitsVat, type Cents } from "@fiscalia/core";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@fiscalia/ui/components/dropdown-menu";
import { Input, Textarea } from "@fiscalia/ui/components/input";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { PercentInput } from "@/features/purchases/form-parts";
import { TagsField } from "@/features/sales/document-editor";
import { CheckField, Field, GroupedSelect, Section } from "@/features/sales/form-fields";
import { SURCHARGE_OPTIONS, VAT_RATE_OPTIONS } from "@/features/sales/sales-model";
import { formatDecimalInput, parseDecimal } from "@/lib/format";
import type { Product } from "@/mocks/catalog";
import {
  CATALOG_SETTINGS_PATH,
  NEW_PRODUCT_PATH,
  NO_UNIT,
  PRODUCTS_PATH,
  STOCK_PATH,
  UNIT_OPTIONS,
  familyLabel,
  formatQuantity,
  rulesActive,
} from "./catalog-model";
import { catalogStore, useCatalog } from "./catalog-store";
import { FamilyDialog } from "./family-dialog";

const DEFAULT_HELP =
  "Este valor es el que se marcará por defecto al introducir este producto en una factura. Se puede modificar en la propia factura.";

interface Draft {
  familyId: string | null;
  name: string;
  description: string;
  privateNotes: string;
  unit: string;
  tags: string[];
  active: boolean;
  sku: string;
  supplierRef: string;
  price: string;
  discount: string;
  vatRate: number;
  surchargeRate: number;
  cost: string;
  costVatRate: number;
  costSurchargeRate: number;
  custom: [string, string, string, string];
  stockEnabled: boolean;
  initialStock: string;
  allowWithoutStock: boolean;
  alarmOn: boolean;
  minUnits: string;
  dashboard: boolean;
  notification: boolean;
  email: boolean;
}

type ErrorKey =
  | "name"
  | "sku"
  | "price"
  | "discount"
  | "surcharge"
  | "cost"
  | "costSurcharge"
  | "initialStock"
  | "minUnits"
  | "alarm";
type Errors = Partial<Record<ErrorKey, string>>;

function toDraft(product: Product | undefined): Draft {
  const { defaults } = catalogStore.get().settings;
  const stock = product ? product.stock : defaults.enabled ? defaults : null;
  const alarm = product ? product.stock?.alarm : defaults.alarmOn ? defaults.alarm : null;
  return {
    familyId: product?.familyId ?? null,
    name: product?.name ?? "",
    description: product?.description ?? "",
    privateNotes: product?.privateNotes ?? "",
    unit: product?.unit ?? NO_UNIT,
    tags: product?.tags ?? [],
    active: product?.active ?? true,
    sku: product?.sku ?? "",
    supplierRef: product?.supplierRef ?? "",
    price: product ? formatDecimalInput(product.price) : "",
    discount: product?.discount ? formatDecimalInput(product.discount * 100) : "",
    vatRate: product?.vatRate ?? 0.21,
    surchargeRate: product?.surchargeRate ?? 0,
    cost: product?.cost != null ? formatDecimalInput(product.cost) : "",
    costVatRate: product?.costVatRate ?? 0.21,
    costSurchargeRate: product?.costSurchargeRate ?? 0,
    custom: product?.custom ?? ["", "", "", ""],
    stockEnabled: !!stock,
    initialStock: "",
    allowWithoutStock: stock?.allowWithoutStock ?? defaults.allowWithoutStock,
    alarmOn: !!alarm,
    minUnits: alarm ? formatDecimalInput(alarm.minUnits) : "",
    dashboard: alarm?.dashboard ?? defaults.alarm?.dashboard ?? false,
    notification: alarm?.notification ?? defaults.alarm?.notification ?? false,
    email: alarm?.email ?? defaults.alarm?.email ?? false,
  };
}

function validate(draft: Draft, existingId: string | undefined, isNew: boolean): Errors {
  const errors: Errors = {};
  const { products } = catalogStore.get();
  if (!draft.name.trim()) errors.name = "El nombre es obligatorio.";
  const sku = draft.sku.trim();
  if (sku && products.some((p) => p.id !== existingId && p.sku.toLowerCase() === sku.toLowerCase()))
    errors.sku = "Ya hay otro producto con este código.";
  else if (draft.stockEnabled && !sku)
    errors.sku = "Al habilitar el control de stock, el código de producto es obligatorio.";
  if (!draft.price.trim()) errors.price = "El precio unitario es obligatorio.";
  else if (parseDecimal(draft.price) === null) errors.price = "El precio unitario solo puede contener números.";
  const discount = parseDecimal(draft.discount || "0");
  if (discount === null || discount < 0 || discount > 100)
    errors.discount = "El descuento debe ser un número entre 0 y 100.";
  if (!surchargeFitsVat(draft.vatRate, draft.surchargeRate))
    errors.surcharge = "Este recargo no corresponde al tipo de IVA elegido.";
  if (draft.cost.trim() && parseDecimal(draft.cost) === null)
    errors.cost = "El coste unitario solo puede contener números.";
  if (!surchargeFitsVat(draft.costVatRate, draft.costSurchargeRate))
    errors.costSurcharge = "Este recargo no corresponde al tipo de IVA elegido.";
  if (draft.stockEnabled) {
    if (isNew && parseDecimal(draft.initialStock || "0") === null)
      errors.initialStock = "Escribe un número de unidades válido.";
    if (draft.alarmOn) {
      if (!draft.minUnits.trim() || parseDecimal(draft.minUnits) === null)
        errors.minUnits = "Indica a partir de cuántas unidades avisar.";
      if (!draft.dashboard && !draft.notification && !draft.email) errors.alarm = "Elige al menos una forma de aviso.";
    }
  }
  return errors;
}

function fromDraft(draft: Draft, id: string): Product {
  return {
    id,
    familyId: draft.familyId,
    name: draft.name.trim(),
    description: draft.description.trim(),
    privateNotes: draft.privateNotes.trim(),
    unit: isCatalogUnit(draft.unit) ? draft.unit : null,
    tags: draft.tags,
    active: draft.active,
    sku: draft.sku.trim(),
    supplierRef: draft.supplierRef.trim(),
    price: parseDecimal(draft.price) ?? 0,
    discount: (parseDecimal(draft.discount || "0") ?? 0) / 100,
    vatRate: draft.vatRate,
    surchargeRate: draft.surchargeRate,
    cost: draft.cost.trim() ? parseDecimal(draft.cost) : null,
    costVatRate: draft.costVatRate,
    costSurchargeRate: draft.costSurchargeRate,
    custom: draft.custom.map((c) => c.trim()) as Product["custom"],
    stock: draft.stockEnabled
      ? {
          allowWithoutStock: draft.allowWithoutStock,
          alarm: draft.alarmOn
            ? {
                minUnits: parseDecimal(draft.minUnits) ?? 0,
                dashboard: draft.dashboard,
                notification: draft.notification,
                email: draft.email,
              }
            : null,
        }
      : null,
  };
}

export function ProductFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const existing = id ? catalogStore.get().products.find((p) => p.id === id) : undefined;

  if (id && !existing)
    return (
      <div className="flex flex-col gap-3 px-5 pt-6 lg:px-8 lg:pt-6">
        <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">No encontrado</h1>
        <p className="m-0 text-muted-foreground">Este producto no existe o se ha eliminado.</p>
        <Link to={PRODUCTS_PATH} className="font-medium text-primary no-underline hover:text-primary-hover">
          Volver al catálogo
        </Link>
      </div>
    );

  const source = !existing ? catalogStore.get().products.find((p) => p.id === params.get("desde")) : undefined;
  const justSaved = !existing ? catalogStore.get().products.find((p) => p.id === params.get("creado")) : undefined;
  return (
    <ProductForm key={existing?.id ?? params.toString()} existing={existing} source={source} justSaved={justSaved} />
  );
}

function ProductForm({ existing, source, justSaved }: { existing?: Product; source?: Product; justSaved?: Product }) {
  const navigate = useNavigate();
  const { families, movements, settings } = useCatalog();
  const [draft, setDraft] = useState<Draft>(() => {
    const base = toDraft(existing ?? source);
    // A copy can't share the code, which must be unique
    return source ? { ...base, sku: "" } : base;
  });
  const [errors, setErrors] = useState<Errors>({});
  const [choosingFamily, setChoosingFamily] = useState(false);
  const [advancedSale, setAdvancedSale] = useState(() => draft.surchargeRate !== 0);
  const [advancedCost, setAdvancedCost] = useState(() => draft.costSurchargeRate !== 0);
  const isNew = !existing;
  // Turning stock control on for an existing product also asks for its stock
  const asksInitialStock = isNew || !existing.stock;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors({});
  };

  const save = (another = false) => {
    const found = validate(draft, existing?.id, asksInitialStock);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    const product = fromDraft(draft, existing?.id ?? newId());
    const initial = parseDecimal(draft.initialStock || "0") ?? 0;
    if (existing) catalogStore.updateProduct(existing.id, product, initial);
    else catalogStore.addProduct(product, initial);
    if (another) {
      navigate(`${NEW_PRODUCT_PATH}?creado=${product.id}`);
      window.scrollTo({ top: 0 });
    } else navigate(PRODUCTS_PATH);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };

  const sale = priceBreakdown(parseDecimal(draft.price) ?? 0, {
    discount: (parseDecimal(draft.discount || "0") ?? 0) / 100,
    vatRate: draft.vatRate,
    surchargeRate: advancedSale ? draft.surchargeRate : 0,
  });
  const cost = priceBreakdown(parseDecimal(draft.cost) ?? 0, {
    vatRate: draft.costVatRate,
    surchargeRate: advancedCost ? draft.costSurchargeRate : 0,
  });
  const family = familyLabel(families, draft.familyId);

  const actions = (className?: string) => (
    <div className={cn("flex gap-2.5", className)}>
      {existing ? (
        <Button type="submit" className="flex-1 lg:flex-none">
          Guardar cambios
        </Button>
      ) : (
        <div className="flex flex-1 lg:flex-none">
          <Button type="submit" className="flex-1 rounded-r-none lg:flex-none">
            Crear producto
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Más formas de crear"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-l-none border-l border-primary-foreground/25 px-2.5",
              )}
            >
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => save(true)}>
                <FilePlus2 aria-hidden="true" />
                Crear y añadir otro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );

  const advancedToggle = (open: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-medium text-primary hover:text-primary-hover"
    >
      <ChevronDown
        className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
        aria-hidden="true"
      />
      {open ? "Ocultar edición avanzada" : "Mostrar edición avanzada"}
    </button>
  );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5 px-5 pt-6 lg:gap-4 lg:px-8 lg:pt-6 lg:pb-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={PRODUCTS_PATH}
              aria-label="Volver al catálogo"
              className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-10 no-underline")}
            >
              <ArrowLeft strokeWidth={1.8} aria-hidden="true" />
            </Link>
            <div className="flex min-w-0 flex-col">
              <h1 className="m-0 truncate text-2xl font-semibold tracking-tight lg:text-3xl">
                {existing ? "Editar producto o servicio" : "Nuevo producto o servicio"}
              </h1>
              {existing && <span className="truncate text-sm text-muted-foreground">{existing.name}</span>}
            </div>
          </div>
          {actions("hidden lg:flex")}
        </header>

        {justSaved && !source && (
          <p role="status" className="m-0 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
            Producto «{justSaved.name}» creado. Ya puedes añadir el siguiente.
          </p>
        )}
        {source && (
          <p className="m-0 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
            Copiado de «{source.name}». Cambia el nombre y ponle su propio código antes de crearlo.
          </p>
        )}

        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <Section title="Información del producto" index={1}>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">Familia/Subfamilia</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {family ? (
                  <span className="flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-sm font-medium">
                    {family}
                    <button
                      type="button"
                      aria-label="Quitar la familia"
                      onClick={() => set("familyId", null)}
                      className="flex size-5 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground hover:bg-muted-strong hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground italic">
                    No has seleccionado ninguna familia/subfamilia
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={() => setChoosingFamily(true)}>
                  <FolderTree strokeWidth={1.8} aria-hidden="true" />
                  {family ? "Cambiar" : "Seleccionar una familia/subfamilia"}
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Nombre" required error={errors.name} hint="Ej.: ordenador, programación…">
                {(p) => (
                  <Input {...p} autoFocus={isNew} value={draft.name} onChange={(e) => set("name", e.target.value)} />
                )}
              </Field>
              <Field label="Descripción">
                {(p) => (
                  <Textarea
                    {...p}
                    rows={2}
                    value={draft.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                )}
              </Field>
              <Field label="Notas privadas" help="Notas privadas sobre el producto que no se mostrarán en la factura.">
                {(p) => (
                  <Textarea
                    {...p}
                    rows={2}
                    value={draft.privateNotes}
                    onChange={(e) => set("privateNotes", e.target.value)}
                  />
                )}
              </Field>
              <Field label="Tipo de unidad">
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={draft.unit}
                    onChange={(v) => set("unit", v)}
                    groups={[{ options: UNIT_OPTIONS }]}
                  />
                )}
              </Field>
              <TagsField tags={draft.tags} onChange={(tags) => set("tags", tags)} />
            </div>
            <CheckField
              label="Producto visible (activo)"
              hint="Los productos inactivos siguen en el catálogo, pero no se pueden elegir en las facturas."
              checked={draft.active}
              onChange={(v) => set("active", v)}
            />
          </Section>

          <Section title="Referencias" index={2}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Código de producto (SKU)"
                error={errors.sku}
                help="Código para identificar el producto dentro de tu propia empresa. Si lo rellenas, debe ser único: no puede usarlo ningún otro producto."
              >
                {(p) => (
                  <Input {...p} value={draft.sku} onChange={(e) => set("sku", e.target.value)} className="font-mono" />
                )}
              </Field>
              <Field label="Referencia proveedor" help="Código de producto de tu proveedor.">
                {(p) => (
                  <Input
                    {...p}
                    value={draft.supplierRef}
                    onChange={(e) => set("supplierRef", e.target.value)}
                    className="font-mono"
                  />
                )}
              </Field>
            </div>
          </Section>

          <Section
            title="Precio de venta"
            index={3}
            action={advancedToggle(advancedSale, () => {
              if (advancedSale) set("surchargeRate", 0);
              setAdvancedSale((a) => !a);
            })}
          >
            <div className={cn("grid gap-4 sm:grid-cols-2", advancedSale ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
              <Field label="Precio unitario (base imponible)" required error={errors.price} hint="Ej.: 198,50 €">
                {(p) => <MoneyInput {...p} value={draft.price} onChange={(v) => set("price", v)} />}
              </Field>
              <Field
                label="Porcentaje de descuento"
                error={errors.discount}
                help="Descuento que se propone al añadir el producto a una factura."
              >
                {(p) => (
                  <PercentInput {...p} value={draft.discount} placeholder="0" onChange={(v) => set("discount", v)} />
                )}
              </Field>
              <Field label="Porcentaje de IVA" required help={DEFAULT_HELP}>
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={String(draft.vatRate)}
                    onChange={(v) => set("vatRate", Number(v))}
                    groups={[{ options: VAT_RATE_OPTIONS }]}
                  />
                )}
              </Field>
              {advancedSale && (
                <Field label="Porcentaje de RE" error={errors.surcharge} help={DEFAULT_HELP}>
                  {(p) => (
                    <GroupedSelect
                      {...p}
                      value={String(draft.surchargeRate)}
                      onChange={(v) => set("surchargeRate", Number(v))}
                      groups={[{ options: SURCHARGE_OPTIONS }]}
                    />
                  )}
                </Field>
              )}
            </div>
            <Breakdown
              rows={[
                ["Precio descontado", sale.base],
                ["IVA", sale.vat],
                ...(advancedSale ? [["RE", sale.surcharge] as [string, Cents]] : []),
              ]}
              total={["P.V.P.", sale.total]}
            />
          </Section>

          <Section
            title="Coste de adquisición"
            index={4}
            action={advancedToggle(advancedCost, () => {
              if (advancedCost) set("costSurchargeRate", 0);
              setAdvancedCost((a) => !a);
            })}
          >
            <div className={cn("grid gap-4 sm:grid-cols-2", advancedCost ? "xl:grid-cols-3" : "xl:grid-cols-2")}>
              <Field
                label="Coste unitario (base imponible)"
                error={errors.cost}
                help="Lo que te cuesta adquirir el producto más lo necesario para tenerlo disponible (transporte, aduanas…). Indica la base imponible total de esos costes."
              >
                {(p) => <MoneyInput {...p} value={draft.cost} onChange={(v) => set("cost", v)} />}
              </Field>
              <Field label="Porcentaje de IVA" required help="Se propone al añadir el producto a una factura recibida.">
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={String(draft.costVatRate)}
                    onChange={(v) => set("costVatRate", Number(v))}
                    groups={[{ options: VAT_RATE_OPTIONS }]}
                  />
                )}
              </Field>
              {advancedCost && (
                <Field label="Porcentaje de RE" error={errors.costSurcharge}>
                  {(p) => (
                    <GroupedSelect
                      {...p}
                      value={String(draft.costSurchargeRate)}
                      onChange={(v) => set("costSurchargeRate", Number(v))}
                      groups={[{ options: SURCHARGE_OPTIONS }]}
                    />
                  )}
                </Field>
              )}
            </div>
            <Breakdown
              rows={[["IVA", cost.vat], ...(advancedCost ? [["RE", cost.surcharge] as [string, Cents]] : [])]}
              total={["Total", cost.total]}
              extra={
                draft.cost.trim() && sale.base > 0 ? (
                  <>
                    <dt className="text-muted-foreground">Margen</dt>
                    <dd className="m-0 text-right amount">
                      {formatEUR(cents(sale.base - cost.base))}
                      <span className="ml-1.5 text-muted-foreground">
                        ({Math.round(((sale.base - cost.base) / sale.base) * 100)} %)
                      </span>
                    </dd>
                  </>
                ) : null
              }
            />
          </Section>

          <Section title="Campos personalizados" index={5} defaultOpen={draft.custom.some(Boolean)}>
            <div className="grid gap-4 sm:grid-cols-2">
              {settings.customFieldNames.map((label, i) => (
                <Field key={i} label={label}>
                  {(p) => (
                    <Input
                      {...p}
                      value={draft.custom[i]}
                      onChange={(e) => {
                        const custom = [...draft.custom] as Draft["custom"];
                        custom[i] = e.target.value;
                        set("custom", custom);
                      }}
                    />
                  )}
                </Field>
              ))}
            </div>
            <p className="m-0 text-sm text-muted-foreground">
              Cambia sus nombres en la{" "}
              <Link
                to={CATALOG_SETTINGS_PATH}
                className="font-medium text-primary no-underline hover:text-primary-hover"
              >
                configuración del catálogo
              </Link>
              .
            </p>
          </Section>

          <Section title="Control de stock" index={6}>
            <CheckField
              label="Habilitar control de stock"
              hint="Cuenta las unidades que tienes y las que salen con cada venta."
              checked={draft.stockEnabled}
              onChange={(v) => set("stockEnabled", v)}
            />
            {draft.stockEnabled && (
              <div className="flex animate-fade-in flex-col gap-4 border-t border-divider pt-4">
                {!rulesActive(settings.rules) && (
                  <p className="m-0 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
                    Todavía no has elegido en qué documentos se descuenta el stock, así que solo cambiará cuando lo
                    regularices a mano. Configúralo en la{" "}
                    <Link to={CATALOG_SETTINGS_PATH} className="font-medium text-warning underline underline-offset-2">
                      configuración del catálogo
                    </Link>
                    .
                  </p>
                )}
                {asksInitialStock ? (
                  <Field label="Stock inicial" error={errors.initialStock} className="max-w-xs">
                    {(p) => (
                      <div className="flex items-center gap-2">
                        <Input
                          {...p}
                          inputMode="decimal"
                          value={draft.initialStock}
                          placeholder="0"
                          onChange={(e) => set("initialStock", e.target.value)}
                          className="text-right amount"
                        />
                        <span className="text-sm text-muted-foreground">
                          {isCatalogUnit(draft.unit) ? draft.unit : "unidades"}
                        </span>
                      </div>
                    )}
                  </Field>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Stock actual</span>
                    <span className="amount text-lg font-semibold">
                      {formatQuantity(stockOf(movements, existing!.id))}
                    </span>
                    <Link
                      to={`${STOCK_PATH}?producto=${existing!.id}`}
                      className="text-sm font-medium text-primary no-underline hover:text-primary-hover"
                    >
                      Regularizar stock
                    </Link>
                  </div>
                )}
                <CheckField
                  label="Permitir vender sin stock"
                  help="Si marcas esta opción, se podrá vender el producto aunque esté fuera de stock."
                  checked={draft.allowWithoutStock}
                  onChange={(v) => set("allowWithoutStock", v)}
                />
                <CheckField
                  label="Activar alarma de stock"
                  help="Te avisa cuando el stock baje de las unidades que indiques."
                  checked={draft.alarmOn}
                  onChange={(v) => set("alarmOn", v)}
                />
                {draft.alarmOn && (
                  <div className="flex animate-fade-in flex-col gap-3 rounded-lg bg-muted p-4">
                    <Field label="Avisar cuando queden menos de" required error={errors.minUnits} className="max-w-xs">
                      {(p) => (
                        <div className="flex items-center gap-2">
                          <Input
                            {...p}
                            inputMode="decimal"
                            value={draft.minUnits}
                            onChange={(e) => set("minUnits", e.target.value)}
                            className="text-right amount"
                          />
                          <span className="text-sm text-muted-foreground">unidades</span>
                        </div>
                      )}
                    </Field>
                    <CheckField
                      label="Avisar en el inicio"
                      help="Los productos en alerta de stock aparecen en los avisos de la pantalla de inicio hasta que los marques como leídos."
                      checked={draft.dashboard}
                      onChange={(v) => set("dashboard", v)}
                    />
                    <CheckField
                      label="Enviar notificaciones"
                      help="Recibirás un aviso en el programa cuando el stock baje de esas unidades."
                      checked={draft.notification}
                      onChange={(v) => set("notification", v)}
                    />
                    <CheckField
                      label="Enviar correo electrónico"
                      hint={
                        settings.alarmEmail
                          ? `A ${settings.alarmEmail}.`
                          : "Falta el email de avisos en la configuración del catálogo."
                      }
                      checked={draft.email}
                      onChange={(v) => set("email", v)}
                    />
                    {errors.alarm && (
                      <p role="alert" className="m-0 text-xs text-destructive">
                        {errors.alarm}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>

        {actions("lg:hidden")}
      </form>

      <FamilyDialog
        open={choosingFamily}
        onOpenChange={setChoosingFamily}
        value={draft.familyId}
        onSelect={(familyId) => set("familyId", familyId)}
      />
    </TooltipProvider>
  );
}

function MoneyInput({
  value,
  onChange,
  ...props
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <span className="relative flex items-center">
      <Input
        {...props}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-8 text-right amount"
      />
      <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground" aria-hidden="true">
        €
      </span>
    </span>
  );
}

function Breakdown({ rows, total, extra }: { rows: [string, Cents][]; total: [string, Cents]; extra?: ReactNode }) {
  return (
    <dl className="m-0 grid max-w-72 grid-cols-[auto_1fr] gap-x-6 gap-y-1 rounded-lg bg-muted px-4 py-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="m-0 text-right amount">{formatEUR(value)}</dd>
        </div>
      ))}
      <dt className="border-t border-divider pt-1 font-semibold">{total[0]}</dt>
      <dd className="m-0 border-t border-divider pt-1 text-right amount font-semibold">{formatEUR(total[1])}</dd>
      {extra}
    </dl>
  );
}
