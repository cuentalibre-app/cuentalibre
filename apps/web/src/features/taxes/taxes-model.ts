import { defaultPeriod, EXPENSE_BOXES_100, type CalendarStatus, type FilingStatus, type Period } from "@fiscalia/core";
import type { TaxSetup } from "@fiscalia/contracts";
import type { BadgeProps } from "@fiscalia/ui/components/badge";

export const TAXES_PATH = "/impuestos";
export const VAT_PATH = "/impuestos/iva";
export const INCOME_TAX_PATH = "/impuestos/irpf";
export const CALENDAR_PATH = "/impuestos/calendario";
export const WITHHOLDINGS_PATH = "/impuestos/retenciones";
export const RENTALS_PATH = "/impuestos/alquileres";
export const THIRD_PARTIES_PATH = "/impuestos/terceras-personas";
export const INTRA_EU_PATH = "/impuestos/intracomunitarias";

/** A model page opened on a period: "/impuestos/iva?periodo=2026-T3". */
export function modelPath(path: string, period: Period): string {
  const key = period.quarter === null ? String(period.year) : `${period.year}-T${period.quarter}`;
  return `${path}?periodo=${key}`;
}

/** Switching to a quarterly form keeps the year: the quarter being filed, or Q4 of past years. */
export function quarterOf(year: number, today: Date): Period {
  const current = defaultPeriod(today);
  if (current.year === year) return current;
  return { year, quarter: year < current.year ? 4 : 1 };
}

export const FILING_STATUS: Record<FilingStatus, { label: string; tone: BadgeProps["tone"]; hint: string }> = {
  upcoming: { label: "Sin empezar", tone: "neutral", hint: "El periodo todavía no ha empezado." },
  inProgress: { label: "En curso", tone: "primary", hint: "El periodo no ha terminado: las cifras pueden cambiar." },
  open: { label: "Por presentar", tone: "warning", hint: "Ya se puede presentar y el plazo sigue abierto." },
  closed: { label: "Plazo cerrado", tone: "neutral", hint: "El plazo de presentación ya ha terminado." },
};

export const CALENDAR_STATUS: Record<CalendarStatus, { label: string; tone: BadgeProps["tone"]; hint: string }> = {
  ...FILING_STATUS,
  waiting: {
    label: "Plazo sin abrir",
    tone: "neutral",
    hint: "El periodo ha terminado, pero el plazo de presentación todavía no ha empezado.",
  },
};

/** The monthly RETA fee is a direct debit, not a filing. */
export const CHARGE_STATUS: Record<CalendarStatus, { label: string; tone: BadgeProps["tone"]; hint: string }> = {
  upcoming: {
    label: "Próximo cargo",
    tone: "neutral",
    hint: "La Seguridad Social la carga el último día hábil del mes.",
  },
  inProgress: {
    label: "Próximo cargo",
    tone: "primary",
    hint: "La Seguridad Social la carga el último día hábil del mes.",
  },
  waiting: {
    label: "Próximo cargo",
    tone: "primary",
    hint: "La Seguridad Social la carga el último día hábil del mes.",
  },
  open: { label: "Se carga hoy", tone: "warning", hint: "Comprueba que tienes saldo en la cuenta domiciliada." },
  closed: { label: "Cargada", tone: "neutral", hint: "La cuota de este mes ya se ha cargado." },
};

/** Official pages to file each form, linked as they are. */
export const AEAT_LINKS = {
  "303": "https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G414.shtml",
  "390": "https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G412.shtml",
  "130": "https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G601.shtml",
  "100": "https://sede.agenciatributaria.gob.es/Sede/Renta.html",
  "111": "https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH01.shtml",
  "190": "https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI10.shtml",
  "115": "https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH02.shtml",
  "180": "https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI00.shtml",
  "347": "https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI27.shtml",
  "349": "https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI28.shtml",
} as const;

/** Informative forms filled in on the AEAT website record by record: there is no file to import. */
export const ONLINE_ONLY_FORMS = new Set<FormCode>(["190", "180", "347"]);

export type FormCode = keyof typeof AEAT_LINKS;

