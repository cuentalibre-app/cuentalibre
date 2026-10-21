import type { CSSProperties, ReactNode } from "react";
import type { DocumentLook, InvoiceTemplate } from "@cuentalibre/contracts";
import { TEMPLATE_STYLES, type TemplateFamily } from "./pdf-look";

/*
 * A miniature of each template's PDF, on an A4 sheet in millimetres. It follows
 * the positions in sales-pdf.ts, with text drawn as bars, so keep both in step.
 */

const LEFT = 15;
const RIGHT = 195;
const FOOT = 285;
const INK = "var(--ink)";
const RULE = "var(--rule)";
const PAPER = "var(--paper)";

type Align = "left" | "right" | "center";

interface TextProps {
  x: number;
  /** Baseline, as in the PDF. */
  y: number;
  w: number;
  h?: number;
  bold?: boolean;
  color?: string;
  align?: Align;
}

/** A line of text. */
function Text({ x, y, w, h = 3.6, bold = false, color = INK, align = "left" }: TextProps) {
  const left = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  return <rect x={left} y={y - h} width={w} height={h} rx={h / 2} fill={color} opacity={bold ? 0.85 : 0.45} />;
}

/** A rule; `width` in screen pixels, so it shows at any size. */
function Rule({
  x1,
  y1,
  x2,
  y2,
  width = 1,
  color = RULE,
}: Record<"x1" | "y1" | "x2" | "y2", number> & { width?: number; color?: string }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} vectorEffect="non-scaling-stroke" />;
}

