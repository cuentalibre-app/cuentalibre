import type { ReactNode } from "react";
import { BookOpen, ChevronDown, Globe } from "lucide-react";
import { table } from "@cuentalibre/ui/lib/table";
import { AEAT_LINKS, type FormCode } from "./taxes-model";

/* What each form is for, who files it and when, shown before computing it. */

export const TAXPAYER_CALENDAR =
  "https://sede.agenciatributaria.gob.es/Sede/Bibl_virtual/folletos/calendario_contribuyente.shtml";
const CLAVE_PIN = "https://sede.agenciatributaria.gob.es/Sede/identificacion-digital/clave/preguntas-frecuentes.html";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary">
      {children}
    </a>
  );
}

const ClavePin = () => <ExternalLink href={CLAVE_PIN}>Cl@ve PIN</ExternalLink>;
const Calendar = () => (
  <ExternalLink href={TAXPAYER_CALENDAR}>Calendario del Contribuyente de la Agencia Tributaria</ExternalLink>
);

interface FormFacts {
  title: string;
  description: ReactNode[];
  /** "Liquidación: puede salir a pagar." */
  kind: string;
  periodicity: ReactNode;
  /** One row per quarter, or a text for yearly and special deadlines. */
  deadlines: [quarter: string, deadline: string][] | ReactNode;
  links: { label: string; href: string }[];
  /** How to file it, shown next to the computed boxes. */
  steps: string[];
}

const QUARTERS = ["1T (enero a marzo)", "2T (abril a junio)", "3T (julio a septiembre)", "4T (octubre a diciembre)"];

/** Quarterly deadlines; 303, 130 and 349 give until January 30th for the fourth quarter. */
const quarterDeadlines = (lastDay: 20 | 30): [string, string][] => [
  [QUARTERS[0]!, "Del 1 al 20 de abril."],
  [QUARTERS[1]!, "Del 1 al 20 de julio."],
  [QUARTERS[2]!, "Del 1 al 20 de octubre."],
  [
    QUARTERS[3]!,
    lastDay === 30 ? "Del 1 al 30 de enero: el último trimestre tiene diez días más." : "Del 1 al 20 de enero.",
  ],
];

const PAPER_OR_ONLINE = (
  <>
    Se rellena en la sede de la AEAT. Desde ahí lo envías por internet (con certificado digital, DNI electrónico o{" "}
    <ClavePin />) o sacas una predeclaración en PDF para entregarla en papel.
  </>
);

const ONLINE_ONLY = (form: string) => [
  <>
    El {form} solo se rellena en el formulario de la sede de la AEAT, y para entrar hace falta certificado digital o{" "}
    <ClavePin />.
  </>,
];

const NO_VAT_REGIONS =
  "En Canarias, Ceuta y Melilla no se aplica el IVA, así que no se presenta: allí hay un modelo propio para su impuesto indirecto.";

const IMPORT_STEPS = (form: string) => [
  "Descarga el fichero cuando esté disponible o ten a mano las casillas de esta página.",
  `Entra en la página de trámites del modelo ${form} en la sede de la AEAT.`,
  "Para presentarlo en papel (solo personas físicas) usa la opción Predeclaración; para presentarlo por internet, Presentación (con certificado digital o Cl@ve).",
  "Importa el fichero o copia cada casilla haciendo clic en su importe.",
  "Si sale a ingresar, puedes domiciliar el pago con tu IBAN en la propia sede.",
  "Revisa los datos y envía la declaración.",
];

const ONLINE_STEPS = (form: string) => [
  `Entra en la página del modelo ${form} en la sede de la AEAT con certificado digital o Cl@ve.`,
  "Completa los datos del declarante (los tuyos) y el número total de registros.",
  "Añade un registro por cada línea de esta página: copia cada dato haciendo clic en él.",
  "Valida la declaración y preséntala.",
];