/*
 * Layout of each form: sections of rows, each row a label and its cells. A cell is a box of
 * the form (by number), a fixed text (a rate that isn't a box) or nothing.
 */

export type Cell = string | { text: string; unit?: string; box?: string } | null;

export interface FormRow {
  label: string;
  cells: Cell[];
  hint?: string;
  /** Totals and results: always shown and set apart. */
  total?: boolean;
}

export interface FormSection {
  title: string;
  /** Column headers for the cells; omitted when every row has a single amount. */
  columns?: string[];
  rows: FormRow[];
  note?: string;
}

/** Boxes of form 303 holding a percentage rather than an amount. Box numbers repeat across forms. */
export const PERCENT_BOXES_303 = new Set(["151", "166", "02", "154", "05", "08", "157", "169", "17", "20", "23", "65"]);

const row = (label: string, ...cells: Cell[]): FormRow => ({ label, cells });
const total = (label: string, ...cells: Cell[]): FormRow => ({ label, cells, total: true });
const rate = (text: string): Cell => ({ text, unit: "%" });
/** A box of the form that is left blank. */
const leave = (box: string): Cell => ({ text: "Dejar en blanco", box });

export const LAYOUT_303: FormSection[] = [
  {
    title: "IVA devengado",
    columns: ["Base imponible", "Tipo %", "Cuota"],
    rows: [
      row("Régimen general", "150", "151", "152"),
      row("", "165", "166", "167"),
      row("", "01", "02", "03"),
      row("", "153", "154", "155"),
      row("", "04", "05", "06"),
      row("", "07", "08", "09"),
      row("Adquisiciones intracomunitarias de bienes y servicios", "10", null, "11"),
      row("Otras operaciones con inversión del sujeto pasivo (excepto adq. intracom.)", "12", null, "13"),
      row("Modificación de bases y cuotas", "14", null, "15"),
      row("Recargo de equivalencia", "156", "157", "158"),
      row("", "168", "169", "170"),
      row("", "16", "17", "18"),
      row("", "19", "20", "21"),
      row("", "22", "23", "24"),
      row("Modificación de bases y cuotas del recargo de equivalencia", "25", null, "26"),
      total("Total cuota devengada", null, null, "27"),
    ],
    note: "Los tipos del 2 %, 5 % y 7,5 % y sus recargos ya no existen desde 2025: sus casillas quedan a cero. El recargo de equivalencia no se desglosa: si lo repercutes, ajústalo a mano en la sede de la AEAT.",
  },
  {
    title: "IVA deducible",
    columns: ["Base", "Cuota"],
    rows: [
      row("Por cuotas soportadas en operaciones interiores corrientes", "28", "29"),
      row("Por cuotas soportadas en operaciones interiores con bienes de inversión", "30", "31"),
      row("Por cuotas soportadas en las importaciones de bienes corrientes", "32", "33"),
      row("Por cuotas soportadas en las importaciones de bienes de inversión", "34", "35"),
      row("En adquisiciones intracomunitarias de bienes y servicios corrientes", "36", "37"),
      row("En adquisiciones intracomunitarias de bienes de inversión", "38", "39"),
      row("Rectificación de deducciones", "40", "41"),
      total("Total a deducir", null, "45"),
      total("Resultado régimen general ([27] − [45])", null, "46"),
    ],
  },
  {
    title: "Información adicional",
    rows: [
      row("Entregas intracomunitarias de bienes y servicios", "59"),
      row("Exportaciones y operaciones asimiladas", "60"),
      row("Operaciones no sujetas por reglas de localización (excepto las incluidas en la casilla 123)", "120"),
      row("Operaciones sujetas con inversión del sujeto pasivo", "122"),
    ],
  },
  {
    title: "Criterio de caja",
    columns: ["Base imponible", "Cuota"],
    rows: [
      row(
        "Entregas y prestaciones en criterio de caja que se habrían devengado por la regla general (art. 75 LIVA)",
        "62",
        "63",
      ),
      row("Adquisiciones a las que se aplica o afecta el régimen especial del criterio de caja", "74", "75"),
    ],
    note: "Solo para quienes están acogidos al régimen especial del criterio de caja o son destinatarios de operaciones afectadas por él.",
  },
  {
    title: "Resultado",
    rows: [
      total("Suma de resultados", "64"),
      row("Atribuible a la Administración del Estado (%)", "65"),
      row("Atribuible a la Administración del Estado", "66"),
      {
        label: "Cuotas a compensar pendientes de periodos anteriores",
        cells: ["110"],
        hint: "Lo que dejaron a compensar los 303 anteriores, calculado con tus datos. Puedes corregirlo.",
      },
      row("Cuotas a compensar de periodos anteriores aplicadas en este periodo", "78"),
      row("Cuotas a compensar de periodos previos pendientes para periodos posteriores ([110] − [78])", "87"),
      row("Resultado ([66] − [78] + [68])", "69"),
      row("Resultados a ingresar de anteriores autoliquidaciones del mismo periodo", leave("70")),
      row("Devoluciones acordadas por anteriores autoliquidaciones del mismo periodo", leave("109")),
      total("Resultado de la liquidación ([69] − [70] + [109])", "71"),
    ],
  },
];

