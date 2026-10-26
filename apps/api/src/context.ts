import type { MembershipRole } from "@cuentalibre/contracts";
import type { VerifactuEnvironment } from "@cuentalibre/core";
import type { Auth } from "./auth";
import type { Billing } from "./billing";
import type { Mailer } from "./email/mailer";
import type { Db } from "./db/client";
import type { FileStorage } from "./storage";

type SessionData = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

/** Variables that middleware puts on the request context. */
export interface AppEnv {
  Variables: {
    db: Db;
    storage: FileStorage;
    /** Which AEAT environment VERI*FACTU records point to. */
    verifactuEnvironment: VerifactuEnvironment;
    /** Sends email; null when the instance has no mail server. */
    mailer: Mailer | null;
    /** Charging for Cloud; null when the instance doesn't bill. */
    billing: Billing | null;
    /** Whether new passwords are checked against data breaches. */
    checkBreachedPasswords: boolean;
    /** Most recipients an organization's emails reach in a day and in 30 days; 0 means no limit. */
    emailQuota: { daily: number; monthly: number };
    /** Largest file that can be uploaded, in bytes. */
    fileMaxBytes: number;
    /** Most bytes an organization's files may take in all; 0 means no limit. */
    fileQuotaBytes: number;
    user: SessionData["user"] | null;
    /** The browser session; null when the request authenticates with an API key. */
    session: SessionData["session"] | null;
    /** The organization the request is scoped to: the session's, or the API key's. */
    activeOrganizationId: string | null;
    /** Set when the request authenticates with an API key. */
    apiKeyId: string | null;
    /** Set by `requireOrganization`. */
    organizationId: string;
    role: MembershipRole;
  };
}