const presentation = (form: FormCode) => ({
  label: `Presentar el modelo ${form} en la sede de la AEAT`,
  href: AEAT_LINKS[form],
});
const fillIn = (form: FormCode) => ({
  label: `Rellenar y presentar el modelo ${form} en la sede de la AEAT`,
  href: AEAT_LINKS[form],
});
const claveInfo = {
  label: "Qué es Cl@ve PIN y cómo obtenerlo",
  href: CLAVE_PIN,
};

const ANNUAL_INFORMATIVE: Pick<FormFacts, "kind" | "periodicity" | "deadlines"> = {
  kind: "Informativo.",
  periodicity: "Anual",
  deadlines: (
    <>
      Por internet, del 1 al 31 de enero. Fechas exactas en el <Calendar />.
    </>
  ),
};

export const FACTS: Record<FormCode, FormFacts> = {
  "303": {
    title: "Modelo 303",
    description: [
      "La autoliquidación trimestral del IVA: el IVA que has cobrado en tus facturas menos el que has pagado en tus compras. Sale a pagar si cobraste más del que pagaste, a cero si no hubo movimiento y negativo en caso contrario.",
      "Un resultado negativo se arrastra para descontarlo en los trimestres siguientes; en el 4T puedes pedir que te lo devuelvan.",
      PAPER_OR_ONLINE,
      NO_VAT_REGIONS,
    ],
    kind: "Liquidación: puede salir a pagar.",
    periodicity: "Trimestral",
    deadlines: quarterDeadlines(30),
    links: [presentation("303"), claveInfo],
    steps: IMPORT_STEPS("303"),
  },
  "390": {
    title: "Modelo 390",
    description: [
      "El resumen del año de todo el IVA cobrado y pagado, que tiene que cuadrar con los 303 de cada trimestre.",
      <>
        Se presenta por internet en la sede de la AEAT, con certificado digital, DNI electrónico o <ClavePin />.
      </>,
      NO_VAT_REGIONS,
    ],
    kind: "Informativo.",
    periodicity: "Anual",
    deadlines: (
      <>
        Del 1 al 30 de enero (<Calendar />
        ).
      </>
    ),
    links: [presentation("390"), claveInfo],
    steps: IMPORT_STEPS("390"),
  },
  "130": {
    title: "Modelo 130",
    description: [
      "El pago a cuenta del IRPF de los autónomos: ingresos, gastos y retenciones acumulados desde el 1 de enero hasta el final del trimestre.",
      "Si al menos el 70 % de lo que facturas lleva retención, puedes dejar de presentarlo, pero solo después de comunicarlo con el modelo 036 o 037. Mientras no lo comuniques, sigue siendo obligatorio.",
      "Los profesionales retienen un 15 % en sus facturas, o un 7 % el año en que se dan de alta y los dos siguientes.",
      "Solo se retiene al facturar a empresas y autónomos; a los particulares no.",
      PAPER_OR_ONLINE,
    ],
    kind: "Liquidación: puede salir a pagar.",
    periodicity: "Trimestral",
    deadlines: quarterDeadlines(30),
    links: [presentation("130")],
    steps: IMPORT_STEPS("130"),
  },
  "100": {
    title: "Modelo 100 - Declaración de la renta anual",
    description: [
      "La declaración anual del IRPF. Aquí ves el rendimiento de tu actividad en el año, que es lo que pasa a la renta.",
      "La renta se hace en Renta WEB, en la sede de la AEAT. Para entrar necesitas certificado digital, Cl@ve o un número de referencia, que se pide con la casilla 505 de la renta del año anterior.",
      "Renta WEB carga tus datos fiscales, pero a veces tienen errores: revísalos, porque responde de la declaración quien la firma.",
    ],
    kind: "Liquidación: puede salir a pagar.",
    periodicity: "Anual",
    deadlines: (
      <>
        Suele ir de principios de abril a finales de junio; las fechas exactas de cada año están en el <Calendar />.
      </>
    ),
    links: [
      {
        label: "Campaña de la renta en la sede de la AEAT",
        href: "https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G229.shtml",
      },
    ],
    steps: [
      "Exporta los libros registro desde Exportar › Libros.",
      "Entra en Renta WEB y ve a la página D1. Rendimientos de actividades económicas en estimación directa.",
      "En Actividades económicas realizadas y rendimientos obtenidos, marca la casilla para usar la importación de libros de registro.",
      "Completa el resto de datos que se piden e importa el fichero, o copia cada casilla haciendo clic en su importe.",
    ],
  },
  "111": {
    title: "Modelo 111",
    description: [
      "Ingresa en Hacienda lo que has retenido en el trimestre: a los profesionales que te facturan, a tus trabajadores en sus nóminas y a quienes hayas dado premios.",
      PAPER_OR_ONLINE,
    ],
    kind: "Liquidación: puede salir a pagar.",
    periodicity: "Trimestral",
    deadlines: quarterDeadlines(20),
    links: [presentation("111"), claveInfo],
    steps: [
      ...IMPORT_STEPS("111").slice(0, 3),
      "Tanto si eres autónomo como sociedad, elige Presentador: Empresa en el diálogo de nueva declaración.",
      ...IMPORT_STEPS("111").slice(3),
    ],
  },
  "190": {
    title: "Modelo 190",
    description: [
      "El resumen anual del 111: cuánto has pagado y retenido a cada profesional, trabajador o premiado durante el año.",
      ...ONLINE_ONLY("190"),
    ],
    ...ANNUAL_INFORMATIVE,
    links: [fillIn("190")],
    steps: ONLINE_STEPS("190"),
  },
  "115": {
    title: "Modelo 115",
    description: [
      "Ingresa en Hacienda la retención de los alquileres de inmuebles urbanos que pagas, como el del local o la oficina donde trabajas.",
      PAPER_OR_ONLINE,
    ],
    kind: "Liquidación: siempre sale a pagar.",
    periodicity: "Trimestral",
    deadlines: quarterDeadlines(20),
    links: [presentation("115")],
    steps: IMPORT_STEPS("115"),
  },
  "180": {
    title: "Modelo 180",
    description: [
      "El resumen anual del 115: cada arrendador e inmueble, con lo pagado y retenido en el año.",
      ...ONLINE_ONLY("180"),
    ],
    ...ANNUAL_INFORMATIVE,
    links: [
      fillIn("180"),
      {
        label: "Preguntas frecuentes del modelo 180",
        href: "https://sede.agenciatributaria.gob.es/Sede/impuestos-tasas/declaraciones-informativas/modelo-180-decla_____arrendamiento-inmuebles-urbanos-anual_/preguntas-frecuentes.html",
      },
    ],
    steps: ONLINE_STEPS("180"),
  },
  "347": {
    title: "Modelo 347",
    description: [
      "Lista los clientes y proveedores con los que has superado 3.005,06 € en el año, IVA incluido. No cuentan las operaciones que ya van en otro modelo: facturas con retención, intracomunitarias, importaciones y exportaciones.",
      "Compras y ventas se declaran por separado: si con alguien has comprado y vendido por encima del límite, aparece dos veces.",
      ...ONLINE_ONLY("347"),
    ],
    kind: "Informativo: no se paga ni se cobra nada.",
    periodicity: "Anual",
    deadlines: (
      <>
        Febrero entero. Si el último día es inhábil, el plazo pasa al siguiente día hábil; confírmalo en el <Calendar />
        .
      </>
    ),
    links: [fillIn("347")],
    steps: ONLINE_STEPS("347"),
  },
  "349": {
    title: "Modelo 349",
    description: [
      "Las compras y ventas de bienes y servicios con empresas de otros países de la UE, empresa por empresa.",
      "Para que una operación sea intracomunitaria, las dos partes tienen que estar dadas de alta en el ROI, el registro que se consulta en el VIES. Esas facturas van sin IVA y se registran con el tipo de operación Intracomunitaria.",
      "No hay PDF: se rellena y se envía desde la sede de la AEAT.",
    ],
    kind: "Informativo: no se paga ni se cobra nada.",
    periodicity: (
      <ul className="m-0 flex flex-col gap-1 pl-4">
        <li>
          Trimestral, si las ventas de bienes y servicios a la UE no pasan de 50.000 € (sin IVA) ni en el trimestre ni
          en ninguno de los cuatro anteriores.
        </li>
        <li>
          Si se pasa del límite en el segundo mes de un trimestre, se presenta una declaración por esos dos meses y
          desde ahí, cada mes.
        </li>
        <li>Mensual: en cualquier otro caso.</li>
      </ul>
    ),
    deadlines: (
      <ul className="m-0 flex flex-col gap-1 pl-4">
        <li>Trimestral: del 1 al 20 de abril, julio y octubre, y hasta el 30 de enero para el 4T.</li>
        <li>
          Mensual: del 1 al 20 del mes siguiente. Julio se presenta hasta el 20 de septiembre y diciembre, hasta el 30
          de enero.
        </li>
        <li>
          Fechas exactas en el <Calendar />.
        </li>
      </ul>
    ),
    links: [presentation("349")],
    steps: [
      "Entra en la página del modelo 349 en la sede de la AEAT con certificado digital o Cl@ve.",
      "Elige la presentación mediante formulario (o mediante fichero, cuando esté disponible) para el ejercicio.",
      "Añade un registro por operador y clave con los datos de esta página.",
      "Valida y envía la declaración.",
    ],
  },
};