const ratesRows = (label: string, boxes: [string, string][], rates: string[]): FormRow[] =>
  boxes.map(([base, vat], i) => row(i === 0 ? label : "", base, rate(rates[i]!), vat));

export const LAYOUT_390: FormSection[] = [
  {
    title: "Operaciones en régimen general · IVA devengado",
    columns: ["Base imponible", "Tipo %", "Cuota"],
    rows: [
      ...ratesRows(
        "Régimen ordinario",
        [
          ["700", "701"],
          ["01", "02"],
          ["03", "04"],
          ["05", "06"],
        ],
        ["0", "4", "10", "21"],
      ),
      ...ratesRows(
        "Régimen especial del criterio de caja",
        [
          ["708", "709"],
          ["643", "644"],
          ["645", "646"],
          ["647", "648"],
        ],
        ["0", "4", "10", "21"],
      ),
      ...ratesRows(
        "Adquisiciones intracomunitarias de bienes",
        [
          ["716", "717"],
          ["21", "22"],
          ["23", "24"],
          ["25", "26"],
        ],
        ["0", "4", "10", "21"],
      ),
      ...ratesRows(
        "Adquisiciones intracomunitarias de servicios",
        [
          ["720", "721"],
          ["545", "546"],
          ["547", "548"],
          ["551", "552"],
        ],
        ["0", "4", "10", "21"],
      ),
      row("IVA devengado en otros supuestos de inversión del sujeto pasivo", "27", null, "28"),
      row("Modificación de bases y cuotas", "29", null, "30"),
      total("Total bases y cuotas IVA", "33", null, "34"),
      ...ratesRows(
        "Recargo de equivalencia",
        [
          ["35", "36"],
          ["599", "600"],
          ["601", "602"],
          ["41", "42"],
        ],
        ["0,5", "1,4", "5,2", "1,75"],
      ),
      row("Modificación recargo de equivalencia", "43", null, "44"),
      total("Total cuotas IVA y recargo de equivalencia", null, null, "47"),
    ],
  },
  {
    title: "IVA deducible",
    columns: ["Base imponible", "Tipo %", "Cuota"],
    rows: [
      ...ratesRows(
        "Operaciones interiores de bienes y servicios corrientes",
        [
          ["190", "191"],
          ["603", "604"],
          ["605", "606"],
        ],
        ["4", "10", "21"],
      ),
      ...ratesRows(
        "Operaciones interiores de bienes de inversión",
        [
          ["196", "197"],
          ["611", "612"],
          ["613", "614"],
        ],
        ["4", "10", "21"],
      ),
      ...ratesRows(
        "Importaciones de bienes corrientes",
        [
          ["202", "203"],
          ["619", "620"],
          ["621", "622"],
        ],
        ["4", "10", "21"],
      ),
      ...ratesRows(
        "Importaciones de bienes de inversión",
        [
          ["208", "209"],
          ["623", "624"],
          ["625", "626"],
        ],
        ["4", "10", "21"],
      ),
      ...ratesRows(
        "Adquisiciones intracomunitarias de bienes corrientes",
        [
          ["214", "215"],
          ["627", "628"],
          ["629", "630"],
        ],
        ["4", "10", "21"],
      ),
      ...ratesRows(
        "Adquisiciones intracomunitarias de bienes de inversión",
        [
          ["220", "221"],
          ["631", "632"],
          ["633", "634"],
        ],
        ["4", "10", "21"],
      ),
      ...ratesRows(
        "Adquisiciones intracomunitarias de servicios",
        [
          ["587", "588"],
          ["635", "636"],
          ["637", "638"],
        ],
        ["4", "10", "21"],
      ),
      row(
        "Cuotas deducibles en virtud de resolución administrativa o sentencia firmes con tipos no vigentes",
        "660",
        null,
        "661",
      ),
      row("Rectificación de deducciones", "639", null, "62"),
      total("Suma de deducciones", null, null, "64"),
      total("Resultado régimen general ([47] − [64])", null, null, "65"),
    ],
  },
  {
    title: "Resultado liquidación anual",
    rows: [
      row("Regularización de cuotas del art. 80.Cinco.5ª LIVA", "658"),
      row("Suma de resultados ([65] + [658])", "84"),
      row("IVA a la importación liquidado por la Aduana", "659"),
      {
        label: "Compensación de cuotas del ejercicio anterior",
        cells: ["85"],
        hint: "Lo que el último 303 del año anterior dejó a compensar.",
      },
      total("Resultado de la liquidación ([84] + [659] − [85])", "86"),
    ],
  },
  {
    title: "Resultado de las liquidaciones",
    rows: [
      {
        label: "Total resultados a ingresar en las autoliquidaciones de IVA del ejercicio",
        cells: ["95"],
        hint: "Suma de los resultados positivos de los cuatro 303 del año; los negativos no cuentan.",
        total: true,
      },
      {
        label: "Resultado a compensar de la autoliquidación del último periodo",
        cells: ["97"],
        hint: "Si el 303 del cuarto trimestre salió negativo y se dejó a compensar.",
      },
      row("Cuotas pendientes de compensación generadas en el ejercicio y distintas de las de la casilla [97]", "662"),
    ],
  },
  {
    title: "Volumen de operaciones",
    rows: [
      row("Operaciones en régimen general", "99"),
      row("Operaciones en criterio de caja que se habrían devengado por la regla general (art. 75 LIVA)", "653"),
      row("Entregas intracomunitarias de bienes y servicios", "103"),
      row("Exportaciones y otras operaciones exentas con derecho a deducción", "104"),
      row("Operaciones exentas sin derecho a deducción", "105"),
      row("Operaciones no sujetas por reglas de localización (excepto las incluidas en la casilla 126)", "110"),
      row("Operaciones sujetas con inversión del sujeto pasivo", "125"),
      total("Total volumen de operaciones", "108"),
    ],
  },
  {
    title: "Operaciones específicas",
    columns: ["Base imponible", "Cuota"],
    rows: [
      row("Adquisiciones interiores exentas", "230", null),
      row("Bases imponibles del IVA soportado no deducible", "232", null),
      row(
        "Entregas y prestaciones en criterio de caja que se habrían devengado por la regla general (art. 75 LIVA)",
        "654",
        "655",
      ),
      row("Adquisiciones a las que se aplica o afecta el régimen especial del criterio de caja", "656", "657"),
    ],
  },
];

