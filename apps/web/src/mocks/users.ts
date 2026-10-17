/** Sample company users and email settings until there is a backend. Made up. */

/** People who work in the company, or an outside advisor (gestoría) who keeps its books. */
export type UserKind = "member" | "advisor";
export type UserRole = "admin" | "standard" | "readOnly";

export interface CompanyUser {
  id: string;
  kind: UserKind;
  name: string;
  email: string;
  role: UserRole;
  /** Access can be switched off without removing the user. */
  enabled: boolean;
  /** Invited users haven't accepted yet and have never signed in. */
  invited: boolean;
  /** Local date and time, "2026-10-17T19:29". */
  lastAccessAt: string | null;
  /** Last day with access; null never expires. */
  expiresOn: string | null;
  /** Who created the company: always an enabled admin, can't be removed. */
  owner?: boolean;
}

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

export type EmailProvider = "fiscalia" | "gmail" | "outlook" | "smtp";
export type SmtpSecurity = "none" | "auto" | "implicit" | "explicit";

export interface SmtpSettings {
  displayName: string;
  email: string;
  username: string;
  password: string;
  server: string;
  port: string;
  security: SmtpSecurity;
  /** Keep a copy in the server's sent folder (IMAP). */
  saveCopy: boolean;
}

export interface EmailSettings {
  provider: EmailProvider;
  /** Address of the connected Gmail or Outlook account, if any. */
  connected: { gmail: string | null; outlook: string | null };
  smtp: SmtpSettings;
}

export const initialEmailSettings: EmailSettings = {
  provider: "fiscalia",
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