/** Description, kind, periodicity, deadlines and official links of a form. */
export function FormFactsList({ form }: { form: FormCode }) {
  const facts = FACTS[form];
  return (
    <div className="flex flex-col gap-4">
      <dl className="m-0 grid gap-x-6 gap-y-4 text-[0.9375rem] leading-relaxed sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="font-semibold">Descripción</dt>
        <dd className="m-0 flex flex-col gap-2.5 text-foreground/85">
          {facts.description.map((p, i) => (
            <p key={i} className="m-0">
              {p}
            </p>
          ))}
        </dd>
        <dt className="font-semibold">Tipo de modelo</dt>
        <dd className="m-0 text-foreground/85">{facts.kind}</dd>
        <dt className="font-semibold">Periodicidad</dt>
        <dd className="m-0 text-foreground/85">{facts.periodicity}</dd>
        <dt className="font-semibold">Plazos</dt>
        <dd className="m-0 text-foreground/85">
          {Array.isArray(facts.deadlines) ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full border-collapse">
                <thead>
                  <tr className={table.headRow}>
                    <th className={table.th}>Trimestre</th>
                    <th className={table.th}>Plazos</th>
                  </tr>
                </thead>
                <tbody>
                  {facts.deadlines.map(([quarter, deadline]) => (
                    <tr key={quarter} className={table.row}>
                      <td className={table.td}>{quarter}</td>
                      <td className={table.td}>{deadline}</td>
                    </tr>
                  ))}
                  <tr className={table.row}>
                    <td colSpan={2} className={table.td}>
                      <Calendar />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            facts.deadlines
          )}
        </dd>
      </dl>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[0.9375rem]">
        {facts.links.map((l) => (
          <li key={l.href} className="flex items-start gap-2">
            <Globe className="mt-1 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            <ExternalLink href={l.href}>{l.label}</ExternalLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The same facts next to the computed boxes, with the steps to file it; open by default, foldable. */
export function FormInfo({ form }: { form: FormCode }) {
  const facts = FACTS[form];
  return (
    <details open className="group rounded-xl border border-border bg-card px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-semibold [&::-webkit-details-marker]:hidden">
        <BookOpen className="size-4.5 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        Sobre el modelo {form} y cómo presentarlo
        <ChevronDown
          className="ml-auto size-4 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </summary>
      <div className="mt-4 flex flex-col gap-5">
        <FormFactsList form={form} />
        <div className="flex flex-col gap-2 text-[0.9375rem] leading-relaxed">
          <span className="font-semibold">Cómo presentarlo</span>
          <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-foreground/85 marker:text-muted-foreground">
            {facts.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
    </details>
  );
}