export const LAYOUT_130: FormSection[] = [
  {
    title: "Actividades en estimación directa",
    rows: [
      row("Ingresos computables desde el 1 de enero", "01"),
      {
        label: "Gastos fiscalmente deducibles desde el 1 de enero",
        cells: ["02"],
        hint: "En estimación directa simplificada incluyen el 5 % de gastos de difícil justificación, con un máximo de 2.000 € al año.",
      },
      total("Rendimiento neto ([01] − [02])", "03"),
      row("20 % del rendimiento neto, si es positivo", "04"),
      row("Pagos fraccionados de trimestres anteriores del año (suma de los [07] positivos)", "05"),
      row("Retenciones e ingresos a cuenta desde el 1 de enero", "06"),
      total("Pago fraccionado previo del trimestre ([04] − [05] − [06])", "07"),
    ],
  },
  {
    title: "Total liquidación",
    rows: [
      row("Suma de pagos fraccionados previos del trimestre", "12"),
      {
        label: "Minoración por rendimientos bajos (art. 110.3 c RIRPF)",
        cells: ["13"],
        hint: "Hasta 100 € por trimestre si tu rendimiento neto del año anterior no pasó de 12.000 €. Se calcula con tus datos del año anterior.",
      },
      total("Diferencia ([12] − [13])", "14"),
      {
        label: "Resultados negativos de trimestres anteriores",
        cells: ["15"],
        hint: "Solo si en un trimestre anterior de este año el resultado fue negativo y aún no lo has descontado.",
      },
      {
        label: "Por pagos de préstamos para la vivienda habitual",
        cells: ["16"],
        hint: "Solo para préstamos anteriores a 2013 que ya daban derecho a la deducción.",
      },
      total("Total ([14] − [15] − [16])", "17"),
      total("Resultado de la declaración", "19"),
    ],
  },
];