function Frame({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="none"
      stroke={RULE}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** A filled band in the line color; `tint` moves it towards the paper, as mix() does in the PDF. */
function Band({ x, y, w, h, tint = 0 }: { x: number; y: number; w: number; h: number; tint?: number }) {
  return <rect x={x} y={y} width={w} height={h} fill={RULE} opacity={1 - tint} />;
}

/** Issuer or client: an optional heading, the name in bold and three lines. Returns where it ends. */
function party(out: ReactNode[], x: number, y: number, heading = false): number {
  if (heading) {
    out.push(<Text key={`h${x}${y}`} x={x} y={y + 4} w={24} h={5} bold />);
    y += 9;
  }
  [44, 36, 42, 30].forEach((w, i) =>
    out.push(<Text key={`p${x}${y}${i}`} x={x} y={y + 4 + i * 7} w={w} bold={i === 0} />),
  );
  return y + 4 + 3 * 7 + 3;
}

/* ───────────────────────── Headers ───────────────────────── */

/** The VERI*FACTU code, top right. */
function QrCode() {
  const x = RIGHT - 32;
  return (
    <g fill={INK} opacity={0.75}>
      <rect x={x} y={13} width={32} height={32} fill="none" stroke={INK} strokeWidth={4} />
      <rect x={x + 7} y={20} width={8} height={8} />
      <rect x={x + 17} y={20} width={8} height={8} />
      <rect x={x + 7} y={30} width={8} height={8} />
      <rect x={x + 19} y={32} width={4} height={4} />
    </g>
  );
}

const TOP = 54;

/** Each family's header, from under the code; returns where the lines table starts. */
const HEADERS: Record<TemplateFamily, (out: ReactNode[], traditional: boolean) => number> = {
  classic(out) {
    out.push(<Text key="date" x={RIGHT} y={TOP + 4} w={24} h={4.5} bold align="right" />);
    let y = party(out, LEFT, TOP) + 12;
    out.push(<Text key="title" x={105} y={y} w={68} h={9} bold align="center" />);
    y += 12;
    out.push(<Text key="number" x={LEFT} y={y} w={56} h={5} bold />);
    const boxTop = y + 4;
    const end = party(out, LEFT + 4, boxTop + 2);
    out.push(<Frame key="box" x={LEFT} y={boxTop} w={RIGHT - LEFT} h={end - boxTop + 2} />);
    return end + 12;
  },

  modern(out, traditional) {
    const end = Math.max(party(out, LEFT, TOP), party(out, 112, TOP));
    const y = end + 18;
    out.push(<Text key="title" x={LEFT} y={y} w={78} h={12} bold />);
    const rows = traditional ? 2 : 3;
    for (let i = 0; i < rows; i++) {
      const ry = y - 9 + i * 7;
      out.push(
        <Text key={`ml${i}`} x={135} y={ry} w={24} />,
        <Text key={`mv${i}`} x={RIGHT} y={ry} w={20} align="right" />,
      );
    }
    return Math.max(y + 10, y - 9 + rows * 7 + 4);
  },

  professional(out, traditional) {
    const rows = traditional ? 2 : 3;
    for (let i = 0; i < rows; i++) {
      const y = TOP + i * 8;
      out.push(
        <Text key={`ml${i}`} x={168} y={y + 4} w={20} align="right" />,
        <Text key={`mv${i}`} x={RIGHT} y={y + 4} w={20} align="right" />,
        <Rule key={`mr${i}`} x1={128} y1={y + 6.5} x2={RIGHT} y2={y + 6.5} />,
      );
    }
    const top = TOP + rows * 8 + 8;
    const issuerEnd = party(out, LEFT, top + 9);
    const clientEnd = party(out, 112, top, true);
    out.push(
      <Rule key="bar1" x1={108} y1={top - 3} x2={108} y2={clientEnd} width={2.5} />,
      <Rule key="bar2" x1={RIGHT} y1={top - 3} x2={RIGHT} y2={clientEnd} width={2.5} />,
    );
    return Math.max(issuerEnd, clientEnd) + 10;
  },

  avantGarde(out) {
    const y = TOP + 6;
    out.push(
      <rect key="number" x={LEFT + 2} y={y - 5.5} width={58} height={5.5} rx={2.75} fill={RULE} />,
      <Text key="title" x={RIGHT} y={y} w={48} h={10} align="right" />,
    );
    let x = LEFT;
    for (const [share, tint] of [
      [0.42, 0],
      [0.12, 0.35],
      [0.3, 0.15],
      [0.16, 0.5],
    ] as const) {
      const w = (RIGHT - LEFT) * share;
      out.push(<Band key={`s${share}`} x={x} y={y + 3} w={w} h={3.5} tint={tint} />);
      x += w;
    }
    const top = y + 13;
    let end = Math.max(party(out, LEFT + 2, top + 9), party(out, 112, top, true)) + 6;
    for (let i = 0; i < 2; i++) {
      const cx = LEFT + i * 26;
      out.push(
        <Band key={`dh${i}`} x={cx} y={end} w={24} h={7} />,
        <Text key={`dl${i}`} x={cx + 12} y={end + 5} w={14} h={3} color={PAPER} bold align="center" />,
        <Frame key={`df${i}`} x={cx} y={end + 7} w={24} h={7} />,
        <Text key={`dv${i}`} x={cx + 12} y={end + 12} w={16} h={3} align="center" />,
      );
    }
    end += 22;
    return end;
  },
};

/* ───────────────────────── Lines ───────────────────────── */

/** Left edges of the columns right of the concept, as columns() lays them out in the PDF. */
const COLUMNS = { newer: [96, 109, 132, 157, 173], traditional: [107, 137, 162] };

function lines(out: ReactNode[], family: TemplateFamily, traditional: boolean, top: number): number {
  const lefts = traditional ? COLUMNS.traditional : COLUMNS.newer;
  const edges = [...lefts.slice(1), RIGHT];
  const filled = family === "professional" || family === "avantGarde";
  const grid = family === "classic" || family === "avantGarde";
  const classic = family === "classic";
  const header = 8;

  if (filled) out.push(<Band key="th" x={LEFT} y={top} w={RIGHT - LEFT} h={header} />);
  if (classic) out.push(<Band key="th" x={LEFT} y={top} w={RIGHT - LEFT} h={header} tint={0.8} />);
  if (family === "modern") out.push(<Rule key="thr" x1={LEFT} y1={top + header} x2={RIGHT} y2={top + header} />);
  if (grid) {
    out.push(<Frame key="thf" x={LEFT} y={top} w={RIGHT - LEFT} h={header} />);
    lefts.forEach((x) => out.push(<Rule key={`thv${x}`} x1={x} y1={top} x2={x} y2={top + header} />));
  }
  const labelColor = filled ? PAPER : INK;
  out.push(<Text key="tc" x={LEFT + 2} y={top + 5.5} w={22} h={3} color={labelColor} bold={filled || classic} />);
  lefts.forEach((x, i) => {
    const w = Math.min(edges[i]! - x - 5, 14);
    out.push(
      <Text
        key={`tl${x}`}
        x={classic ? (x + edges[i]!) / 2 : edges[i]! - 2}
        y={top + 5.5}
        w={w}
        h={3}
        color={labelColor}
        bold={filled || classic}
        align={classic ? "center" : "right"}
      />,
    );
  });

  let y = top + header;
  const rows = [56, 42];
  rows.forEach((w, r) => {
    const rowTop = y;
    out.push(<Text key={`rc${r}`} x={LEFT + 2} y={rowTop + 6.5} w={w} />);
    lefts.forEach((x, i) =>
      out.push(<Text key={`rv${r}${x}`} x={edges[i]! - 2} y={rowTop + 6.5} w={(edges[i]! - x) * 0.6} align="right" />),
    );
    y += 10;
    if (grid) {
      out.push(
        <Rule key={`rl${r}`} x1={LEFT} y1={rowTop} x2={LEFT} y2={y} />,
        <Rule key={`rr${r}`} x1={RIGHT} y1={rowTop} x2={RIGHT} y2={y} />,
        <Rule key={`rb${r}`} x1={LEFT} y1={y} x2={RIGHT} y2={y} />,
        ...lefts.map((x) => <Rule key={`rv${r}l${x}`} x1={x} y1={rowTop} x2={x} y2={y} />),
      );
    } else if (family === "professional" && r < rows.length - 1) {
      out.push(
        <line
          key={`rd${r}`}
          x1={LEFT}
          y1={y}
          x2={RIGHT}
          y2={y}
          stroke={INK}
          opacity={0.4}
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />,
      );
    }
  });
  if (family === "professional") out.push(<Rule key="end" x1={LEFT} y1={y + 1} x2={RIGHT} y2={y + 1} width={2.5} />);
  if (family === "modern" && traditional)
    out.push(<Rule key="end" x1={LEFT} y1={y + 1} x2={RIGHT} y2={y + 1} width={2.5} color={INK} />);
  return y + 8;
}

/* ───────────────────────── Totals ───────────────────────── */

/** Traditional templates: the totals right after the lines, then the due date and how to pay. */
function traditionalTotals(out: ReactNode[], family: TemplateFamily, top: number) {
  let y = top;
  if (family === "classic") {
    [4.5, 4.5, 6].forEach((step, i) => {
      y += step + 1;
      const last = i === 2;
      out.push(
        <Text key={`tl${i}`} x={133} y={y} w={last ? 18 : 26} h={last ? 4.5 : 3.6} bold={last} />,
        <Text key={`tv${i}`} x={RIGHT - 3} y={y} w={last ? 20 : 16} h={last ? 4.5 : 3.6} bold={last} align="right" />,
      );
    });
    y += 3;
    out.push(<Frame key="tf" x={130} y={top} w={RIGHT - 130} h={y - top} />);
    y += 12;
    out.push(<Text key="due" x={LEFT} y={y} w={52} bold />, <Text key="pay" x={LEFT + 2} y={y + 10} w={120} bold />);
    return;
  }
  [5.5, 5.5, 8].forEach((step, i) => {
    const last = i === 2;
    if (last && family === "professional")
      out.push(<Rule key="tr" x1={125} y1={y + 2} x2={RIGHT} y2={y + 2} width={2} />);
    y += step + (last ? 2 : 0);
    out.push(
      <Text key={`tl${i}`} x={168} y={y} w={last ? 18 : 30} h={last ? 6 : 3.6} bold={last} align="right" />,
      <Text key={`tv${i}`} x={RIGHT} y={y} w={last ? 24 : 16} h={last ? 6 : 3.6} bold={last} align="right" />,
    );
  });
  y += 14;
  out.push(
    <Text key="due" x={LEFT} y={y} w={56} />,
    <Text key="info" x={LEFT} y={y + 11} w={30} h={5.5} bold />,
    <Text key="pay" x={LEFT} y={y + 19} w={120} />,
  );
}

/** The newer templates: the tax breakdown and the totals, at the foot of the page. */
function footTotals(out: ReactNode[], family: TemplateFamily) {
  if (family === "classic") {
    const x = 75;
    const third = (RIGHT - x) / 3;
    let y = FOOT - 62;
    out.push(<Text key="due" x={LEFT} y={y + 4} w={52} bold />);
    y += 9;
    const top = y;
    out.push(<Band key="bh" x={x} y={top} w={RIGHT - x} h={7} tint={0.8} />);
    [0, 1, 2].forEach((i) =>
      out.push(<Text key={`bl${i}`} x={x + third * i + third / 2} y={top + 5} w={22} h={3} bold align="center" />),
    );
    out.push(
      ...[0, 1, 2].map((i) => <Text key={`bv${i}`} x={x + third * (i + 1) - 2} y={top + 12.5} w={18} align="right" />),
    );
    y = top + 15;
    out.push(
      <Frame key="bf" x={x} y={top} w={RIGHT - x} h={y - top} />,
      <Rule key="bhr" x1={x} y1={top + 7} x2={RIGHT} y2={top + 7} />,
      <Rule key="bv1" x1={x + third} y1={top} x2={x + third} y2={y} />,
      <Rule key="bv2" x1={x + third * 2} y1={top} x2={x + third * 2} y2={y} />,
    );
    const boxTop = y;
    const boxX = x + third;
    [5, 5, 6.5].forEach((step, i) => {
      y += step;
      const last = i === 2;
      out.push(
        <Text key={`tl${i}`} x={boxX + 2} y={y} w={last ? 16 : 22} h={last ? 4.5 : 3.4} bold />,
        <Text key={`tv${i}`} x={RIGHT - 2} y={y} w={last ? 20 : 16} h={last ? 4.5 : 3.4} bold align="right" />,
      );
    });
    y += 2.5;
    out.push(
      <Frame key="tf" x={boxX} y={boxTop} w={RIGHT - boxX} h={y - boxTop} />,
      <Text key="pay" x={LEFT + 2} y={y + 9} w={120} bold />,
    );
    return;
  }

  if (family === "modern") {
    const x = 100;
    let y = FOOT - 52;
    out.push(
      <Text key="bl0" x={128} y={y + 4} w={22} h={3} align="right" />,
      <Text key="bl1" x={158} y={y + 4} w={20} h={3} align="center" />,
      <Text key="bl2" x={RIGHT} y={y + 4} w={14} h={3} align="right" />,
      <Rule key="bhr" x1={x} y1={y + 6.5} x2={RIGHT} y2={y + 6.5} />,
    );
    y += 12;
    out.push(
      <Text key="bv0" x={128} y={y} w={16} align="right" />,
      <Text key="bv1" x={158} y={y} w={14} align="center" />,
      <Text key="bv2" x={RIGHT} y={y} w={14} align="right" />,
      <Rule key="bend" x1={x} y1={y + 3} x2={RIGHT} y2={y + 3} width={1.5} color={INK} />,
    );
    y += 3;
    [5, 5, 9].forEach((step, i) => {
      y += step;
      const last = i === 2;
      out.push(
        <Text key={`tl${i}`} x={RIGHT - 30} y={y} w={last ? 22 : 18} h={last ? 7 : 3.4} bold align="right" />,
        <Text key={`tv${i}`} x={RIGHT} y={y} w={last ? 26 : 16} h={last ? 7 : 3.4} bold align="right" />,
      );
    });
    out.push(<Text key="pay" x={LEFT + 2} y={y + 9} w={120} />);
    return;
  }

  // Elegante and Vanguardista: the breakdown and a "Totales" table side by side
  const grid = family === "avantGarde";
  const row = 6.5;
  const top = FOOT - (grid ? 30 : 42);
  const cells: ReactNode[] = [];
  const rule = (key: string, x: number, y: number, w: number) =>
    grid ? (
      <Frame key={key} x={x} y={y} w={w} h={row} />
    ) : (
      <Rule key={key} x1={x} y1={y + row} x2={x + w} y2={y + row} />
    );

  cells.push(<Band key="bh" x={LEFT} y={top} w={100 - LEFT} h={row} />);
  [45, 71, 98].forEach((x, i) =>
    cells.push(<Text key={`bl${i}`} x={x - 2} y={top + 4.7} w={18} h={3} color={PAPER} bold align="right" />),
  );
  cells.push(rule("br0", LEFT, top + row, 100 - LEFT));
  [45, 71, 98].forEach((x, i) =>
    cells.push(<Text key={`bv${i}`} x={x - 2} y={top + row + 4.7} w={14} h={3} align="right" />),
  );
  if (grid)
    cells.push(
      <Rule key="bc1" x1={45} y1={top + row} x2={45} y2={top + row * 2} />,
      <Rule key="bc2" x1={71} y1={top + row} x2={71} y2={top + row * 2} />,
    );

  cells.push(
    <Band key="th" x={115} y={top} w={RIGHT - 115} h={row} />,
    <Text key="tt" x={117} y={top + 4.7} w={18} h={3} color={PAPER} bold />,
  );
  [0, 1, 2].forEach((i) => {
    const y = top + row * (i + 1);
    const last = i === 2;
    cells.push(
      <Text key={`tl${i}`} x={117} y={y + 4.7} w={last ? 14 : 22} h={3} bold={last} />,
      <Text key={`tv${i}`} x={RIGHT - 2} y={y + 4.7} w={last ? 18 : 16} h={3} bold={last} align="right" />,
      rule(`tr${i}`, 115, y, RIGHT - 115),
    );
    if (grid) cells.push(<Rule key={`tc${i}`} x1={169} y1={y} x2={169} y2={y + row} />);
  });
  out.push(...cells);
  if (!grid) out.push(<Text key="pay" x={LEFT + 2} y={top + row * 4 + 9} w={120} />);
}

/* ───────────────────────── Sheet ───────────────────────── */

/** The template's page, in the chosen colors and font. */
export function TemplateThumbnail({ template, look }: { template: InvoiceTemplate; look: DocumentLook }) {
  const { family, traditional } = TEMPLATE_STYLES[template];
  const out: ReactNode[] = [];
  const tableTop = HEADERS[family](out, traditional);
  const after = lines(out, family, traditional, tableTop);
  if (traditional) traditionalTotals(out, family, after);
  else {
    if (family === "avantGarde") out.push(<Text key="pay" x={LEFT} y={after + 2} w={120} />);
    footTotals(out, family);
  }
  const colors = {
    "--ink": look.textColor,
    "--rule": look.lineColor,
    "--paper": look.backgroundColor,
  } as CSSProperties;
  return (
    <svg
      viewBox="0 0 210 297"
      aria-hidden="true"
      style={colors}
      className="block aspect-[210/297] w-full rounded-sm border border-border shadow-sm"
    >
      <rect width={210} height={297} fill={PAPER} />
      <QrCode />
      {out}
    </svg>
  );
}
