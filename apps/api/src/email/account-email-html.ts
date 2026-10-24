/**
 * The HTML of the emails about people's accounts, in the brand's colors and type.
 * Email clients only render tables and inline styles reliably, so that is all
 * it uses; even the logo is drawn with cells, as many clients block images.
 */

const INK = "#111214";
const MUTED = "#4f5257";
const BLUE = "#2f45c9";
const BLUE_SOFT = "#ebeefb";
const PAGE = "#f3f3f1";
const BORDER = "#e2e2dd";
const GRADIENT = "linear-gradient(110deg, #2f45c9 0%, #6a4fe0 50%, #0e8fae 100%)";

const SANS = "'Geist', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const MONO = "'Geist Mono', 'SF Mono', Menlo, Consolas, monospace";

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Three bars and the blue dot, as in `LogoMark`, beside the name. */
function logo() {
  const bar = (height: number) =>
    `<div style="width:7px;height:${height}px;background:${INK};border-radius:2px;font-size:0;line-height:0">&nbsp;</div>`;
  const gap = `<td width="2" style="font-size:0">&nbsp;</td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="bottom">${bar(10)}</td>${gap}
<td valign="bottom">${bar(16)}</td>${gap}
<td valign="bottom"><div style="width:7px;height:7px;background:${BLUE};border-radius:50%;margin-bottom:2px;font-size:0;line-height:0">&nbsp;</div>${bar(18)}</td>
<td width="9" style="font-size:0">&nbsp;</td>
<td valign="bottom" style="font-family:${SANS};font-size:19px;font-weight:600;letter-spacing:-0.01em;line-height:15px;color:${INK}">cuentalibre</td>
</tr></table>`;
}

/** A paragraph of body text; `html` is already escaped. */
export const paragraph = (html: string) =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.55;color:${INK}">${html}</p>`;

/** Secondary text, such as when something expires. */
export const note = (html: string) =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:14px;line-height:1.5;color:${MUTED}">${html}</p>`;

/** The code to type, large, on a soft panel under a stripe of the brand gradient. */
export function codeBlock(code: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px">
<tr><td style="height:4px;background:${BLUE};background-image:${GRADIENT};border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td align="center" style="background:${BLUE_SOFT};border-radius:0 0 12px 12px;padding:24px 16px 26px">
<div style="font-family:${MONO};font-size:38px;font-weight:600;letter-spacing:0.28em;padding-left:0.28em;line-height:1;color:${INK}">${escapeHtml(code)}</div>
</td></tr></table>`;
}

/** The main action: a pill in the brand gradient, flat blue where gradients don't render. */
export function button(url: string, label: string) {
  const href = escapeHtml(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr>
<td bgcolor="${BLUE}" style="border-radius:999px;background:${BLUE};background-image:${GRADIENT}">
<a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(label)}</a>
</td></tr></table>
${note(`Si el botón no funciona, copia este enlace en el navegador:<br><a href="${href}" style="color:${BLUE};word-break:break-all">${href}</a>`)}`;
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
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Geist+Mono:wght@600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${PAGE}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
<tr><td style="padding:0 4px 20px">${logo()}</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${BORDER};border-radius:16px;padding:36px 32px 20px">
<h1 style="margin:0 0 20px;font-family:${SERIF};font-size:30px;font-weight:600;line-height:1.15;letter-spacing:-0.02em;color:${INK}">${escapeHtml(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${MUTED}">${footer}<br>cuentalibre: facturas e impuestos para autónomos, con código abierto.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