const EXPENSE_LABELS_100: Record<(typeof EXPENSE_BOXES_100)[number], string> = {
  "0181": "Compras de existencias",
  "0182": "Variación de existencias (disminución)",
  "0183": "Otros consumos de explotación",
  "0184": "Sueldos y salarios",
  "0185": "Seguridad Social a cargo de la empresa",
  "0186": "Seguridad Social o mutualidad del titular de la actividad",
  "0187": "Indemnizaciones",
  "0188": "Dietas y asignaciones de viaje del personal",
  "0189": "Aportaciones a sistemas de previsión social del personal",
  "0190": "Otros gastos de personal",
  "0191": "Gastos de manutención del contribuyente",
  "0192": "Arrendamientos y cánones",
  "0193": "Reparaciones y conservación",
  "0194": "Suministros (agua, gas, electricidad, telefonía, internet)",
  "0198": "Otros suministros",
  "0199": "Servicios de profesionales independientes",
  "0200": "Primas de seguros",
  "0202": "Otros servicios exteriores",
  "0203": "Gastos financieros",
  "0205": "IVA soportado (recargo de equivalencia…)",
  "0206": "Otros tributos fiscalmente deducibles",
  "0208": "Amortización del inmovilizado material",
  "0227": "Amortización del inmovilizado inmaterial",
  "0214": "Pérdidas por insolvencia de deudores",
  "0215": "Mecenazgo: convenios de colaboración",
  "0216": "Mecenazgo: gastos en actividades de interés general",
  "0217": "Otros conceptos fiscalmente deducibles",
};

export function layout100(simplified: boolean): FormSection[] {
  return [
    {
      title: "Ingresos íntegros",
      rows: [
        row("Ingresos de explotación", "0171"),
        row("Ingresos financieros por aplazamiento o fraccionamiento de operaciones de la actividad", "0172"),
        row("Ingresos por subvenciones corrientes", "0173"),
        row("Imputación de ingresos por subvenciones de capital", "0174"),
        row("Autoconsumo de bienes y servicios", "0175"),
        row("IVA devengado (recargo de equivalencia, compensaciones de agricultura, ganadería y pesca)", "0176"),
        row("Variación de existencias (incremento de existencias finales)", "0177"),
        row("Otros ingresos", "0178"),
        row("Exceso de amortización de elementos con libertad de amortización (DA 30ª LIRPF)", "0179"),
        total("Total ingresos computables ([0171] a [0179])", "0180"),
      ],
      note: "Las casillas 0172 a 0179 no se calculan con tus facturas: si tienes ingresos de ese tipo, ajústalas en Renta WEB.",
    },
    {
      title: "Gastos fiscalmente deducibles",
      rows: [...EXPENSE_BOXES_100.map((box) => row(EXPENSE_LABELS_100[box], box)), total("Suma de gastos", "0218")],
    },
    ...(simplified
      ? [
          {
            title: "Estimación directa normal",
            rows: [
              row("Provisiones fiscalmente deducibles", leave("0219")),
              row("Total gastos deducibles ([0218] + [0219])", leave("0220")),
            ],
            note: "Solo para la modalidad normal: en la simplificada se dejan en blanco.",
          },
        ]
      : []),
    {
      title: simplified ? "Estimación directa simplificada" : "Estimación directa normal",
      rows: simplified
        ? [
            row("Diferencia ([0180] − [0218])", "0221"),
            {
              label: "Provisiones y gastos de difícil justificación",
              cells: ["0222"],
              hint: "5 % de la diferencia, con un máximo de 2.000 € al año.",
            },
            total("Total gastos deducibles ([0218] + [0222])", "0223"),
          ]
        : [row("Provisiones fiscalmente deducibles", "0219"), total("Total gastos deducibles", "0220")],
    },
    {
      title: "Rendimiento neto",
      rows: [
        total("Rendimiento neto", "0224"),
        row("Reducciones por rendimientos irregulares", "0225"),
        total("Rendimiento neto reducido", "0226"),
      ],
    },
    {
      title: "Retenciones y pagos a cuenta",
      rows: [
        row("Retenciones por arrendamientos de inmuebles urbanos", "0598"),
        row("Retenciones por rendimientos de actividades económicas", "0599"),
        {
          label: "Pagos fraccionados ingresados (modelo 130)",
          cells: ["0604"],
          hint: "Suma de los resultados positivos de los cuatro 130 del año.",
        },
      ],
    },
  ];
}

