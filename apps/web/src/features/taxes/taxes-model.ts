import { defaultPeriod, EXPENSE_BOXES_100, type CalendarStatus, type FilingStatus, type Period } from "@fiscalia/core";
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

export type Cell = string | { text: string } | null;

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
export const PERCENT_BOXES_303 = new Set(["151", "02", "05", "08", "65"]);

const row = (label: string, ...cells: Cell[]): FormRow => ({ label, cells });
const total = (label: string, ...cells: Cell[]): FormRow => ({ label, cells, total: true });
const rate = (text: string): Cell => ({ text });

export const LAYOUT_303: FormSection[] = [
  {
    title: "IVA devengado",
    columns: ["Base imponible", "Tipo %", "Cuota"],
    rows: [
      row("Régimen general", "150", "151", "152"),
      row("", "01", "02", "03"),
      row("", "04", "05", "06"),
      row("", "07", "08", "09"),
      row("Adquisiciones intracomunitarias de bienes y servicios", "10", null, "11"),
      row("Otras operaciones con inversión del sujeto pasivo (excepto adq. intracom.)", "12", null, "13"),
      row("Modificación de bases y cuotas", "14", null, "15"),
      total("Total cuota devengada", null, null, "27"),
    ],
    note: "El recargo de equivalencia no se desglosa: si lo repercutes, ajústalo a mano en la sede de la AEAT.",
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
      row("Operaciones no sujetas por reglas de localización", "120"),
      row("Operaciones sujetas con inversión del sujeto pasivo", "122"),
    ],
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
      row("Resultado ([66] − [78])", "69"),
      total("Resultado de la liquidación", "71"),
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
      row("Rectificación de deducciones", "639", null, "62"),
      total("Suma de deducciones", null, null, "64"),
      total("Resultado régimen general ([47] − [64])", null, null, "65"),
    ],
  },
  {
    title: "Resultado liquidación anual",
    rows: [
      row("Suma de resultados", "84"),
      {
        label: "Compensación de cuotas del ejercicio anterior",
        cells: ["85"],
        hint: "Lo que el último 303 del año anterior dejó a compensar.",
      },
      total("Resultado de la liquidación ([84] − [85])", "86"),
    ],
  },
  {
    title: "Volumen de operaciones",
    rows: [
      row("Operaciones en régimen general", "99"),
      row("Entregas intracomunitarias de bienes y servicios", "103"),
      row("Exportaciones y otras operaciones exentas con derecho a deducción", "104"),
      row("Operaciones exentas sin derecho a deducción", "105"),
      row("Operaciones no sujetas por reglas de localización", "110"),
      row("Operaciones sujetas con inversión del sujeto pasivo", "125"),
      total("Total volumen de operaciones", "108"),
    ],
  },
];

export const LAYOUT_130: FormSection[] = [
  {
    title: "Actividades en estimación directa",
    rows: [
      row("Ingresos computables desde el 1 de enero", "01"),
      row("Gastos fiscalmente deducibles desde el 1 de enero", "02"),
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
      rows: [row("Ingresos de explotación", "0171"), total("Total ingresos computables", "0180")],
      note: "Subvenciones, autoconsumo y otros ingresos (casillas 0172 a 0179) no se calculan: añádelos en Renta WEB si los tienes.",
    },
    {
      title: "Gastos fiscalmente deducibles",
      rows: [...EXPENSE_BOXES_100.map((box) => row(EXPENSE_LABELS_100[box], box)), total("Suma de gastos", "0218")],
    },
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
