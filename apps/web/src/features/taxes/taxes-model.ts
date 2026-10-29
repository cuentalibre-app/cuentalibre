import {
  defaultPeriod,
  EXPENSE_BOXES_100,
  type CalendarStatus,
  type FilingStatus,
  type Period,
} from "@cuentalibre/core";
import type { TaxSetup } from "@cuentalibre/contracts";
import type { BadgeProps } from "@cuentalibre/ui/components/badge";
import type { ReactNode } from "react";

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

/** Shared caveat of every calculation: it only knows what was recorded. */
export const ONLY_RECORDED =
  "Solo cuenta lo que has registrado en cuentalibre: si tienes otras actividades fuera de la app o usas otro método de estimación, ajusta las cifras antes de presentar.";

/** Who the VAT and income tax calculations are for. */
export const ACTIVITY_SCOPE = "No sirve para actividades agrícolas, ganaderas, forestales o pesqueras.";

/*
 * Layout of each form: sections of rows, each row a label and its cells. A cell is a box of
 * the form (by number), a fixed text (a rate that isn't a box) or nothing.
 */

export type Cell = string | { text: string; unit?: string; box?: string } | null;

/** Help of a row, shown under the title "Casilla N". In its texts, **words** are shown in bold. */
export type Hint =
  | string
  | {
      text: string[];
      table?: { columns: [string, string]; rows: [string, string][] };
      /** Paragraphs after the table. */
      after?: string[];
    };

