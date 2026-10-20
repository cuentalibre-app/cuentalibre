import type { ReactNode } from "react";
import { BookOpen, Globe } from "lucide-react";
import { table } from "@fiscalia/ui/lib/table";
import { AEAT_LINKS, type FormCode } from "./taxes-model";

/* What each form is for, who files it and when, as Contasimple explains it before computing it. */

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
  /** "Liquidación (puede conllevar un pago a la Agencia Tributaria)." */
  kind: string;
  periodicity: ReactNode;
  /** One row per quarter, or a text for yearly and special deadlines. */
  deadlines: [quarter: string, deadline: string][] | ReactNode;
  links: { label: string; href: string }[];
  /** How to file it, shown next to the computed boxes. */
  steps: string[];
}

const QUARTERS = [
  "Primer Trimestre (1T, de Enero a Marzo)",
  "Segundo Trimestre (2T, de Abril a Junio)",
  "Tercer Trimestre (3T, de Julio a Septiembre)",
  "Cuarto Trimestre (4T, de Octubre a Diciembre)",
];

/** Quarterly deadlines; 303, 130 and 349 give until January 30th for the fourth quarter. */
const quarterDeadlines = (lastDay: 20 | 30): [string, string][] => [
  [QUARTERS[0]!, "Del 1 al 20 de abril."],
  [QUARTERS[1]!, "Del 1 al 20 de julio."],
  [QUARTERS[2]!, "Del 1 al 20 de octubre."],
  [
    QUARTERS[3]!,
    lastDay === 30
      ? "Del 1 al 30 de enero (en el cuarto trimestre se permite un plazo mayor)."
      : "Del 1 al 20 de enero.",
  ],
];

const PAPER_OR_ONLINE = (
  <>
    Este modelo puede presentarse por vía telemática (si se dispone de Certificado Digital, lector de DNI Electrónico o{" "}
    <ClavePin />) o mediante papel; en ambos casos, la forma de proceder es cumplimentando un formulario en la web de la
    Agencia Tributaria que, o bien generará el PDF para su impresión en papel (proceso que recibe el nombre de
    predeclaración), o bien realizará la presentación telemática del modelo.
  </>
);

const ONLINE_ONLY = (form: string) => [
  `La cumplimentación de este modelo debe realizarse directamente a través de la web de la Agencia Tributaria: ya no está disponible la cumplimentación a través del programa de ayuda Plataformas Informativas.`,
  <>
    Se requiere de Certificado Digital o <ClavePin /> para poder presentar el modelo {form}.
  </>,
];

const NO_VAT_REGIONS =
  "Los usuarios de las Islas Canarias, Ceuta o Melilla, al no trabajar con IVA, no deben presentarlo; no obstante, existe un modelo equivalente para el impuesto aplicable a su región.";

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
  label: `Página de presentación del modelo ${form} en la web de la Agencia Tributaria`,
  href: AEAT_LINKS[form],
});
const fillIn = (form: FormCode) => ({
  label: `Página para la cumplimentación y presentación del modelo ${form} en la web de la Agencia Tributaria`,
  href: AEAT_LINKS[form],
});
const claveInfo = {
  label: "Información sobre el sistema Cl@ve PIN en la web de la Agencia Tributaria",
  href: CLAVE_PIN,
};

const ANNUAL_INFORMATIVE: Pick<FormFacts, "kind" | "periodicity" | "deadlines"> = {
  kind: "Informativo.",
  periodicity: "Anual",
  deadlines: (
    <>
      Presentación telemática: del 1 al 31 de enero. Para más información, consulta el <Calendar />.
    </>
  ),
};

