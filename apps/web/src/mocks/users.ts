import type { CompanyUser, EmailSettings } from "@cuentalibre/contracts";

/** Sample company users and email settings until there is a backend. Made up. */

export const initialUsers: CompanyUser[] = [
  {
    id: "owner",
    kind: "member",
    name: "Lucía Martín Ortega",
    email: "hola@luciamartin.es",
    role: "admin",
    enabled: true,
    invited: false,
    lastAccessAt: "2026-10-17T19:29",
    expiresOn: null,
    owner: true,
  },
  {
    id: "u-advisor",
    kind: "advisor",
    name: "Asesoría Lumen",
    email: "marta@asesorialumen.es",
    role: "standard",
    enabled: true,
    invited: true,
    lastAccessAt: null,
    expiresOn: "2027-06-30",
  },
];

export const initialEmailSettings: EmailSettings = {
  provider: "cuentalibre",
  connected: { gmail: null, outlook: null },
  smtp: {
    displayName: "",
    email: "",
    username: "",
    password: "",
    server: "",
    port: "",
    security: "auto",
    saveCopy: true,
  },
};