export interface FormRow {
  label: string;
  cells: Cell[];
  hint?: Hint;
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
/** A row with an explanation of what goes in its boxes. */
const info = (label: string, hint: Hint, ...cells: Cell[]): FormRow => ({ label, cells, hint });
const totalInfo = (label: string, hint: Hint, ...cells: Cell[]): FormRow => ({ label, cells, hint, total: true });
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
      info(
        "Adquisiciones intracomunitarias de bienes y servicios",
        "Compras a empresas de otro país de la UE inscritas en el VIES: te repercutes el IVA aquí y lo deduces en [36] y [37] (o [38] y [39] si es un bien de inversión).",
        "10",
        null,
        "11",
      ),
      info(
        "Otras operaciones con inversión del sujeto pasivo (excepto adq. intracom.)",
        "Compras en las que pagas tú el IVA en lugar del proveedor, como los servicios de empresas de fuera de la UE: te repercutes el IVA aquí y lo deduces en [28] y [29].",
        "12",
        null,
        "13",
      ),
      info(
        "Modificación de bases y cuotas",
        "Facturas rectificativas emitidas en el trimestre que corrigen ventas de periodos anteriores.",
        "14",
        null,
        "15",
      ),
      row("Recargo de equivalencia", "156", "157", "158"),
      row("", "168", "169", "170"),
      row("", "16", "17", "18"),
      row("", "19", "20", "21"),
      row("", "22", "23", "24"),
      row("Modificación de bases y cuotas del recargo de equivalencia", "25", null, "26"),
      total("Total cuota devengada", null, null, "27"),
    ],
    note: "Los tipos del 2 %, 5 % y 7,5 % y sus recargos ya no existen desde 2025: sus casillas quedan a cero. El recargo de equivalencia no se desglosa y el recargo al 0 % se trata como si no hubiera recargo: si lo repercutes, ajústalo a mano en la sede de la AEAT. En criterio de caja, los cobros de esos tipos antiguos se introducen a mano en la casilla [108] al presentar.",
  },
  {
    title: "IVA deducible",
    columns: ["Base", "Cuota"],
    rows: [
      info(
        "Por cuotas soportadas en operaciones interiores corrientes",
        "IVA de tus facturas recibidas de proveedores españoles, en la parte imputada a la actividad, más el IVA que te repercutes en [13].",
        "28",
        "29",
      ),
      info(
        "Por cuotas soportadas en operaciones interiores con bienes de inversión",
        "IVA de las compras de bienes de inversión (ordenadores, mobiliario, vehículos…) a proveedores españoles.",
        "30",
        "31",
      ),
      info(
        "Por cuotas soportadas en las importaciones de bienes corrientes",
        "IVA pagado en la aduana al importar bienes de fuera de la UE.",
        "32",
        "33",
      ),
      row("Por cuotas soportadas en las importaciones de bienes de inversión", "34", "35"),
      info(
        "En adquisiciones intracomunitarias de bienes y servicios corrientes",
        "El IVA que te repercutes en [11] se deduce aquí en la misma proporción que el resto de la factura.",
        "36",
        "37",
      ),
      row("En adquisiciones intracomunitarias de bienes de inversión", "38", "39"),
      info(
        "Rectificación de deducciones",
        "Facturas rectificativas recibidas que corrigen compras de periodos anteriores.",
        "40",
        "41",
      ),
      total("Total a deducir", null, "45"),
      totalInfo(
        "Resultado régimen general ([27] − [45])",
        "IVA que has cobrado menos el que puedes deducir. Si es negativo, Hacienda te debe esa diferencia.",
        null,
        "46",
      ),
    ],
  },
  {
    title: "Información adicional",
    rows: [
      info(
        "Entregas intracomunitarias de bienes y servicios",
        "Ventas sin IVA a empresas de otro país de la UE inscritas en el VIES (tipo de operación Intracomunitaria). También se declaran en el 349.",
        "59",
      ),
      info("Exportaciones y operaciones asimiladas", "Ventas de bienes que salen fuera de la UE.", "60"),
      info(
        "Operaciones no sujetas por reglas de localización (excepto las incluidas en la casilla 123)",
        "Ventas que no tributan en España por el lugar donde se prestan, como servicios a empresas de fuera de la UE.",
        "120",
      ),
      info(
        "Operaciones sujetas con inversión del sujeto pasivo",
        "Ventas en las que es tu cliente quien declara el IVA, por ejemplo algunas obras y entregas de inmuebles.",
        "122",
      ),
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
      info(
        "Atribuible a la Administración del Estado (%)",
        "Es el 100 %, salvo si tienes el domicilio fiscal en Navarra o el País Vasco: entonces indica el porcentaje que corresponda y ajusta el resto de casillas.",
        "65",
      ),
      row("Atribuible a la Administración del Estado", "66"),
      {
        label: "Cuotas a compensar pendientes de periodos anteriores",
        cells: ["110"],
        hint: {
          text: [
            "Si el 303 del periodo anterior salió negativo y lo dejaste **a compensar**, ese importe va aquí para descontarlo.",
            "cuentalibre lo calcula con tus datos; puedes corregirlo.",
          ],
        },
      },
      info(
        "Cuotas a compensar de periodos anteriores aplicadas en este periodo",
        "La parte de [110] que se descuenta este trimestre: como mucho, lo que sale a ingresar en [66].",
        "78",
      ),
      info(
        "Cuotas a compensar de periodos previos pendientes para periodos posteriores ([110] − [78])",
        "Lo que queda de [110] para los trimestres siguientes. No incluye lo que este trimestre deja a compensar.",
        "87",
      ),
      row("Resultado ([66] − [78] + [68])", "69"),
      info(
        "Resultados a ingresar de anteriores autoliquidaciones del mismo periodo",
        "Solo en declaraciones complementarias: lo que ya ingresaste en declaraciones anteriores de este mismo periodo.",
        leave("70"),
      ),
      info(
        "Devoluciones acordadas por anteriores autoliquidaciones del mismo periodo",
        "Solo en declaraciones complementarias: lo que Hacienda ya te devolvió por declaraciones anteriores de este mismo periodo.",
        leave("109"),
      ),
      totalInfo(
        "Resultado de la liquidación ([69] − [70] + [109])",
        {
          text: [
            "**Negativo en el 1T, 2T o 3T:** queda a compensar en el trimestre siguiente.",
            "**Negativo en el 4T:** puedes pedir la devolución o compensarlo el año siguiente. El fichero lleva lo que elijas junto al resultado; el IBAN de la devolución se indica en la sede.",
          ],
        },
        "71",
      ),
    ],
  },
];

