import type { MembershipRole } from "@fiscalia/contracts";
import type { Auth } from "./auth";
import type { Db } from "./db/client";

type SessionData = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

/** Variables that middleware puts on the request context. */
export interface AppEnv {
  Variables: {
    db: Db;
    user: SessionData["user"] | null;
    session: SessionData["session"] | null;
    /** Set by `requireOrganization`. */
    organizationId: string;
    role: MembershipRole;
  };
}