const perceptorColumns = ["Nº de perceptores", "Importe de las percepciones", "Importe de las retenciones"];

export const LAYOUT_111: FormSection[] = [
  {
    title: "I. Rendimientos del trabajo",
    columns: perceptorColumns,
    rows: [
      {
        label: "Rendimientos dinerarios",
        cells: ["01", "02", "03"],
        hint: "Facturas de servicios esporádicos (cuenta 6231: cursos, conferencias, seminarios) con retención.",
      },
      row("Rendimientos en especie", "04", "05", "06"),
    ],
  },
  {
    title: "II. Rendimientos de actividades económicas",
    columns: perceptorColumns,
    rows: [
      {
        label: "Rendimientos dinerarios",
        cells: ["07", "08", "09"],
        hint: "Facturas recibidas de profesionales con retención, salvo alquileres (van al 115).",
      },
      row("Rendimientos en especie", "10", "11", "12"),
    ],
  },
  {
    title: "V. Cesión de derechos de imagen (art. 92.8 LIRPF)",
    columns: perceptorColumns,
    rows: [row("Contraprestaciones dinerarias o en especie", "25", "26", "27")],
  },
  {
    title: "Total liquidación",
    rows: [
      total("Suma de retenciones e ingresos a cuenta", "28"),
      row("A deducir (solo en declaraciones complementarias)", "29"),
      total("Resultado a ingresar ([28] − [29])", "30"),
    ],
  },
];

/** Boxes of forms 111 and 115 holding a number of perceptors. */
export const COUNT_BOXES_111 = new Set(["01", "04", "07", "10", "25"]);
export const COUNT_BOXES_115 = new Set(["01"]);

export const LAYOUT_115: FormSection[] = [
  {
    title: "Retenciones e ingresos a cuenta",
    rows: [
      row("Nº de perceptores", "01"),
      row("Base de las retenciones e ingresos a cuenta", "02"),
      row("Retenciones e ingresos a cuenta", "03"),
      row("A deducir (solo en declaraciones complementarias)", "04"),
      total("Resultado a ingresar ([03] − [04])", "05"),
    ],
  },
];

/* Questions of the forms that the books don't answer, with what to answer from the tax setup. */

export interface FormAnswer {
  label: string;
  answer: string;
  /** Box or key of the form, when it has one. */
  box?: string;
}

const yesNo = (yes: boolean) => (yes ? "SÍ" : "NO");
const BLANK = "Dejar en blanco";
const UNCHECKED = "Dejar desmarcado";

