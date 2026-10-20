import type { MembershipRole } from "@fiscalia/contracts";
import type { VerifactuEnvironment } from "@fiscalia/core";
import type { Auth } from "./auth";
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
    /** Largest file that can be uploaded, in bytes. */
    fileMaxBytes: number;
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
