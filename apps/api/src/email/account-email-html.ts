/**
 * The HTML of the emails about people's accounts, in the brand's colors and type.
 * Email clients only render tables and inline styles reliably, so that is all
 * it uses; even the logo is drawn with cells, as many clients block images.
 */

/** The app's tokens (`packages/ui/src/styles`), resolved to hex: emails can't read CSS variables. */
const INK = "#111214"; // --foreground
const PRIMARY = "#1d2024"; // --primary: the app's ink buttons
const PRIMARY_TOP = "#42454a"; // --primary-top: the button's lit top edge
const MARK = "#6f8aa6"; // --brand-mark: the logo's slate head
const MUTED = "#4f5257"; // --muted-foreground
const PANEL = "#efefec"; // --muted
const CANVAS = "#f3f3f1"; // --canvas
const BORDER = "#d3d3ce"; // --border

const SANS = "'Geist', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const MONO = "'Geist Mono', 'SF Mono', Menlo, Consolas, monospace";
const BRAND = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * `LogoMark` at 24 px, drawn with cells: three ink columns, the slate head over the last
 * one, all standing on the wordmark's baseline.
 */
function logo() {
  const block = (width: number, height: number, color: string, radius: string, after = 0) =>
    `<div style="width:${width}px;height:${height}px;background:${color};border-radius:${radius};${after ? `margin-bottom:${after}px;` : ""}font-size:0;line-height:0">&nbsp;</div>`;
  const column = (height: number) => block(6, height, INK, "2px");
  const gap = `<td width="2" style="font-size:0">&nbsp;</td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="bottom">${column(9)}</td>${gap}
<td valign="bottom">${column(14)}</td>${gap}
<td valign="bottom">${block(6, 6, MARK, "50%", 2)}${column(16)}</td>
<td width="10" style="font-size:0">&nbsp;</td>
<td valign="bottom" style="font-family:${BRAND};font-size:19px;font-weight:600;letter-spacing:-0.01em;line-height:15px;color:${INK}">cuentalibre</td>
</tr></table>`;
}

/** A paragraph of body text; `html` is already escaped. */
export const paragraph = (html: string) =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.55;color:${INK}">${html}</p>`;

/** Secondary text, such as when something expires. */
export const note = (html: string) =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:14px;line-height:1.5;color:${MUTED}">${html}</p>`;

/** A link inside text: ink, underlined, as on the site. */
export const link = (url: string, label: string) =>
  `<a href="${escapeHtml(url)}" style="color:${INK};font-weight:600;text-decoration:underline;text-underline-offset:3px">${escapeHtml(label)}</a>`;

/** The code to type, large, on the app's muted panel. */
export function codeBlock(code: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px">
<tr><td align="center" style="background:${PANEL};border-radius:12px;padding:24px 16px 26px">
<div style="font-family:${MONO};font-size:38px;font-weight:600;letter-spacing:0.28em;padding-left:0.28em;line-height:1;color:${INK}">${escapeHtml(code)}</div>
</td></tr></table>`;
}

/** The main action: the app's ink pill with its lit top edge, flat ink where gradients don't render. */
export function button(url: string, label: string) {
  const href = escapeHtml(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr>
<td bgcolor="${PRIMARY}" style="border-radius:999px;background:${PRIMARY};background-image:linear-gradient(180deg, ${PRIMARY_TOP}, ${PRIMARY} 60%)">
<a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(label)}</a>
</td></tr></table>
${note(`Si el botón no funciona, copia este enlace en el navegador:<br><a href="${href}" style="color:${MUTED};word-break:break-all">${href}</a>`)}`;
}

interface Layout {
  /** The headline, and the page's title. */
  title: string;
  /** Shown by inboxes next to the subject. */
  preheader: string;
  /** The message, built from the pieces above. */
  body: string;
  /** Why the person got this email. */
  footer: string;
}

export function layout({ title, preheader, body, footer }: Layout) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Geist+Mono:wght@600&family=JetBrains+Mono:wght@600&family=Source+Serif+4:opsz,wght@8..60,700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${CANVAS}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
<tr><td style="padding:0 4px 20px">${logo()}</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${BORDER};border-radius:16px;padding:36px 32px 20px">
<h1 style="margin:0 0 20px;font-family:${SERIF};font-size:32px;font-weight:700;line-height:1.12;letter-spacing:-0.025em;color:${INK}">${escapeHtml(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${MUTED}">${footer}<br>cuentalibre: facturas e impuestos para autónomos, con código abierto.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