export function answers303(tax: TaxSetup): FormAnswer[] {
  return [
    { label: "Sujeto pasivo inscrito en el Registro de devolución mensual (art. 30 RIVA)", answer: "NO" },
    {
      label: "Sujeto pasivo que tributa exclusivamente en régimen simplificado",
      answer: yesNo(tax.vatRegime === "simplified"),
    },
    { label: "Autoliquidación conjunta", answer: "NO" },
    {
      label: "Sujeto pasivo acogido al régimen especial del criterio de caja (art. 163 undecies LIVA)",
      answer: yesNo(tax.vatRegime === "cashBasis"),
    },
    {
      label: "Sujeto pasivo destinatario de operaciones acogidas al régimen especial del criterio de caja",
      answer: "NO",
    },
    { label: "Opción por la aplicación de la prorrata especial (art. 103.Dos.1º LIVA)", answer: BLANK },
    {
      label: "Revocación de la opción por la aplicación de la prorrata especial (art. 103.Dos.1º LIVA)",
      answer: BLANK,
    },
    { label: "Sujeto pasivo declarado en concurso de acreedores en el presente periodo de liquidación", answer: "NO" },
    { label: "Sujeto pasivo acogido voluntariamente al SII", answer: "NO" },
    { label: "Sujeto pasivo exonerado de la Declaración-resumen anual del IVA, modelo 390", answer: "NO" },
    { label: "Sujeto pasivo con volumen anual de operaciones distinto de cero (art. 121 LIVA)", answer: BLANK },
  ];
}

export function answers390(tax: TaxSetup): FormAnswer[] {
  return [
    { label: "Registro de devolución mensual en algún periodo del ejercicio", answer: UNCHECKED },
    { label: "Régimen especial del grupo de entidades en algún periodo del ejercicio", answer: UNCHECKED },
    { label: "¿Ha sido declarado en concurso de acreedores en este ejercicio?", answer: "NO" },
    {
      label: "¿Ha optado por el régimen especial del criterio de caja (art. 163 undecies LIVA)?",
      answer: yesNo(tax.vatRegime === "cashBasis"),
    },
    {
      label: "¿Ha sido destinatario de operaciones a las que aplique el régimen especial del criterio de caja?",
      answer: "NO",
    },
  ];
}

/** Statistical data of form 390: the activities, main one first, ordered by volume. */
export function activities390(tax: TaxSetup): FormAnswer[] {
  return tax.activities.map((a, i) => ({
    label: `${i === 0 ? "Principal · " : ""}${i + 1}. ${activityTypeLabel(a.type)}`,
    answer: a.code ? `${a.code} ${a.name}` : a.name,
  }));
}

export function answers100(tax: TaxSetup): FormAnswer[] {
  const main = tax.activities[0];
  return [
    {
      label: "Contribuyente que realiza la actividad",
      answer: "Se elige en la Modalidad de Renta WEB al indicar la actividad",
      box: "0165",
    },
    {
      label: "Código y tipo de actividad",
      answer: main ? activityTypeLabel(main.type) : "Configúralo en Impuestos",
      box: "0166",
    },
    {
      label: "Grupo o epígrafe del IAE",
      answer: main?.code ? `${main.code} ${main.name}` : (main?.name ?? "Configúralo en Impuestos"),
      box: "0167",
    },
    {
      label: "Modalidad del método de estimación directa",
      answer: tax.incomeTaxMethod === "normal" ? "N (normal)" : "S (simplificada)",
      box: "0168",
    },
    { label: "Imputación temporal por el criterio de cobros y pagos", answer: BLANK, box: "0169" },
    { label: "Imputación del anticipo de derechos de autor a medida que se devenguen", answer: BLANK, box: "0170" },
  ];
}

const ACTIVITY_TYPE_NAMES: Record<string, string> = {
  A01: "Arrendadores de bienes inmuebles",
  A02: "Ganadería independiente",
  A03: "Resto de actividades empresariales",
  A04: "Actividades profesionales de carácter artístico o deportivo",
  A05: "Resto de actividades profesionales",
  B01: "Actividad agrícola",
  B02: "Actividad ganadera dependiente",
  B03: "Actividad forestal",
  B04: "Producción de mejillón en batea",
  B05: "Actividad pesquera",
  B06: "Otras actividades no sujetas al IAE",
  C: "Actividades no iniciadas",
};

const activityTypeLabel = (type: string) => (ACTIVITY_TYPE_NAMES[type] ? `${type} ${ACTIVITY_TYPE_NAMES[type]}` : type);