/** Last 303 of the year of filers exempt from form 390: their volume of operations. */
export const LAYOUT_303_ANNUAL: FormSection[] = [
  {
    title: "Operaciones realizadas en el ejercicio",
    rows: [
      row("Operaciones en régimen general", "80"),
      row("Operaciones en criterio de caja que se habrían devengado por la regla general (art. 75 LIVA)", "81"),
      row("Entregas intracomunitarias de bienes y servicios", "93"),
      row("Exportaciones y otras operaciones exentas con derecho a deducción", "94"),
      row("Operaciones exentas sin derecho a deducción", "83"),
      row("Operaciones no sujetas por reglas de localización (excepto las incluidas en la casilla 126)", "84"),
      row("Operaciones sujetas con inversión del sujeto pasivo", "125"),
      total("Total volumen de operaciones", "88"),
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
        hint: "Si el 303 del 4T del año anterior salió negativo y no pediste la devolución, el importe pendiente de compensar va aquí, en positivo.",
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
        hint: "Suma de los resultados [71] de los cuatro 303 del año que salieron a ingresar. Los negativos no cuentan: no es un error.",
        total: true,
      },
      {
        label: "Resultado a compensar de la autoliquidación del último periodo",
        cells: ["97"],
        hint: "Si el 303 del 4T salió negativo y lo dejaste a compensar. Si pediste la devolución, va en la casilla de devolución de la sede.",
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
      info(
        "Pagos fraccionados de trimestres anteriores del año (suma de los [07] positivos)",
        {
          text: [
            "Suma de las casillas **[07] positivas** de los 130 anteriores de este año.",
            "Si en esos trimestres rellenaste la casilla **[16]** por el préstamo de tu vivienda habitual, resta aquí la suma de esas deducciones.",
            "cuentalibre la calcula con los trimestres cerrados tal como se presentaron y el resto con tus datos actuales. Si pagaste otra cantidad, escribe aquí lo que pagaste de verdad.",
          ],
        },
        "05",
      ),
      info(
        "Retenciones e ingresos a cuenta desde el 1 de enero",
        "Retenciones que te han aplicado tus clientes en las facturas emitidas desde el 1 de enero hasta el final del trimestre.",
        "06",
      ),
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
        hint: {
          text: [
            "Opcional: cuentalibre la deja **en blanco** para que la rellenes tú, en positivo, si quieres aplicarla.",
            "Te corresponde si tu rendimiento neto de actividades del año anterior fue **igual o inferior a 12.000 €**. Si no tuviste actividad, cuenta como cero. El importe sale de esta tabla:",
          ],
          table: {
            columns: ["Rendimiento neto del año anterior", "Minoración"],
            rows: [
              ["Igual o inferior a 9.000 €", "100 €"],
              ["Entre 9.000,01 y 10.000 €", "75 €"],
              ["Entre 10.000,01 y 11.000 €", "50 €"],
              ["Entre 11.000,01 y 12.000 €", "25 €"],
            ],
          },
          after: [
            "**No es un ahorro:** solo adelantas menos, y la diferencia la pagas en la renta. En caso de duda, déjala en blanco.",
          ],
        },
      },
      total("Diferencia ([12] − [13])", "14"),
      {
        label: "Resultados negativos de trimestres anteriores",
        cells: ["15"],
        hint: {
          text: [
            "Solo si **[14] es positiva**: resultados negativos de los 130 anteriores de este año que aún no hayas descontado.",
            "No puedes descontar más que el importe de [14].",
          ],
        },
      },
      {
        label: "Por pagos de préstamos para la vivienda habitual",
        cells: ["16"],
        hint: {
          text: [
            "Solo si **[14] es positiva** y pagas un préstamo para comprar o rehabilitar tu **vivienda habitual**, contratado antes de 2013 y que ya daba derecho a la deducción.",
            "Puedes deducir el **2 % de [03]**, con un máximo de **660,14 € por trimestre**. Consulta las excepciones en las instrucciones del modelo.",
          ],
        },
      },
      total("Total ([14] − [15] − [16])", "17"),
      totalInfo(
        "Resultado de la declaración",
        {
          text: [
            "**A ingresar:** puedes domiciliar el pago o pagarlo con un NRC de tu banco al presentar.",
            "**Negativo:** no pagas nada y puedes descontarlo en la casilla [15] de los siguientes trimestres del año.",
          ],
        },
        "19",
      ),
    ],
  },
];