export const FACTS: Record<FormCode, FormFacts> = {
  "303": {
    title: "Modelo 303",
    description: [
      "Declara a la Agencia Tributaria la diferencia entre los importes de IVA facturados y soportados durante el periodo (trimestre) informado. El resultado puede ser cero (si durante el periodo no se ha tenido actividad), positivo (si sale a pagar) o negativo (cuando se ha soportado más IVA del que se ha repercutido).",
      "Cuando es negativo, la Agencia Tributaria te lo guarda para compensarlo en el siguiente periodo, y puedes solicitar la devolución del importe en el último trimestre del año.",
      <>
        Este modelo puede presentarse por vía telemática a través de la web de la Agencia Tributaria identificándose con
        el Certificado Digital, el DNI Electrónico o el sistema <ClavePin />, o mediante papel siempre que se haya
        generado cumplimentando el formulario de predeclaración de la web de la Agencia Tributaria.
      </>,
      NO_VAT_REGIONS,
    ],
    kind: "Liquidación (puede conllevar un pago a la Agencia Tributaria).",
    periodicity: "Trimestral",
    deadlines: quarterDeadlines(30),
    links: [presentation("303"), claveInfo],
    steps: IMPORT_STEPS("303"),
  },
  "390": {
    title: "Modelo 390",
    description: [
      "Declara a la Agencia Tributaria un resumen del IVA facturado y soportado durante el ejercicio (año) informado.",
      <>
        Este modelo puede presentarse por vía telemática a través de la web de la Agencia Tributaria identificándose con
        el Certificado Digital, el DNI Electrónico o el sistema <ClavePin />.
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
      "Declara a la Agencia Tributaria el resumen de los ingresos, los gastos y las retenciones obtenidos desde principios de año hasta el periodo (trimestre) seleccionado.",
      "Este modelo solo tienen que presentarlo los autónomos, pero los que facturan más de un 70 % con retención pueden quedar exentos siempre que lo soliciten a la Agencia Tributaria (mediante el modelo 036 o 037). Si cumples las condiciones para no presentarlo pero no has solicitado la exoneración, debes presentarlo hasta que la solicites.",
      "La retención para actividades profesionales es del 15 %; no obstante, los autónomos que acaban de darse de alta pueden aplicar un tipo reducido (del 7 %) durante el año del alta y los dos siguientes.",
      "La retención solo debe aplicarse al facturar a quienes tienen obligación de ingresar las retenciones, es decir, sociedades y autónomos, pero no al facturar a particulares.",
      PAPER_OR_ONLINE,
    ],
    kind: "Liquidación (puede conllevar un pago a la Agencia Tributaria).",
    periodicity: "Trimestral",
    deadlines: quarterDeadlines(30),
    links: [presentation("130")],
    steps: IMPORT_STEPS("130"),
  },
  "100": {
    title: "Modelo 100 - Declaración de la renta anual",
    description: [
      "Declara a la Agencia Tributaria el resumen de los ingresos, los gastos y las retenciones obtenidos durante el año informado.",
      "La Agencia Tributaria ofrece una aplicación online gratuita, Renta WEB, para ayudarte a realizar esta declaración. Esta aplicación sustituye al programa PADRE, que ha dejado de estar disponible.",
      "Además, la Agencia Tributaria ofrece un servicio para descargar e importar tus datos fiscales en Renta WEB. Requiere un código de referencia que puedes solicitar en la propia web de la Agencia Tributaria.",
      "Para solicitar el código de referencia necesitas un certificado digital o conocer ciertos datos de tu renta del año anterior, que validan tu identidad.",
      "Te recomendamos encarecidamente que repases los datos fiscales que te faciliten, ya que en ocasiones contienen errores, y aunque esos errores vengan de la información de la Agencia Tributaria, tú eres el único responsable de tu declaración.",
    ],
    kind: "Liquidación (puede conllevar un pago a la Agencia Tributaria).",
    periodicity: "Anual",
    deadlines: (
      <>
        Pueden variar ligeramente de un año a otro, pero generalmente el plazo va desde principios de abril hasta
        finales de junio. Para más información, consulta el <Calendar />.
      </>
    ),
    links: [
      {
        label: "Página oficial de la campaña de la renta en la web de la Agencia Tributaria",
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
      "Declara a la Agencia Tributaria el importe a pagar por las retenciones aplicadas a las facturas recibidas, al sueldo de los trabajadores y a los premios por la participación en juegos, concursos, rifas o combinaciones aleatorias.",
      PAPER_OR_ONLINE,
    ],
    kind: "Liquidación (puede conllevar un pago a la Agencia Tributaria).",
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
      "Informa a la Agencia Tributaria de las retenciones aplicadas a las facturas recibidas, al sueldo de los trabajadores y a los premios por la participación en juegos, concursos, rifas o combinaciones aleatorias a lo largo del ejercicio (año).",
      ...ONLINE_ONLY("190"),
    ],
    ...ANNUAL_INFORMATIVE,
    links: [fillIn("190")],
    steps: ONLINE_STEPS("190"),
  },
  "115": {
    title: "Modelo 115",
    description: [
      "Declara a la Agencia Tributaria las retenciones a pagar por el alquiler de inmuebles urbanos; por ejemplo, por el alquiler del local donde desarrollas tu actividad, si lo alquilas.",
      PAPER_OR_ONLINE,
    ],
    kind: "Liquidación (siempre conlleva un pago a Hacienda).",
    periodicity: "Trimestral",
    deadlines: quarterDeadlines(20),
    links: [presentation("115")],
    steps: IMPORT_STEPS("115"),
  },
  "180": {
    title: "Modelo 180",
    description: [
      "Informa a la Agencia Tributaria de las retenciones de los alquileres de inmuebles urbanos durante el ejercicio (año) informado.",
      ...ONLINE_ONLY("180"),
    ],
    ...ANNUAL_INFORMATIVE,
    links: [
      fillIn("180"),
      {
        label: "Ver preguntas frecuentes del modelo 180",
        href: "https://sede.agenciatributaria.gob.es/Sede/impuestos-tasas/declaraciones-informativas/modelo-180-decla_____arrendamiento-inmuebles-urbanos-anual_/preguntas-frecuentes.html",
      },
    ],
    steps: ONLINE_STEPS("180"),
  },
  "347": {
    title: "Modelo 347",
    description: [
      "Informa a la Agencia Tributaria de las operaciones realizadas con un cliente o proveedor que en cómputo anual superen los 3.005,06 € (IVA incluido) y que no se hayan declarado en otro modelo: se excluyen del cómputo las facturas con retención, las intracomunitarias y las de exportación e importación.",
      "Al informar de las operaciones se indica si son compras o ventas. Si con la misma empresa o autónomo has operado como cliente y como proveedor, y cada conjunto supera esa cantidad, se declaran ambos por separado.",
      "Desde el 1 de febrero de 2018 este modelo se cumplimenta directamente en la web de la Agencia Tributaria: ya no está disponible el programa de ayuda Plataformas Informativas.",
      <>
        Se requiere de Certificado Digital o <ClavePin /> para acceder a esa página.
      </>,
    ],
    kind: "Informativo, no conlleva ningún pago ni cobro a la Agencia Tributaria.",
    periodicity: "Anual",
    deadlines: (
      <>
        Del 1 al 28 de febrero (o 29 en años bisiestos). Si el último día cae en fin de semana o festivo, generalmente
        se aplaza al siguiente día laborable; en caso de duda, consulta el <Calendar />.
      </>
    ),
    links: [fillIn("347")],
    steps: ONLINE_STEPS("347"),
  },
  "349": {
    title: "Modelo 349",
    description: [
      "Informa a la Agencia Tributaria de las operaciones realizadas con un cliente o proveedor intracomunitario, es decir, tanto de las compras como de las ventas de bienes o servicios a empresas de otro país de la Unión Europea.",
      "Una operación es intracomunitaria si tanto el emisor como el receptor están inscritos en el Registro de Operadores Intracomunitarios (ROI), también conocido como VIES (VAT Information Exchange System). En ese caso las facturas van sin IVA y deben registrarse con el tipo de operación Intracomunitaria.",
      "No existe un formulario en PDF para este modelo: se genera y presenta desde la página de presentación del modelo 349 de la Agencia Tributaria.",
    ],
    kind: "Informativo, no conlleva ningún pago ni cobro a la Agencia Tributaria.",
    periodicity: (
      <ul className="m-0 flex flex-col gap-1 pl-4">
        <li>
          Trimestral: cuando ni en el trimestre de referencia ni en ninguno de los cuatro trimestres naturales
          anteriores el importe total de las entregas de bienes y prestaciones de servicios intracomunitarias supere
          50.000 €, sin IVA.
        </li>
        <li>
          Bimensual: si al final del segundo mes de un trimestre natural se supera ese importe, se presenta una
          declaración por los meses transcurridos del trimestre. A partir del tercer mes, ya es mensual.
        </li>
        <li>Mensual: en cualquier otro caso.</li>
      </ul>
    ),
    deadlines: (
      <ul className="m-0 flex flex-col gap-1 pl-4">
        <li>
          Presentación trimestral: del 1 al 20 del mes siguiente al trimestre (abril, julio y octubre). La del 4T se
          prolonga hasta el 30 de enero.
        </li>
        <li>
          Presentación mensual: del 1 al 20 del mes siguiente, salvo diciembre, que se extiende hasta el 30 de enero, y
          julio, que puede presentarse en agosto y los 20 primeros días de septiembre.
        </li>
        <li>
          Para más información, consulta el <Calendar />.
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
      <dl className="m-0 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
        <dt className="font-medium">Descripción</dt>
        <dd className="m-0 flex flex-col gap-2 text-muted-foreground">
          {facts.description.map((p, i) => (
            <p key={i} className="m-0">
              {p}
            </p>
          ))}
        </dd>
        <dt className="font-medium">Tipo de modelo</dt>
        <dd className="m-0 text-muted-foreground">{facts.kind}</dd>
        <dt className="font-medium">Periodicidad</dt>
        <dd className="m-0 text-muted-foreground">{facts.periodicity}</dd>
        <dt className="font-medium">Plazos</dt>
        <dd className="m-0 text-muted-foreground">
          {Array.isArray(facts.deadlines) ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
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
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
        {facts.links.map((l) => (
          <li key={l.href} className="flex items-start gap-2">
            <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            <ExternalLink href={l.href}>{l.label}</ExternalLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The same facts next to the computed boxes, folded away, with the steps to file it. */
export function FormInfo({ form }: { form: FormCode }) {
  const facts = FACTS[form];
  return (
    <details className="group rounded-xl border border-border px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <BookOpen className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        Sobre el modelo {form} y cómo presentarlo
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        <FormFactsList form={form} />
        <div className="flex flex-col gap-1.5">
          <span className="font-medium">Cómo presentarlo</span>
          <ol className="m-0 flex flex-col gap-0.5 pl-4 text-muted-foreground">
            {facts.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
    </details>
  );
}
