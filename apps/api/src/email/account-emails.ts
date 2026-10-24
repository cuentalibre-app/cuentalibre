import { button, codeBlock, escapeHtml, layout, note, paragraph } from "./account-email-html";
import type { Mailer, OutgoingEmail } from "./mailer";

/** How long a code to verify an email works: long enough to read the mail on another device. */
export const VERIFICATION_EXPIRES_IN = 60 * 60;

interface Recipient {
  name: string;
  email: string;
}

const accountEmail = (to: Recipient, subject: string, text: string, html: string): OutgoingEmail => ({
  fromName: "cuentalibre",
  to: [to.email],
  cc: [],
  subject,
  text,
  html,
  attachments: [],
});

const greeting = (to: Recipient) => paragraph(`Hola, ${escapeHtml(to.name)}:`);

/** The code to verify the email the user signed up with; the subject carries it, for phone notifications. */
export const verificationCodeEmail = (to: Recipient, code: string) =>
  accountEmail(
    to,
    `${code} es tu código de cuentalibre`,
    `Hola, ${to.name}:

Para confirmar que este email es tuyo, escribe este código en cuentalibre:

${code}

Caduca en una hora. Si no has creado una cuenta en cuentalibre, ignora este mensaje.
`,
    layout({
      title: "Confirma tu email",
      preheader: `Escribe ${code} en cuentalibre para confirmar que este email es tuyo.`,
      body: [
        greeting(to),
        paragraph("Para confirmar que este email es tuyo, escribe este código en cuentalibre:"),
        codeBlock(code),
        note("Caduca en una hora. Si ya no vale, pide otro desde la misma pantalla."),
      ].join("\n"),
      footer:
        "Te llega porque alguien ha creado una cuenta en cuentalibre con este email. Si no has sido tú, ignóralo.",
    }),
  );

/** The code to switch the account to a new email, sent to that email. */
export const emailChangeCodeEmail = (to: Recipient, code: string) =>
  accountEmail(
    to,
    `${code} es tu código de cuentalibre`,
    `Hola, ${to.name}:

Para usar este email en tu cuenta de cuentalibre, escribe este código:

${code}

Caduca en una hora. Si no lo has pedido tú, ignora este mensaje.
`,
    layout({
      title: "Usa este email en cuentalibre",
      preheader: `Escribe ${code} en cuentalibre para que tu cuenta use este email.`,
      body: [
        greeting(to),
        paragraph("Para usar este email en tu cuenta de cuentalibre, escribe este código:"),
        codeBlock(code),
        note("Caduca en una hora. Hasta que lo escribas, tu cuenta sigue con el email de antes."),
      ].join("\n"),
      footer:
        "Te llega porque alguien quiere usar este email en su cuenta de cuentalibre. Si no has sido tú, ignóralo.",
    }),
  );

export const passwordResetEmail = (to: Recipient, url: string) =>
  accountEmail(
    to,
    "Cambia tu contraseña de cuentalibre",
    `Hola, ${to.name}:

Para elegir una contraseña nueva, abre este enlace:

${url}

Caduca en una hora. Si no lo has pedido tú, ignora este mensaje: tu contraseña no cambia.
`,
    layout({
      title: "Elige una contraseña nueva",
      preheader: "El enlace para cambiar tu contraseña de cuentalibre caduca en una hora.",
      body: [
        greeting(to),
        paragraph("Para elegir una contraseña nueva, pulsa el botón. Al cambiarla se cerrarán todas tus sesiones."),
        button(url, "Elegir contraseña"),
        note("Caduca en una hora."),
      ].join("\n"),
      footer:
        "Te llega porque alguien ha pedido cambiar la contraseña de tu cuenta. Si no has sido tú, ignóralo: tu contraseña no cambia.",
    }),
  );

/**
 * Sends an email about the user's account without waiting for it, so how long
 * the request takes doesn't reveal whether the account exists. People can ask
 * for it again if it doesn't arrive.
 */
export function sendInBackground(mailer: Mailer, email: OutgoingEmail) {
  mailer.send(email).catch((error: unknown) => {
    console.warn(`Account email "${email.subject}" failed:`, error instanceof Error ? error.message : error);
  });
}
