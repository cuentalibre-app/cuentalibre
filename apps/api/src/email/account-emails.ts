import type { Mailer, OutgoingEmail } from "./mailer";

/** How long the link to verify an email works. */
export const VERIFICATION_EXPIRES_IN = 24 * 60 * 60;

interface Recipient {
  name: string;
  email: string;
}

const accountEmail = (to: Recipient, subject: string, text: string): OutgoingEmail => ({
  fromName: "cuentalibre",
  to: [to.email],
  cc: [],
  subject,
  text,
  attachments: [],
});

export const verificationEmail = (to: Recipient, url: string) =>
  accountEmail(
    to,
    "Confirma tu email en cuentalibre",
    `Hola, ${to.name}:

Para confirmar que este email es tuyo, abre este enlace:

${url}

Caduca en 24 horas. Si no has creado una cuenta en cuentalibre, ignora este mensaje.
`,
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