/** Expense boxes of form 100 that the books don't fill: they're adjusted by hand. */
const MANUAL_EXPENSE_BOXES_100 = new Set(["0182", "0183", "0188", "0189", "0198", "0205"]);

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
        info(
          "Autoconsumo de bienes y servicios",
          "Si tienes ingresos de este tipo, ajusta esta casilla a mano.",
          "0175",
        ),
        info(
          "IVA devengado (recargo de equivalencia, compensaciones de agricultura, ganadería y pesca)",
          "Si tienes ingresos de este tipo, ajusta esta casilla a mano.",
          "0176",
        ),
        info(
          "Variación de existencias (incremento de existencias finales)",
          "Si tienes ingresos de este tipo, ajusta esta casilla a mano.",
          "0177",
        ),
        row("Otros ingresos", "0178"),
        info(
          "Exceso de amortización de elementos con libertad de amortización (DA 30ª LIRPF)",
          "Si has vendido elementos que se amortizaron con libertad de amortización, ajusta esta casilla a mano.",
          "0179",
        ),
        total("Total ingresos computables ([0171] a [0179])", "0180"),
      ],
      note: "Las casillas 0172 a 0179 no se calculan con tus facturas: si tienes ingresos de ese tipo, ajústalas en Renta WEB.",
    },
    {
      title: "Gastos fiscalmente deducibles",
      rows: [
        ...EXPENSE_BOXES_100.map((box) =>
          MANUAL_EXPENSE_BOXES_100.has(box)
            ? info(EXPENSE_LABELS_100[box], "Si tienes gastos de este tipo, ajusta esta casilla a mano.", box)
            : row(EXPENSE_LABELS_100[box], box),
        ),
        total("Suma de gastos", "0218"),
      ],
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
        info(
          "Reducciones por rendimientos irregulares",
          "Rendimientos generados en más de dos años u obtenidos de forma notoriamente irregular.",
          "0225",
        ),
        total("Rendimiento neto reducido", "0226"),
      ],
    },
    {
      title: "Retenciones y pagos a cuenta",
      rows: [
        info(
          "Retenciones por arrendamientos de inmuebles urbanos",
          "Se rellena desde el apartado D1, en la ventana que se abre al pulsar la casilla 0171. Se supone que todos tus ingresos por alquiler son de inmuebles urbanos; si no, ajústalo: solo es informativo y no cambia el resultado.",
          "0598",
        ),
        info(
          "Retenciones por rendimientos de actividades económicas",
          "Se rellena desde el apartado D1, en la ventana que se abre al pulsar la casilla 0171.",
          "0599",
        ),
        {
          label: "Pagos fraccionados ingresados (modelo 130)",
          cells: ["0604"],
          hint: "Suma de lo que has pagado con los cuatro 130 del año. Si no los presentaste, pon 0.",
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
      info(
        "Rendimientos en especie",
        "cuentalibre no los calcula: si pagas a trabajadores en especie, añádelos a mano en la sede.",
        "04",
        "05",
        "06",
      ),
    ],
    note: "Las retenciones de las nóminas de tus trabajadores también van aquí: cuentalibre no las calcula, añádelas a mano en la sede.",
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
      totalInfo(
        "Suma de retenciones e ingresos a cuenta",
        "Si has practicado retenciones por otros conceptos (premios, otros rendimientos…), decláralos también en el 111 y ajusta los totales.",
        "28",
      ),
      info(
        "A deducir (solo en declaraciones complementarias)",
        "Lo que ingresaste en la declaración anterior del mismo periodo.",
        "29",
      ),
      totalInfo(
        "Resultado a ingresar ([28] − [29])",
        "Si es cero, preséntalo igualmente eligiendo el tipo de declaración «Resultado cero / sin actividad».",
        "30",
      ),
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
      info("Nº de perceptores", "Número de arrendadores a los que has practicado retención en el trimestre.", "01"),
      info(
        "Base de las retenciones e ingresos a cuenta",
        "Base imponible de las facturas de alquiler de inmuebles urbanos con retención.",
        "02",
      ),
      info("Retenciones e ingresos a cuenta", "Retenciones de esas facturas, normalmente al 19 %.", "03"),
      info(
        "A deducir (solo en declaraciones complementarias)",
        "Lo que ingresaste en la declaración anterior del mismo periodo. En una declaración normal, ignora esta casilla.",
        "04",
      ),
      totalInfo(
        "Resultado a ingresar ([03] − [04])",
        "Si es cero y estás dado de alta en el 115, preséntalo igualmente.",
        "05",
      ),
    ],
  },
];

/* Questions of the forms that the books don't answer, with what to answer from the tax setup. */

export interface FormAnswer {
  label: string;
  answer: ReactNode;
  /** Box or key of the form, when it has one. */
  box?: string;
}

const yesNo = (yes: boolean) => (yes ? "SÍ" : "NO");
const BLANK = "Dejar en blanco";
const UNCHECKED = "Dejar desmarcado";

/**
 * Identification of the 303. In Q4, `exemption` holds the control that answers whether the filer
 * is exempt from form 390, and the year's volume of operations when they are.
 */
export function answers303(tax: TaxSetup, exemption?: { control: ReactNode; volume: number | null }): FormAnswer[] {
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
    {
      label: "Sujeto pasivo exonerado de la Declaración-resumen anual del IVA, modelo 390",
      answer: exemption?.control ?? "NO",
    },
    {
      label: "Sujeto pasivo con volumen anual de operaciones distinto de cero (art. 121 LIVA)",
      answer: exemption?.volume == null ? BLANK : yesNo(exemption.volume !== 0),
    },
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
