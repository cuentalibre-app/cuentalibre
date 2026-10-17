import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { AEAT_LINKS, type FormCode } from "./taxes-model";

/* What each form is for, who files it and how: the reference app's information pages, folded away. */

interface FormFacts {
  description: ReactNode;
  kind: "Liquidación" | "Informativo";
  /** "Puede salir a pagar", "No conlleva pagos"… */
  kindDetail: string;
  periodicity: string;
  deadlines: string[];
  steps: string[];
}

const QUARTER_DEADLINES_20 = [
  "1T (enero a marzo): del 1 al 20 de abril.",
  "2T (abril a junio): del 1 al 20 de julio.",
  "3T (julio a septiembre): del 1 al 20 de octubre.",
  "4T (octubre a diciembre): del 1 al 20 de enero.",
];

const IMPORT_STEPS = (form: string) => [
  "Descarga el fichero cuando esté disponible o ten a mano las casillas de esta página.",
  `Entra en la página de trámites del modelo ${form} en la sede de la AEAT.`,
  "Para presentarlo en papel (solo personas físicas) usa la opción Predeclaración; para presentarlo por internet, Presentación (con certificado digital o Cl@ve).",
  "Elige Presentador: Empresa en el diálogo de nueva declaración.",
  "Importa el fichero desde el botón Importar o copia cada casilla haciendo clic en su importe.",
  "Si sale a ingresar, puedes domiciliar el pago con tu IBAN en la propia sede.",
  "Revisa los datos y envía la declaración.",
];

const ONLINE_STEPS = (form: string) => [
  `Entra en la página del modelo ${form} en la sede de la AEAT con certificado digital o Cl@ve.`,
  "Completa los datos del declarante (los tuyos) y el número total de registros.",
  "Añade un registro por cada línea de esta página: copia cada dato haciendo clic en él.",
  "Valida la declaración y preséntala.",
];

const FACTS: Partial<Record<FormCode, FormFacts>> = {
  "111": {
    description:
      "Declara e ingresa las retenciones que has practicado en las facturas de profesionales, en las nóminas de tus trabajadores y en premios. Lo que retienes no es tuyo: lo adelantas a Hacienda en nombre de quien te factura.",
    kind: "Liquidación",
    kindDetail: "Puede salir a pagar.",
    periodicity: "Trimestral",
    deadlines: QUARTER_DEADLINES_20,
    steps: IMPORT_STEPS("111"),
  },
  "190": {
    description:
      "Resumen anual del modelo 111: informa, perceptor por perceptor, de las retenciones practicadas durante el año. Se cumplimenta directamente en la web de la AEAT, ya no con el programa de ayuda.",
    kind: "Informativo",
    kindDetail: "No conlleva pagos ni cobros.",
    periodicity: "Anual",
    deadlines: ["Del 1 al 31 de enero del año siguiente."],
    steps: ONLINE_STEPS("190"),
  },
  "115": {
    description:
      "Declara e ingresa las retenciones de los alquileres de inmuebles urbanos que pagas por tu actividad, como un local, una oficina o un almacén.",
    kind: "Liquidación",
    kindDetail: "Siempre conlleva un pago si has retenido.",
    periodicity: "Trimestral",
    deadlines: QUARTER_DEADLINES_20,
    steps: IMPORT_STEPS("115"),
  },
  "180": {
    description:
      "Resumen anual del modelo 115: informa de cada arrendador y cada inmueble, con lo pagado y lo retenido en el año.",
    kind: "Informativo",
    kindDetail: "No conlleva pagos ni cobros.",
    periodicity: "Anual",
    deadlines: ["Del 1 al 31 de enero del año siguiente."],
    steps: ONLINE_STEPS("180"),
  },
  "347": {
    description:
      "Informa de los clientes y proveedores con los que has superado 3.005,06 € en el año, IVA incluido, que no se declaran ya en otro modelo: se excluyen las facturas con retención, las intracomunitarias y las de importación y exportación. Compras y ventas con la misma persona se declaran por separado.",
    kind: "Informativo",
    kindDetail: "No conlleva pagos ni cobros.",
    periodicity: "Anual",
    deadlines: ["Del 1 al 28 de febrero (29 en bisiesto); si cae en fin de semana, se pasa al lunes."],
    steps: ONLINE_STEPS("347"),
  },
  "349": {
    description:
      "Informa de las compras y ventas de bienes y servicios con empresas de otros países de la UE inscritas en el ROI (VIES). Esas facturas van sin IVA y con el tipo de operación Intracomunitaria.",
    kind: "Informativo",
    kindDetail: "No conlleva pagos ni cobros.",
    periodicity:
      "Trimestral si en el trimestre y en los cuatro anteriores no superas 50.000 € de entregas de bienes y servicios; si los superas, mensual (bimensual el trimestre en que los superas por primera vez).",
    deadlines: [
      "Trimestral: del 1 al 20 del mes siguiente al trimestre; el 4T, hasta el 30 de enero.",
      "Mensual: del 1 al 20 del mes siguiente; julio hasta el 20 de septiembre y diciembre hasta el 30 de enero.",
    ],
    steps: [
      "Entra en la página del modelo 349 en la sede de la AEAT con certificado digital o Cl@ve.",
      "Elige la presentación mediante formulario (o mediante fichero, cuando esté disponible) para el ejercicio.",
      "Añade un registro por operador y clave con los datos de esta página.",
      "Valida y envía la declaración.",
    ],
  },
};

export function FormInfo({ form }: { form: FormCode }) {
  const facts = FACTS[form];
  if (!facts) return null;
  return (
    <details className="group rounded-xl border border-border px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <BookOpen className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        Sobre el modelo {form}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="m-0 text-muted-foreground">{facts.description}</p>
        <dl className="m-0 grid gap-x-6 gap-y-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <dt className="font-medium">Tipo</dt>
          <dd className="m-0 text-muted-foreground">
            {facts.kind}. {facts.kindDetail}
          </dd>
          <dt className="font-medium">Periodicidad</dt>
          <dd className="m-0 text-muted-foreground">{facts.periodicity}</dd>
          <dt className="font-medium">Plazos</dt>
          <dd className="m-0 text-muted-foreground">
            <ul className="m-0 flex flex-col gap-0.5 pl-4">
              {facts.deadlines.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </dd>
          <dt className="font-medium">Cómo presentarlo</dt>
          <dd className="m-0 text-muted-foreground">
            <ol className="m-0 flex flex-col gap-0.5 pl-4">
              {facts.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </dd>
        </dl>
        <p className="m-0 flex flex-wrap gap-x-4 gap-y-1">
          <a href={AEAT_LINKS[form]} target="_blank" rel="noreferrer" className="text-primary">
            Página del modelo {form} en la sede de la AEAT
          </a>
          <a
            href="https://sede.agenciatributaria.gob.es/Sede/Bibl_virtual/folletos/calendario_contribuyente.shtml"
            target="_blank"
            rel="noreferrer"
            className="text-primary"
          >
            Calendario del contribuyente
          </a>
        </p>
      </div>
    </details>
  );
}
